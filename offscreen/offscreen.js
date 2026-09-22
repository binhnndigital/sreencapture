function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function canvasToDataUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob failed"));
      resolve(blobToDataUrl(blob));
    }, "image/png");
  });
}

async function stitch(msg) {
  const { parts, totalWidth, totalHeight, devicePixelRatio, maxDimension } = msg;

  const dpr = devicePixelRatio || 1;
  const pixelWidth = Math.round(totalWidth * dpr);
  const pixelHeight = Math.round(totalHeight * dpr);
  const maxSlice = Math.min(maxDimension, 16000);
  const sliceCount = Math.max(1, Math.ceil(pixelHeight / maxSlice));
  const sliceCssHeight = Math.ceil(totalHeight / sliceCount);

  const images = [];
  for (let i = 0; i < sliceCount; i++) {
    const sliceTopCss = i * sliceCssHeight;
    const sliceBottomCss = Math.min(totalHeight, sliceTopCss + sliceCssHeight);
    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = Math.round((sliceBottomCss - sliceTopCss) * dpr);
    const ctx = canvas.getContext("2d");

    for (const part of parts) {
      const img = await loadImage(part.dataUrl);
      const sx = Math.round(part.rect.left * dpr);
      const sy = Math.round(part.rect.top * dpr);
      const sw = Math.round(part.rect.width * dpr);
      const sh = Math.round(part.rect.height * dpr);
      const dx = Math.round(part.x * dpr);
      const dy = Math.round(part.y * dpr - sliceTopCss * dpr);
      if (dy + sh > 0 && dy < canvas.height && sw > 0 && sh > 0) {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
      }
    }
    images.push(await canvasToDataUrl(canvas));
  }
  return { images };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "stitch") return;
  stitch(message).then(sendResponse, (err) => {
    console.error("Stitch error:", err);
    sendResponse({ images: [] });
  });
  return true;
});
