const OFFSCREEN_URL = "offscreen/offscreen.html";
const CAPTURE_DELAY_MS = 450;
const MAX_CANVAS_DIMENSION = 16000;

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (existing.length > 0) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["BLOBS"],
      justification: "Stitch captured viewport images into a full-page screenshot.",
    });
  }
  await creatingOffscreen;
  creatingOffscreen = null;
}

function sanitizeFilename(name) {
  const cleaned = (name || "page").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return cleaned.slice(0, 80) || "page";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function captureFullPage(tab) {
  const tabId = tab.id;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });

  const metrics = await sendToTab(tabId, { type: "get-metrics" });
  if (!metrics) throw new Error("Không đọc được kích thước trang.");

  const { scrollWidth, scrollHeight, viewportWidth, viewportHeight, devicePixelRatio } = metrics;

  const parts = [];
  const stepY = Math.max(1, viewportHeight);
  const stepX = Math.max(1, viewportWidth);

  try {
    for (let y = 0; y < scrollHeight; y += stepY) {
      for (let x = 0; x < scrollWidth; x += stepX) {
        const pos = await sendToTab(tabId, { type: "scroll-to", x, y });
        await sleep(CAPTURE_DELAY_MS);
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });
        parts.push({ dataUrl, x: pos.scrollX, y: pos.scrollY });
      }
    }
  } finally {
    await sendToTab(tabId, { type: "restore" }).catch(() => {});
  }

  await ensureOffscreenDocument();

  const result = await chrome.runtime.sendMessage({
    type: "stitch",
    parts,
    viewportWidth,
    viewportHeight,
    totalWidth: Math.min(scrollWidth, viewportWidth),
    totalHeight: scrollHeight,
    devicePixelRatio,
    maxDimension: MAX_CANVAS_DIMENSION,
  });

  if (!result || !result.images || result.images.length === 0) {
    throw new Error("Ghép ảnh thất bại.");
  }

  const base = sanitizeFilename(tab.title);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (let i = 0; i < result.images.length; i++) {
    const suffix = result.images.length > 1 ? `-part${i + 1}` : "";
    await chrome.downloads.download({
      url: result.images[i],
      filename: `fullpage-${base}-${stamp}${suffix}.png`,
      saveAs: true,
    });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:|^file:/.test(tab.url || "")) {
    return;
  }
  try {
    await captureFullPage(tab);
  } catch (err) {
    console.error("Full page capture failed:", err);
  }
});
