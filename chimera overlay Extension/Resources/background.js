// background.js
const API_BASE = "http://127.0.0.1:8787";

async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return await res.json();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "DICT_LOOKUP") {
        const data = await postJSON("/lookup", { text: msg.text || "" });
        sendResponse({ ok: true, data });
        return;
      }
      if (msg?.type === "DICT_VERSION") {
        const res = await fetch(`${API_BASE}/version`);
        const data = await res.json();
        sendResponse({ ok: true, data });
        return;
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
