// Client-side product mockup generator. Every mockup is drawn on a canvas from the
// uploaded poster artwork, so nothing extra is sent to the backend until the admin
// uploads the product.

const A_RATIO = Math.SQRT2;

export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    image.onload = () => {
      if (source instanceof Blob) URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      if (source instanceof Blob) {
        URL.revokeObjectURL(url);
        const kind = source.type || source.name?.split(".").pop() || "unknown type";
        reject(new Error(`the browser can't open "${source.name || "this image"}" (${kind}). Use a JPG, PNG or WEBP file.`));
      } else {
        reject(new Error(`could not load ${source}. Is the admin dev server still running?`));
      }
    };
    image.src = url;
  });
}

export function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return canvas;
}

// Crops the image to the requested aspect ratio (width / height). focusX/focusY (0-1)
// choose which part of the image survives the crop.
export function cropToAspect(image, aspect, { focusX = 0.5, focusY = 0.5, maxSide = 2400 } = {}) {
  const sourceAspect = image.width / image.height;
  let sw = image.width;
  let sh = image.height;
  if (sourceAspect > aspect) sw = sh * aspect;
  else sh = sw / aspect;
  const sx = (image.width - sw) * focusX;
  const sy = (image.height - sh) * focusY;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = createCanvas(sw * scale, sh * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function posterOrientation(image) {
  return image.width > image.height ? "Landscape" : "Portrait";
}

// ---------- geometry ----------

// Homography mapping the unit square (0,0)-(1,1) onto quad [tl, tr, br, bl].
function unitSquareToQuad([p0, p1, p2, p3]) {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w];
  };
}

// Corners [tl, tr, br, bl] of a flat sheet (width/height = aspect) turned in 3D and
// seen through a perspective camera, scaled to fit inside box [left, top, right, bottom].
// yaw > 0 turns the right edge away from the viewer; pitch > 0 tips the top away.
function sheetIn3d(aspect, box, { yaw = 0, pitch = 0, roll = 0, focal = 3 } = {}) {
  const rad = Math.PI / 180;
  const [cy, sy] = [Math.cos(yaw * rad), Math.sin(yaw * rad)];
  const [cp, sp] = [Math.cos(pitch * rad), Math.sin(pitch * rad)];
  const [cr, sr] = [Math.cos(roll * rad), Math.sin(roll * rad)];
  const w = aspect / 2;
  const h = 0.5;
  const projected = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => {
    [x, y] = [x * cr - y * sr, x * sr + y * cr];
    let z = 0;
    [x, z] = [x * cy, x * sy];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const scale = focal / (focal + z);
    return [x * scale, y * scale];
  });
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [left, top, right, bottom] = box;
  const fit = Math.min((right - left) / (maxX - minX), (bottom - top) / (maxY - minY));
  const offsetX = (left + right) / 2 - ((minX + maxX) / 2) * fit;
  const offsetY = (top + bottom) / 2 - ((minY + maxY) / 2) * fit;
  return projected.map(([x, y]) => [x * fit + offsetX, y * fit + offsetY]);
}

// Two-layer shadow: a tight contact shadow and a wide soft one, so the sheet reads
// as hanging slightly off the surface instead of sitting on a grey blob.
function drawSoftShadow(ctx, map, { dx = 1, dy = 1, depth = 1 } = {}) {
  [
    { blur: 10, offset: 5, alpha: 0.22 },
    { blur: 70, offset: 34, alpha: 0.16 }
  ].forEach(({ blur, offset, alpha }) => {
    ctx.save();
    ctx.shadowBlur = blur * depth;
    ctx.shadowOffsetX = offset * dx * depth + 10000;
    ctx.shadowOffsetY = offset * dy * depth;
    ctx.shadowColor = `rgba(0,0,0,${alpha})`;
    ctx.translate(-10000, 0);
    ctx.fillStyle = "#000";
    outlinePath(ctx, map);
    ctx.fill();
    ctx.restore();
  });
}

function quadraticPoint(start, control, end, t) {
  const mt = 1 - t;
  return [
    mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0],
    mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1]
  ];
}

// Control point so the quadratic curve passes through `mid` at t = 0.5.
function controlThrough(start, mid, end) {
  return [2 * mid[0] - (start[0] + end[0]) / 2, 2 * mid[1] - (start[1] + end[1]) / 2];
}

// Coons patch for a sheet whose edges bend. `mids` are points each edge passes through
// halfway along (top, right, bottom, left); omit an edge to keep it straight.
function bentSheet([tl, tr, br, bl], mids = {}) {
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const edge = (start, end, mid) => {
    const control = controlThrough(start, mid || midpoint(start, end), end);
    return (t) => quadraticPoint(start, control, end, t);
  };
  const top = edge(tl, tr, mids.top);
  const bottom = edge(bl, br, mids.bottom);
  const left = edge(tl, bl, mids.left);
  const right = edge(tr, br, mids.right);
  return (u, v) => {
    const t = top(u);
    const b = bottom(u);
    const l = left(v);
    const r = right(v);
    const point = [0, 1].map((i) => (
      (1 - v) * t[i] + v * b[i] + (1 - u) * l[i] + u * r[i]
      - ((1 - u) * (1 - v) * tl[i] + u * (1 - v) * tr[i] + (1 - u) * v * bl[i] + u * v * br[i])
    ));
    return point;
  };
}

function drawTriangle(ctx, image, s0, s1, s2, d0, d1, d2) {
  // Grow the destination triangle slightly so neighbouring triangles overlap and no
  // hairline seams show.
  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * 0.9, p[1] + (dy / len) * 0.9];
  };
  const [e0, e1, e2] = [grow(d0), grow(d1), grow(d2)];

  const denom = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  if (!denom) return;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / denom;
  const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / denom;
  const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / denom;
  const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / denom;
  const e = d0[0] - a * s0[0] - c * s0[1];
  const f = d0[1] - b * s0[0] - d * s0[1];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]);
  ctx.lineTo(e1[0], e1[1]);
  ctx.lineTo(e2[0], e2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

// Draws `image` warped through map(u, v) -> [x, y] using a triangle mesh.
function drawWarped(ctx, image, map, steps = 24) {
  const w = image.width;
  const h = image.height;
  const grid = [];
  for (let row = 0; row <= steps; row += 1) {
    const line = [];
    for (let col = 0; col <= steps; col += 1) line.push(map(col / steps, row / steps));
    grid.push(line);
  }
  const src = (col, row) => [(col / steps) * w, (row / steps) * h];
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  for (let row = 0; row < steps; row += 1) {
    for (let col = 0; col < steps; col += 1) {
      const p00 = grid[row][col];
      const p10 = grid[row][col + 1];
      const p01 = grid[row + 1][col];
      const p11 = grid[row + 1][col + 1];
      drawTriangle(ctx, image, src(col, row), src(col + 1, row), src(col, row + 1), p00, p10, p01);
      drawTriangle(ctx, image, src(col + 1, row), src(col + 1, row + 1), src(col, row + 1), p10, p11, p01);
    }
  }
  ctx.restore();
}

function outlinePath(ctx, map, steps = 24) {
  ctx.beginPath();
  const edge = [];
  for (let i = 0; i <= steps; i += 1) edge.push(map(i / steps, 0));
  for (let i = 1; i <= steps; i += 1) edge.push(map(1, i / steps));
  for (let i = steps - 1; i >= 0; i -= 1) edge.push(map(i / steps, 1));
  for (let i = steps - 1; i > 0; i -= 1) edge.push(map(0, i / steps));
  edge.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Soft glossy sheen across the metal sheet, clipped to its outline.
function drawSheen(ctx, map, { from = [0, 0], to = [1, 1], strength = 0.18 } = {}) {
  const start = map(...from);
  const end = map(...to);
  ctx.save();
  outlinePath(ctx, map);
  ctx.clip();
  const gradient = ctx.createLinearGradient(start[0], start[1], end[0], end[1]);
  gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
  gradient.addColorStop(0.42, "rgba(255,255,255,0)");
  gradient.addColorStop(0.75, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength * 0.45})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function drawShadow(ctx, map, { blur, offsetX, offsetY, color }) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  ctx.shadowColor = color;
  ctx.fillStyle = "#cfd3d8";
  outlinePath(ctx, map);
  ctx.fill();
  ctx.restore();
}

// Crisp outline so the sheet edge reads as cut metal rather than a blurry border.
function drawRim(ctx, map) {
  ctx.save();
  outlinePath(ctx, map);
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
  ctx.restore();
}

function scaleQuad(quad, sx, sy = sx) {
  return quad.map(([x, y]) => [x * sx, y * sy]);
}

// ---------- icons for the feature card ----------

function iconHq(ctx, x, y, s) {
  ctx.fillStyle = "#151515";
  roundRect(ctx, x, y, s, s, s * 0.12);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${s * 0.44}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HQ", x + s / 2, y + s * 0.53);
}

function iconPalette(ctx, x, y, s) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = "#151515";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.48, Math.PI * 0.15, Math.PI * 1.95);
  ctx.quadraticCurveTo(cx + s * 0.18, cy + s * 0.02, cx + s * 0.3, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  [[-0.2, -0.22], [0.08, -0.28], [-0.3, 0.04], [-0.14, 0.26]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(cx + dx * s, cy + dy * s, s * 0.075, 0, Math.PI * 2);
    ctx.fill();
  });
}

function iconThickness(ctx, x, y, s) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.strokeStyle = "#151515";
  ctx.fillStyle = "#151515";
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.06, cy - s * 0.42);
  ctx.lineTo(cx - s * 0.06, cy + s * 0.42);
  ctx.moveTo(cx + s * 0.06, cy - s * 0.42);
  ctx.lineTo(cx + s * 0.06, cy + s * 0.42);
  ctx.moveTo(x, cy);
  ctx.lineTo(cx - s * 0.14, cy);
  ctx.moveTo(cx + s * 0.14, cy);
  ctx.lineTo(x + s, cy);
  ctx.stroke();
  [[-1, cx - s * 0.12], [1, cx + s * 0.12]].forEach(([dir, tip]) => {
    ctx.beginPath();
    ctx.moveTo(tip, cy);
    ctx.lineTo(tip - dir * s * 0.13, cy - s * 0.09);
    ctx.lineTo(tip - dir * s * 0.13, cy + s * 0.09);
    ctx.closePath();
    ctx.fill();
  });
}

function iconDetailed(ctx, x, y, s) {
  ctx.strokeStyle = "#151515";
  ctx.lineWidth = s * 0.075;
  ctx.lineJoin = "round";
  roundRect(ctx, x + s * 0.28, y + s * 0.22, s * 0.6, s * 0.74, s * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.12, y + s * 0.78);
  ctx.lineTo(x + s * 0.12, y + s * 0.04);
  ctx.lineTo(x + s * 0.68, y + s * 0.04);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const featureList = [
  { label: "High Quality print on metal", icon: iconHq },
  { label: "Vivid Colours", icon: iconPalette },
  { label: "1mm Thick", icon: iconThickness },
  { label: "Extremely Detailed", icon: iconDetailed }
];

// ---------- the four mockups ----------

function fillStudioBackground(ctx, width, height) {
  const gradient = ctx.createRadialGradient(width * 0.45, height * 0.4, 0, width * 0.45, height * 0.45, Math.max(width, height) * 0.8);
  gradient.addColorStop(0, "#f7f7f7");
  gradient.addColorStop(1, "#e7e7e8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// 1. Feature card: tilted poster plus the four selling points.
function renderFeatures(art, landscape) {
  const width = 1500;
  const height = 1500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  fillStudioBackground(ctx, width, height);

  // Turned slightly away to the right, like a sheet on a wall seen from the left.
  const quad = landscape
    ? sheetIn3d(A_RATIO, [140, 110, 1360, 960], { yaw: 20, focal: 2.6 })
    : sheetIn3d(1 / A_RATIO, [70, 70, 930, 1430], { yaw: 24, focal: 2.6 });
  const map = unitSquareToQuad(quad);
  drawSoftShadow(ctx, map, { dx: 0.8, dy: 1 });
  drawWarped(ctx, art, map);
  drawSheen(ctx, map, { from: [0, 0], to: [1, 1], strength: 0.12 });
  drawRim(ctx, map);

  const iconSize = 124;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  if (landscape) {
    const columnWidth = width / 4;
    featureList.forEach((feature, index) => {
      const cx = columnWidth * index + columnWidth / 2;
      feature.icon(ctx, cx - iconSize / 2, 1110, iconSize);
      drawLabel(ctx, feature.label, cx, 1270, columnWidth - 40);
    });
  } else {
    const cx = 1215;
    const gap = 330;
    const top = height / 2 - (gap * 3 + iconSize + 120) / 2;
    featureList.forEach((feature, index) => {
      const y = top + gap * index;
      feature.icon(ctx, cx - iconSize / 2, y, iconSize);
      drawLabel(ctx, feature.label, cx, y + iconSize + 30, 500);
    });
  }
  return canvas;
}

function drawLabel(ctx, text, cx, y, maxWidth) {
  ctx.save();
  ctx.fillStyle = "#111";
  ctx.font = "500 54px Inter, 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  lines.forEach((value, index) => ctx.fillText(value, cx, y + index * 66));
  ctx.restore();
}

// 2. Poster held by a person. Hand pixels from the photo are painted back over the
// new artwork so the fingers stay in front of the sheet.
const holdingTemplate = {
  src: "/mockups/holding-source.jpg",
  scale: 3,
  // Sheet outline in the photo, a few pixels oversized so the old print never shows.
  corners: [[176, 47], [421, 170], [275, 508], [11, 385]],
  mids: { top: [291, 106], right: [340, 339], bottom: [141, 449], left: [93, 218] },
  hands: [
    [[90, 0], [215, 0], [215, 95], [150, 110], [90, 80]],
    [[255, 430], [345, 430], [345, 531], [255, 531]]
  ]
};

function isSkin(r, g, b) {
  // g >= b separates skin from the pink/purple tones common in poster art.
  return r > 95 && g > 40 && b > 20 && r > g && g >= b && r - b > 22 && r - g > 12 && b < 215;
}

async function renderHolding(art) {
  const template = holdingTemplate;
  const photo = await loadImage(template.src);
  const s = template.scale;
  const canvas = createCanvas(photo.width * s, photo.height * s);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

  const corners = scaleQuad(template.corners, s);
  const mids = Object.fromEntries(Object.entries(template.mids).map(([key, [x, y]]) => [key, [x * s, y * s]]));
  const map = bentSheet(corners, mids);
  drawWarped(ctx, art, map, 32);
  drawSheen(ctx, map, { from: [0.1, 0], to: [0.9, 1], strength: 0.2 });

  // Paint the hands back on top of the poster.
  const handLayer = createCanvas(canvas.width, canvas.height);
  const handCtx = handLayer.getContext("2d");
  handCtx.imageSmoothingQuality = "high";
  handCtx.drawImage(photo, 0, 0, handLayer.width, handLayer.height);
  const pixels = handCtx.getImageData(0, 0, handLayer.width, handLayer.height);
  const mask = createCanvas(canvas.width, canvas.height);
  const maskCtx = mask.getContext("2d");
  maskCtx.fillStyle = "#000";
  template.hands.forEach((polygon) => {
    maskCtx.beginPath();
    polygon.forEach(([x, y], index) => (index ? maskCtx.lineTo(x * s, y * s) : maskCtx.moveTo(x * s, y * s)));
    maskCtx.closePath();
    maskCtx.fill();
  });
  const region = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const inside = region[i + 3] > 0;
    data[i + 3] = inside && isSkin(data[i], data[i + 1], data[i + 2]) ? 255 : 0;
  }
  handCtx.putImageData(pixels, 0, 0);
  ctx.save();
  ctx.filter = "blur(0.6px)";
  ctx.drawImage(handLayer, 0, 0);
  ctx.restore();
  return canvas;
}

// 3. Poster hanging in a living room.
const roomTemplate = {
  src: "/mockups/room-source.jpg",
  scale: 1.5,
  // Exact frame of the poster in the photo (with a 2px safety margin).
  frame: { left: 294, top: 170, right: 795, bottom: 891 }
};

function cleanWall(ctx, photo, frame, s) {
  // Rebuild plain wall behind the original poster by mirroring the wall to its left,
  // row for row, so the lighting matches. The right edge fades into the real wall.
  const left = frame.left - 15;
  const top = frame.top - 15;
  // Extends past the old frame so the fade happens over real wall only.
  const width = frame.right - left + 80;
  const height = frame.bottom - top + 15;
  const tile = Math.min(260, left - 5);
  const patch = createCanvas(width * s, height * s);
  const patchCtx = patch.getContext("2d");
  patchCtx.imageSmoothingQuality = "high";
  for (let x = 0, index = 0; x < width; x += tile, index += 1) {
    const w = Math.min(tile, width - x);
    patchCtx.save();
    if (index % 2 === 0) {
      patchCtx.translate((x * 2 + w) * s, 0);
      patchCtx.scale(-1, 1);
      patchCtx.drawImage(photo, left - w, top, w, height, x * s, 0, w * s, height * s);
    } else {
      patchCtx.drawImage(photo, left - tile, top, w, height, x * s, 0, w * s, height * s);
    }
    patchCtx.restore();
  }
  const fade = patchCtx.createLinearGradient((width - 60) * s, 0, width * s, 0);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  patchCtx.globalCompositeOperation = "destination-in";
  patchCtx.fillStyle = fade;
  patchCtx.fillRect(0, 0, patch.width, patch.height);
  ctx.drawImage(patch, left * s, top * s);
}

async function renderRoom(art, landscape) {
  const { src, scale: s, frame } = roomTemplate;
  const photo = await loadImage(src);
  const canvas = createCanvas(photo.width * s, photo.height * s);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

  let rect = frame;
  if (landscape) {
    cleanWall(ctx, photo, frame, s);
    const cx = (frame.left + frame.right) / 2;
    const cy = (frame.top + frame.bottom) / 2 - 40;
    const w = 760;
    const h = w / A_RATIO;
    rect = { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 };
  }
  const quad = scaleQuad([[rect.left, rect.top], [rect.right, rect.top], [rect.right, rect.bottom], [rect.left, rect.bottom]], s);
  const map = unitSquareToQuad(quad);
  drawShadow(ctx, map, { blur: 18 * s, offsetX: 7 * s, offsetY: 9 * s, color: "rgba(40,30,20,0.35)" });
  drawWarped(ctx, art, map, 4);
  drawSheen(ctx, map, { strength: 0.12 });
  return canvas;
}

// 4. Clean product shot: the sheet tilted in 3D with a soft drop shadow.
function renderPerspective(art, landscape) {
  const width = landscape ? 1600 : 1200;
  const height = landscape ? 1200 : 1600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const quad = landscape
    ? sheetIn3d(A_RATIO, [130, 150, 1450, 1030], { yaw: -22, pitch: 10, roll: -3, focal: 2.4 })
    : sheetIn3d(1 / A_RATIO, [150, 110, 1030, 1450], { yaw: -24, pitch: 10, roll: -3, focal: 2.4 });
  const map = unitSquareToQuad(quad);
  drawSoftShadow(ctx, map, { dx: 1, dy: 1.2, depth: 1.2 });
  drawWarped(ctx, art, map);
  drawSheen(ctx, map, { from: [1, 0], to: [0, 1], strength: 0.16 });
  drawRim(ctx, map);
  return canvas;
}

export const mockupTypes = [
  { key: "features", label: "Feature highlights", landscape: true },
  { key: "holding", label: "Held in hand", landscape: false },
  { key: "room", label: "Room wall", landscape: true },
  { key: "perspective", label: "3D product shot", landscape: true }
];

// Mockup files are named "<poster>-<key>.jpg"; returns the matching label, or "".
export function mockupLabelFor(fileName = "") {
  const match = mockupTypes.find((type) => String(fileName).endsWith(`-${type.key}.jpg`));
  return match ? match.label : "";
}

export function canvasToFile(canvas, name, type = "image/jpeg", quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not export image"));
        return;
      }
      resolve(new File([blob], name, { type }));
    }, type, quality);
  });
}

function fileSlug(name) {
  return String(name || "poster").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "poster";
}

// Generates all mockups that suit the artwork's orientation. Returns
// [{ key, label, file, url }].
export async function generateMockups(file) {
  const image = await loadImage(file);
  const landscape = image.width > image.height;
  const art = cropToAspect(image, landscape ? A_RATIO : 1 / A_RATIO);
  const base = fileSlug(file.name);
  const renderers = {
    features: () => renderFeatures(art, landscape),
    holding: () => renderHolding(art),
    room: () => renderRoom(art, landscape),
    perspective: () => renderPerspective(art, landscape)
  };

  const results = [];
  for (const type of mockupTypes) {
    if (landscape && !type.landscape) continue;
    const canvas = await renderers[type.key]();
    const output = await canvasToFile(canvas, `${base}-${type.key}.jpg`);
    results.push({ key: type.key, label: type.label, file: output, url: URL.createObjectURL(output) });
  }
  return results;
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The API accepts images up to 5MB. Larger artwork is re-encoded as a JPEG
// (and shrunk if needed) so the admin doesn't have to resize it by hand.
export async function fitUploadLimit(file, limit = 5 * 1024 * 1024) {
  if (file.size <= limit) return file;
  const image = await loadImage(file);
  const name = `${fileSlug(file.name)}.jpg`;
  for (const maxSide of [4000, 3200, 2400, 1800]) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = createCanvas(image.width * scale, image.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = await canvasToFile(canvas, name, "image/jpeg", 0.9);
    if (output.size <= limit) return output;
  }
  throw new Error("Image is too large to upload even after compressing it");
}
