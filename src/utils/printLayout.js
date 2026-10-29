import { canvasToFile, createCanvas } from "./posterMockups.js";

// ISO A sizes in millimetres (portrait). Every A size has the same 1:√2 shape, so
// two sheets side by side form the next size up in landscape.
export const paperSizes = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 }
};

const MM_PER_INCH = 25.4;

export function sheetPixels(paper, orientation, dpi) {
  const size = paperSizes[paper];
  const portrait = [size.width, size.height].map((mm) => Math.round((mm / MM_PER_INCH) * dpi));
  return orientation === "landscape" ? [portrait[1], portrait[0]] : portrait;
}

// Size of all sheets placed next to each other, in sheet pixels.
export function layoutPixels({ paper, orientation, dpi, panels, direction }) {
  const [w, h] = sheetPixels(paper, orientation, dpi);
  return direction === "vertical" ? [w, h * panels] : [w * panels, h];
}

// Where the source image lands inside the full layout (layout pixel coordinates).
function placement(image, layoutW, layoutH, { mode, focusX, focusY }) {
  const scale = mode === "fit"
    ? Math.min(layoutW / image.width, layoutH / image.height)
    : Math.max(layoutW / image.width, layoutH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  return { x: (layoutW - w) * focusX, y: (layoutH - h) * focusY, w, h, scale };
}

function paintLayout(ctx, image, layoutW, layoutH, offsetX, offsetY, options) {
  const { mode, background } = options;
  if (mode === "fit") {
    if (background === "blur") {
      const cover = placement(image, layoutW, layoutH, { mode: "crop", focusX: 0.5, focusY: 0.5 });
      ctx.save();
      // Canvas filters ignore the transform, so size the blur from the real canvas.
      ctx.filter = `blur(${Math.round(Math.max(ctx.canvas.width, ctx.canvas.height) / 60)}px) brightness(0.85)`;
      ctx.drawImage(image, cover.x - offsetX, cover.y - offsetY, cover.w, cover.h);
      ctx.restore();
    } else {
      ctx.fillStyle = background === "black" ? "#000" : "#fff";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }
  const place = placement(image, layoutW, layoutH, options);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, place.x - offsetX, place.y - offsetY, place.w, place.h);
}

// Small preview of the whole layout with the cut lines drawn in.
export function renderPreview(image, options, maxSide = 900) {
  const [layoutW, layoutH] = layoutPixels(options);
  const scale = maxSide / Math.max(layoutW, layoutH);
  const canvas = createCanvas(layoutW * scale, layoutH * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  paintLayout(ctx, image, layoutW, layoutH, 0, 0, options);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 3;
  for (let index = 1; index < options.panels; index += 1) {
    ctx.beginPath();
    if (options.direction === "vertical") {
      const y = (canvas.height / options.panels) * index;
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    } else {
      const x = (canvas.width / options.panels) * index;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();
  }
  ctx.restore();
  return canvas;
}

// How many source pixels end up on each printed inch; below ~150 prints look soft.
export function effectiveDpi(image, options) {
  const [layoutW, layoutH] = layoutPixels(options);
  const place = placement(image, layoutW, layoutH, options);
  return Math.round(options.dpi / place.scale);
}

// Renders every sheet at print resolution. Each sheet is drawn straight from the
// source so the full layout (up to ~70 megapixels for 2×A2) never sits in memory.
export async function renderSheets(image, options, baseName = "poster") {
  const [sheetW, sheetH] = sheetPixels(options.paper, options.orientation, options.dpi);
  const [layoutW, layoutH] = layoutPixels(options);
  const files = [];
  for (let index = 0; index < options.panels; index += 1) {
    const canvas = createCanvas(sheetW, sheetH);
    const ctx = canvas.getContext("2d");
    const offsetX = options.direction === "vertical" ? 0 : sheetW * index;
    const offsetY = options.direction === "vertical" ? sheetH * index : 0;
    paintLayout(ctx, image, layoutW, layoutH, offsetX, offsetY, options);
    const suffix = options.panels > 1 ? `-part${index + 1}of${options.panels}` : "";
    files.push(await canvasToFile(canvas, `${baseName}-${options.paper}-${options.dpi}dpi${suffix}.jpg`, "image/jpeg", 0.92));
    canvas.width = 0;
    canvas.height = 0;
  }
  return files;
}

// Web-sized JPEG of the whole layout, small enough for the 5MB product upload limit.
export async function renderProductImage(image, options, baseName = "poster", maxSide = 2400) {
  const [layoutW, layoutH] = layoutPixels(options);
  const scale = Math.min(1, maxSide / Math.max(layoutW, layoutH));
  const canvas = createCanvas(layoutW * scale, layoutH * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  paintLayout(ctx, image, layoutW, layoutH, 0, 0, options);
  return canvasToFile(canvas, `${baseName}-${options.paper}.jpg`, "image/jpeg", 0.9);
}
