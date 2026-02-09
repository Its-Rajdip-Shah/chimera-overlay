# uvicorn server:app --host 127.0.0.1 --port 8787

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import jieba
from pypinyin import pinyin, Style

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PinyinReq(BaseModel):
    text: str

# Phrase overrides (tone-mark pinyin)
PHRASE_OVERRIDES = {
    "银行": "yín háng",
    "行业": "háng yè",
    "重新": "chóng xīn",
    "觉得": "jué de",
    "普通话": "pǔ tōng huà",
    "官话": "guān huà",
    "标准汉语": "biāo zhǔn hàn yǔ",
    "汉语": "hàn yǔ",
    "华北平原": "huá běi píng yuán",
    "长江": "cháng jiāng",
    "黑龙江": "hēi lóng jiāng",
    "新疆": "xīn jiāng",
    "云南": "yún nán",
    "北京": "běi jīng",
}

# Optional: teach jieba some domain words so it segments nicely
for w in PHRASE_OVERRIDES.keys():
    jieba.add_word(w)

# Punctuation tightening (so you don't get weird spaces)
PUNCT = r"([，。！？；：、,.!?;:])"
CLOSE_PUNCT = r"([）)】\]”’\"'])"
OPEN_PUNCT = r"([（(【\[\“‘\"'])"

def tighten_punctuation(s: str) -> str:
    # remove spaces before punctuation
    s = re.sub(r"\s+" + PUNCT, r"\1", s)
    # remove spaces before closing punctuation
    s = re.sub(r"\s+" + CLOSE_PUNCT, r"\1", s)
    # remove spaces after opening punctuation
    s = re.sub(OPEN_PUNCT + r"\s+", r"\1", s)
    # collapse multiple spaces
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()

def apply_overrides_longest_first(text: str) -> str:
    # Replace longer phrases first to avoid partial replacement issues
    for k in sorted(PHRASE_OVERRIDES.keys(), key=len, reverse=True):
        text = text.replace(k, f"⟦{PHRASE_OVERRIDES[k]}⟧")  # mark as protected
    return text

def restore_overrides(tokens: list[str]) -> list[str]:
    out = []
    for t in tokens:
        if t.startswith("⟦") and t.endswith("⟧"):
            out.append(t[1:-1])  # drop the brackets, keep pinyin
        else:
            out.append(t)
    return out

def hanzi_to_pinyin(text: str) -> str:
    # Preserve newlines by processing per line
    lines = text.splitlines()
    out_lines = []

    for line in lines:
        if not line.strip():
            out_lines.append("")  # keep blank lines
            continue

        line2 = apply_overrides_longest_first(line)
        words = jieba.lcut(line2, cut_all=False)

        out = []
        for w in words:
            # If it's an override marker, keep as-is
            if w.startswith("⟦") and w.endswith("⟧"):
                out.append(w[1:-1])
                continue

            py = pinyin(w, style=Style.TONE, errors=lambda x: [x])
            out.append(" ".join(s[0] for s in py))

        out = restore_overrides(out)
        out_lines.append(tighten_punctuation(" ".join(out)))

    return "\n".join(out_lines).strip()

@app.post("/pinyin")
def pinyin_endpoint(req: PinyinReq):
    return {"pinyin": hanzi_to_pinyin(req.text)}
