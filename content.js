(() => {
  if (window.__fullPageCaptureLoaded) return;
  window.__fullPageCaptureLoaded = true;

  const MIN_SCROLL_DIST = 50;
  const MAX_SCAN = 3000;

  let scroller = null; // null = window/document scrolls
  let original = null;

  function findScroller() {
    const doc = document.scrollingElement || document.documentElement;
    const docDist = doc.scrollHeight - window.innerHeight;
    let best = null;
    let bestDist = 0;
    const els = document.querySelectorAll("*");
    const n = Math.min(els.length, MAX_SCAN);
    for (let i = 0; i < n; i++) {
      const el = els[i];
      if (el.clientHeight < 100) continue;
      const style = getComputedStyle(el);
      const oy = style.overflowY;
      if (oy !== "auto" && oy !== "scroll") continue;
      const dist = el.scrollHeight - el.clientHeight;
      if (dist > MIN_SCROLL_DIST && dist > bestDist) {
        best = el;
        bestDist = dist;
      }
    }
    if (best && bestDist > docDist) return best;
    return null;
  }

  function scrollableSize() {
    if (scroller) return { w: scroller.scrollWidth, h: scroller.scrollHeight };
    const el = document.documentElement;
    const body = document.body;
    return {
      w: Math.max(el.scrollWidth, body ? body.scrollWidth : 0, el.clientWidth),
      h: Math.max(el.scrollHeight, body ? body.scrollHeight : 0, el.clientHeight),
    };
  }

  function captureRect() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!scroller) return { left: 0, top: 0, width: vw, height: vh };
    const r = scroller.getBoundingClientRect();
    const left = Math.max(0, r.left);
    const top = Math.max(0, r.top);
    const right = Math.min(vw, r.right);
    const bottom = Math.min(vh, r.bottom);
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.max(0, Math.round(right - left)),
      height: Math.max(0, Math.round(bottom - top)),
    };
  }

  function currentScroll() {
    return scroller
      ? { x: scroller.scrollLeft, y: scroller.scrollTop }
      : { x: window.scrollX, y: window.scrollY };
  }

  function scrollToPos(x, y) {
    if (scroller) {
      scroller.scrollLeft = x;
      scroller.scrollTop = y;
    } else {
      window.scrollTo(x, y);
    }
  }

  function getMetrics() {
    const size = scrollableSize();
    const rect = captureRect();
    return {
      scrollWidth: scroller ? size.w : Math.min(size.w, rect.width),
      scrollHeight: size.h,
      stepWidth: rect.width,
      stepHeight: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  function waitForPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      switch (message.type) {
        case "get-metrics": {
          scroller = findScroller();
          original = {
            scroller,
            window: { x: window.scrollX, y: window.scrollY },
            el: scroller ? { x: scroller.scrollLeft, y: scroller.scrollTop } : null,
          };
          sendResponse(getMetrics());
          break;
        }
        case "scroll-to": {
          scrollToPos(message.x, message.y);
          await waitForPaint();
          const pos = currentScroll();
          sendResponse({ x: pos.x, y: pos.y, rect: captureRect() });
          break;
        }
        case "restore": {
          if (original) {
            if (original.el) {
              scroller.scrollLeft = original.el.x;
              scroller.scrollTop = original.el.y;
            }
            window.scrollTo(original.window.x, original.window.y);
          }
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse(null);
      }
    })();
    return true;
  });
})();
