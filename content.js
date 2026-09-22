(() => {
  if (window.__fullPageCaptureLoaded) return;
  window.__fullPageCaptureLoaded = true;

  let originalScroll = null;

  function getMetrics() {
    const el = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(el.scrollWidth, body ? body.scrollWidth : 0, el.clientWidth),
      scrollHeight: Math.max(el.scrollHeight, body ? body.scrollHeight : 0, el.clientHeight),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
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
          originalScroll = { x: window.scrollX, y: window.scrollY };
          sendResponse(getMetrics());
          break;
        }
        case "scroll-to": {
          window.scrollTo(message.x, message.y);
          await waitForPaint();
          sendResponse({ scrollX: window.scrollX, scrollY: window.scrollY });
          break;
        }
        case "restore": {
          if (originalScroll) window.scrollTo(originalScroll.x, originalScroll.y);
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
