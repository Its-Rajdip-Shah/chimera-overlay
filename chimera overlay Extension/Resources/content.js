// content.js
const EXT_CONTENT_VERSION = "chimera-content-2026-02-09-dblclick-01";

(() => {
  console.log("✅ Chimera dblclick dictionary loaded:", EXT_CONTENT_VERSION);

  // Popup UI
  const popup = document.createElement("div");
  Object.assign(popup.style, {
    position: "fixed",
    zIndex: "2147483647",
    background: "rgba(20,20,20,0.95)",
    color: "white",
    padding: "12px 14px",
    borderRadius: "12px",
    maxWidth: "560px",
    fontSize: "14px",
    lineHeight: "1.4",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    display: "none",
    whiteSpace: "pre-line",
  });
  document.documentElement.appendChild(popup);

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, c => (
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
    ));
  }

  function showAt(html, x, y) {
    popup.innerHTML = html;
    popup.style.left = `${Math.min(x + 12, window.innerWidth - 600)}px`;
    popup.style.top = `${Math.min(y + 12, window.innerHeight - 340)}px`;
    popup.style.display = "block";
  }

  function hide() { popup.style.display = "none"; }

  document.addEventListener("click", hide, true);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); }, true);

  // Prevent noisy lookups: trim punctuation
  function cleanSelection(s) {
    s = (s || "").trim();
    s = s.replace(/\s+/g, " ");
    // remove wrapping quotes/punct
    s = s.replace(/^[“”"'\(\)\[\]\{\},.!?;:]+/, "");
    s = s.replace(/[“”"'\(\)\[\]\{\},.!?;:]+$/, "");
    return s.trim();
  }

  // Cache results in-page
  const cache = new Map();
  const MAX_CACHE = 1000;
  function cacheSet(k, v) {
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(k, v);
  }

  async function lookup(text) {
    if (cache.has(text)) return cache.get(text);

    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "DICT_LOOKUP", text }, resolve);
    });

    if (!resp || !resp.ok) throw new Error(resp?.error || "No response from background");
    if (!resp.data || !resp.data.ok) throw new Error(resp?.data?.error || "Server returned error");

    cacheSet(text, resp.data.data);
    return resp.data.data;
  }

  document.addEventListener("dblclick", async (e) => {
    const raw = window.getSelection().toString();
    const sel = cleanSelection(raw);
    if (!sel) return;
    if (sel.length > 120) return;

    showAt(`Looking up…<br><span style="opacity:.7">${esc(sel)}</span>`, e.clientX, e.clientY);

    try {
      const d = await lookup(sel);

      const examples = Array.isArray(d.examples) ? d.examples.slice(0, 2) : [];
      const exHtml = examples.map((ex, i) => {
        const py = esc(ex.pinyin || "");
        const en = esc(ex.english || "");
        return `<b>Example ${i + 1}</b><br>${py}<br><span style="opacity:.85">${en}</span>`;
      }).join("<br><br>");

      showAt(
        `<b>${esc(d.pinyin || "")}</b><br>` +
        `<span style="opacity:.9">${esc(d.english || "")}</span>` +
        `<br><br><b>How it’s used</b><br>${esc(d.usage || "")}` +
        (exHtml ? `<br><br>${exHtml}` : ""),
        e.clientX,
        e.clientY
      );
    } catch (err) {
      showAt(
        `Lookup failed.<br><span style="opacity:.8">${esc(String(err?.message || err))}</span>`,
        e.clientX,
        e.clientY
      );
    }
  }, true);

  // Optional: quick debug check in console
  chrome.runtime.sendMessage({ type: "DICT_VERSION" }, (resp) => {
    if (resp?.ok) console.log("✅ Chimera server version:", resp.data);
  });
})();
