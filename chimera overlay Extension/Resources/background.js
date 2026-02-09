// background.js (MV3, module)
// Proxies requests to your local server: http://127.0.0.1:8787/pinyin
// Adds caching so repeated requests don't hit the server again.

const PINYIN_ENDPOINT = "http://127.0.0.1:8787/pinyin";

// Simple in-memory cache (token -> pinyin string)
const cache = new Map();

// Basic size cap so it doesn't grow forever
const MAX_CACHE_ENTRIES = 5000;

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Delete oldest (Map preserves insertion order)
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, value);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "CHIMERA_PINYIN") return;

  const text = (msg.text || "").toString();
  if (!text.trim()) {
    sendResponse({ ok: true, pinyin: "" });
    return;
  }

  const cached = cache.get(text);
  if (cached !== undefined) {
    sendResponse({ ok: true, pinyin: cached, cached: true });
    return;
  }

  fetch(PINYIN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Local server HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const pinyin = (data && data.pinyin) ? String(data.pinyin) : "";
      cacheSet(text, pinyin);
      sendResponse({ ok: true, pinyin, cached: false });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: String(err) });
    });

  return true; // keep channel open for async
});
