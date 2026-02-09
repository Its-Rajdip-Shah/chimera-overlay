// content.js
// After Safari Translate -> Simplified Chinese, this script:
// - detects Hanzi runs in text nodes
// - replaces each run with pinyin fetched from localhost server via background.js
// - hover tooltip shows original Hanzi + pinyin
// - mutation observer keeps it updated
(() => {
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT"]);

  // Hanzi range (CJK Unified Ideographs). Good enough for Simplified pages.
  const HANZI_REGEX = /[\u4E00-\u9FFF]/;

  // Match continuous runs of Hanzi (so we can convert chunk-by-chunk)
  const HANZI_RUN_REGEX = /[\u4E00-\u9FFF]+/g;

  // Cache in content script too (avoids roundtrips even to background)
  const localCache = new Map();
  const MAX_LOCAL_CACHE = 5000;

  function localCacheSet(key, value) {
    if (localCache.size >= MAX_LOCAL_CACHE) {
      const oldestKey = localCache.keys().next().value;
      localCache.delete(oldestKey);
    }
    localCache.set(key, value);
  }

  // ─────────────────────────────────────────────────────────────
  // Tooltip UI (shows ONLY: original Hanzi + pinyin)
  // ─────────────────────────────────────────────────────────────
  const tip = document.createElement("div");
  tip.id = "chimera-tip";
  tip.style.position = "fixed";
  tip.style.zIndex = "2147483647";
  tip.style.pointerEvents = "none";
  tip.style.padding = "8px 10px";
  tip.style.borderRadius = "10px";
  tip.style.fontSize = "13px";
  tip.style.lineHeight = "1.25";
  tip.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
  tip.style.background = "rgba(20,20,20,0.95)";
  tip.style.color = "white";
  tip.style.maxWidth = "360px";
  tip.style.whiteSpace = "pre-line";
  tip.style.display = "none";
  document.documentElement.appendChild(tip);

  function showTip(hanzi, pinyin, x, y) {
    tip.textContent = `Hanzi: ${hanzi}\nPinyin: ${pinyin}`;
    tip.style.display = "block";
    const left = Math.min(x + 12, window.innerWidth - 380);
    const top = Math.min(y + 12, window.innerHeight - 140);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hideTip() {
    tip.style.display = "none";
  }

  window.addEventListener("scroll", hideTip, true);
  document.addEventListener("click", hideTip, true);

  // ─────────────────────────────────────────────────────────────
  // Background proxy call
  // ─────────────────────────────────────────────────────────────
  function getPinyinFromServer(text) {
    const cached = localCache.get(text);
    if (cached !== undefined) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "CHIMERA_PINYIN", text }, (resp) => {
        if (!resp || !resp.ok) return reject(resp?.error || "No response from background");
        localCacheSet(text, resp.pinyin || "");
        resolve(resp.pinyin || "");
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Replace Hanzi runs in a text node with pinyin spans
  // ─────────────────────────────────────────────────────────────
  async function replaceTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || !HANZI_REGEX.test(text)) return;

    // Avoid reprocessing nodes inside our output spans
    const parentEl = textNode.parentNode;
    if (!parentEl) return;
    if (parentEl.nodeType === Node.ELEMENT_NODE) {
      const pel = parentEl;
      if (pel.closest && pel.closest("span[data-chimera='1']")) return;
    }

    // Build fragment with mixed plain text and pinyin spans
    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    // Reset regex state
    HANZI_RUN_REGEX.lastIndex = 0;

    let match;
    while ((match = HANZI_RUN_REGEX.exec(text)) !== null) {
      const hanzi = match[0];
      const start = match.index;
      const end = start + hanzi.length;

      // Append text before the Hanzi run
      if (start > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      // Convert this Hanzi run to pinyin (cached)
      let py = "";
      try {
        py = await getPinyinFromServer(hanzi);
      } catch (e) {
        // If server fails, fall back to leaving Hanzi unchanged
        py = hanzi;
      }

      const span = document.createElement("span");
      span.dataset.chimera = "1";
      span.dataset.hanzi = hanzi;
      span.dataset.pinyin = py;

      // Display pinyin on page
      span.textContent = py;

      // Style: subtle dotted underline so user knows it's hoverable
      span.style.cursor = "help";
      span.style.textDecoration = "underline dotted";

      // Hover tooltip
      span.addEventListener("mouseenter", (e) => showTip(hanzi, py, e.clientX, e.clientY));
      span.addEventListener("mousemove", (e) => showTip(hanzi, py, e.clientX, e.clientY));
      span.addEventListener("mouseleave", hideTip);

      frag.appendChild(span);

      lastIndex = end;
    }

    // Append remaining text after last match
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Swap node
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.tagName === "SPAN" && el.dataset && el.dataset.chimera === "1") return true;
    return false;
  }

  function walk(node, tasks) {
    if (!node) return;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      if (shouldSkipElement(el)) return;
      // Traverse children
      for (const child of Array.from(el.childNodes)) walk(child, tasks);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      tasks.push(node);
    }
  }

  // Debounced processing
  let scheduled = false;
  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(async () => {
      scheduled = false;
      await processPage();
    }, 250);
  }

  async function processPage() {
    const tasks = [];
    walk(document.body, tasks);

    // Process sequentially to avoid hammering localhost
    // (You can parallelize later with a small concurrency limit)
    for (const tn of tasks) {
      // node might have been replaced already
      if (!tn.parentNode) continue;
      await replaceTextNode(tn);
    }
  }

  // Observe DOM changes (Safari Translate often triggers mutations)
  const observer = new MutationObserver((mutations) => {
    // If new text nodes appear or structure changes, re-run
    // Keep it cheap: just schedule a debounced pass
    scheduleProcess();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Initial run
  processPage().then(() => {
    console.log("✅ Chimera: pinyin overlay active on", location.href);
  });
})();
