# server.py
# Run:
#   uvicorn server:app --host 127.0.0.1 --port 8787 --reload

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, re, time, json
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple
import urllib.request

APP_VERSION = "chimera-server-2026-02-09-fast-cedict-cache-01"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CEDICT_PATH = os.path.join(BASE_DIR, "cedict_ts.u8")

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:7b-instruct"

# ───────── No-Hanzi hard ban ─────────
HANZI_RE = re.compile(r"[\u4E00-\u9FFF]")
def strip_hanzi(s: str) -> str:
    return HANZI_RE.sub("", s or "")
def strip_hanzi_deep(obj):
    if isinstance(obj, str): return strip_hanzi(obj)
    if isinstance(obj, list): return [strip_hanzi_deep(x) for x in obj]
    if isinstance(obj, dict): return {k: strip_hanzi_deep(v) for k, v in obj.items()}
    return obj

# ───────── Simple LRU cache ─────────
class LRU:
    def __init__(self, maxsize=1500):
        self.maxsize = maxsize
        self.d = OrderedDict()

    def get(self, k):
        if k in self.d:
            self.d.move_to_end(k)
            return self.d[k]
        return None

    def set(self, k, v):
        self.d[k] = v
        self.d.move_to_end(k)
        if len(self.d) > self.maxsize:
            self.d.popitem(last=False)

CACHE = LRU(maxsize=2000)

# ───────── CC-CEDICT load (pinyin_num -> defs) ─────────
CEDICT_LINE_RE = re.compile(r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/\s*$")
PINYIN_INDEX: Dict[str, List[str]] = {}

def clean_defs(defs: str) -> str:
    s = defs.replace("/", "; ")
    s = re.sub(r"\s{2,}", " ", s).strip(" ;")
    # shorten mega-def spam a bit
    s = s[:350]
    return s

def load_cedict():
    if not os.path.exists(CEDICT_PATH):
        # Still allow server to run for English-only mode
        return
    with open(CEDICT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = CEDICT_LINE_RE.match(line)
            if not m:
                continue
            pinyin_num = m.group(3).strip().lower()
            defs = clean_defs(m.group(4).strip())
            PINYIN_INDEX.setdefault(pinyin_num, []).append(defs)

load_cedict()

# ───────── Pinyin detection ─────────
TONE_MARK_RE = re.compile(r"[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]")
PINYIN_ALLOWED_RE = re.compile(r"^[a-zA-ZüÜvV0-9\s\-]+$")

def is_pinyinish(text: str) -> bool:
    if not text: return False
    if HANZI_RE.search(text): return False
    t = text.strip()
    return bool(TONE_MARK_RE.search(t) or re.search(r"\d", t) or "ü" in t.lower() or "v" in t.lower())

# tone-mark -> tone-number conversion (for cedict keys)
TONE_MAP = {
    "ā": ("a","1"),"á": ("a","2"),"ǎ": ("a","3"),"à": ("a","4"),
    "ē": ("e","1"),"é": ("e","2"),"ě": ("e","3"),"è": ("e","4"),
    "ī": ("i","1"),"í": ("i","2"),"ǐ": ("i","3"),"ì": ("i","4"),
    "ō": ("o","1"),"ó": ("o","2"),"ǒ": ("o","3"),"ò": ("o","4"),
    "ū": ("u","1"),"ú": ("u","2"),"ǔ": ("u","3"),"ù": ("u","4"),
    "ǖ": ("ü","1"),"ǘ": ("ü","2"),"ǚ": ("ü","3"),"ǜ": ("ü","4"),
    "ń": ("n","2"),"ň": ("n","3"),"ǹ": ("n","4"),
}

def normalize_pinyin_to_num(text: str) -> Optional[str]:
    s = (text or "").strip()
    if not s: return None
    if HANZI_RE.search(s): return None
    s = s.lower().replace("v","ü").replace("u:","ü")

    if not PINYIN_ALLOWED_RE.match(s) and not TONE_MARK_RE.search(s):
        return None

    # already tone numbers
    if re.search(r"\d", s):
        s2 = re.sub(r"[\-]", " ", s)
        s2 = re.sub(r"\s+", " ", s2).strip()
        return s2

    out = []
    pending = None
    for ch in s:
        if ch in TONE_MAP:
            base, tone = TONE_MAP[ch]
            out.append(base)
            pending = tone
        else:
            if ch in [" ","-"]:
                if pending:
                    out.append(pending); pending=None
                out.append(" ")
            else:
                out.append(ch)
    if pending: out.append(pending)
    s2 = "".join(out)
    s2 = re.sub(r"\s+"," ", s2).strip()
    return s2

def cedict_lookup(pinyin_num: str) -> Tuple[str,int]:
    """Returns (best_def, alt_count)."""
    if not PINYIN_INDEX:
        return ("", 0)
    k = (pinyin_num or "").strip().lower()
    if not k:
        return ("", 0)

    defs = PINYIN_INDEX.get(k)
    if not defs:
        fused = k.replace(" ","")
        defs = PINYIN_INDEX.get(fused)
    if not defs and " " not in k:
        spaced = re.sub(r"(\d)([a-zü])", r"\1 \2", k)
        spaced = re.sub(r"\s+"," ", spaced).strip()
        defs = PINYIN_INDEX.get(spaced)

    if not defs:
        return ("", 0)
    return (defs[0], max(0, len(defs)-1))

# ───────── Ollama call (keep alive + shorter outputs) ─────────
def ollama_generate(prompt: str) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "10m",          # keeps model hot
        "options": {
            "temperature": 0.25,
            "top_p": 0.9,
            "num_predict": 180,        # cap output => faster
        }
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL, data=data,
        headers={"Content-Type":"application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        j = json.loads(resp.read().decode("utf-8", errors="replace"))
        return j.get("response","") or ""

def parse_json_obj(text: str) -> Optional[dict]:
    t = (text or "").strip()
    if t.startswith("{") and t.endswith("}"):
        try: return json.loads(t)
        except: pass
    a = t.find("{"); b = t.rfind("}")
    if a != -1 and b != -1 and b > a:
        try: return json.loads(t[a:b+1])
        except: return None
    return None

# ───────── FastAPI ─────────
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LookupReq(BaseModel):
    text: str

@app.get("/version")
def version():
    return {"ok": True, "version": APP_VERSION, "time": int(time.time()), "model": OLLAMA_MODEL}

@app.post("/lookup")
def lookup(req: LookupReq):
    raw = (req.text or "").strip()
    raw = raw.replace("\n"," ").strip()
    raw = raw[:120]
    if not raw:
        return {"ok": False, "error": "Empty selection."}

    cache_key = raw.lower()
    cached = CACHE.get(cache_key)
    if cached is not None:
        return {"ok": True, "data": cached, "cached": True}

    # ✅ FAST PATH: pinyin => CC-CEDICT only (instant)
    if is_pinyinish(raw):
        pnum = normalize_pinyin_to_num(raw) or ""
        best_def, alt = cedict_lookup(pnum)
        if best_def:
            data = strip_hanzi_deep({
                "selection": raw,
                "selection_type": "pinyin",
                "pinyin": raw,                  # keep user’s tone marks if they selected them
                "english": best_def,
                "usage": "Quick dictionary meaning from CC-CEDICT. If you want deeper nuance, we can add an LLM ‘deep mode’ later.",
                "examples": []
            })
            CACHE.set(cache_key, data)
            return {"ok": True, "data": data, "cached": False, "source": "cedict", "alt_senses": alt}

        # if cedict misses, fall through to LLM

    # LLM path (slower, but cached)
    prompt = f"""
You are a Mandarin speaking/listening coach.

User selected text: "{raw}"

CRITICAL:
- Output JSON ONLY.
- Do NOT output any Hanzi/Chinese characters at all.
- Mandarin must be in pinyin with tone marks.

Return this exact schema:
{{
  "selection": string,
  "selection_type": "pinyin" | "english",
  "pinyin": string,
  "english": string,
  "usage": string,
  "examples": [
    {{"pinyin": string, "english": string}},
    {{"pinyin": string, "english": string}}
  ]
}}

Keep it short.
Now output JSON:
"""
    out = ollama_generate(prompt)
    obj = parse_json_obj(out) or {
        "selection": raw,
        "selection_type": "english",
        "pinyin": "",
        "english": "Model output parse failed.",
        "usage": "Try selecting a single word.",
        "examples": []
    }

    obj = strip_hanzi_deep(obj)
    CACHE.set(cache_key, obj)
    return {"ok": True, "data": obj, "cached": False, "source": "llm"}