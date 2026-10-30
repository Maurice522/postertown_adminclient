// Perceptual image fingerprints for spotting posters that are already in the catalog.
// A difference hash compares the brightness of neighbouring blocks, so resizing,
// re-encoding (JPG/WEBP) and small colour shifts barely change it, while different
// artwork changes many bits. Measured on the catalog: the same poster at another size
// differs by at most 9 of 144 bits, two different posters by at least 33.

const GRID = 12;
const BITS = GRID * GRID;
export const DUPLICATE_THRESHOLD = 16;

// A-paper proportions; uploads are cropped to this shape before they're stored.
const A_RATIO = Math.SQRT2;

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

// Cloudinary can serve a small copy, which is all a fingerprint needs.
export function smallImageUrl(url) {
  return url.includes("res.cloudinary.com") && url.includes("/upload/") ? url.replace("/upload/", "/upload/w_256/") : url;
}

// Average brightness of each block in a cols x rows grid over the cropped region.
function brightnessGrid(image, cols, rows, crop) {
  let sx = crop.x * image.width;
  let sy = crop.y * image.height;
  let width = crop.w * image.width;
  let height = crop.h * image.height;
  let source = image;

  // Halve in steps so every source pixel counts; a single big downscale skips pixels.
  while (width > 256 || height > 256) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width / 2));
    canvas.height = Math.max(1, Math.round(height / 2));
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sx, sy, width, height, 0, 0, canvas.width, canvas.height);
    source = canvas;
    sx = 0;
    sy = 0;
    width = canvas.width;
    height = canvas.height;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, sx, sy, width, height, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  const sums = new Float64Array(cols * rows);
  const counts = new Float64Array(cols * rows);
  for (let y = 0; y < canvas.height; y += 1) {
    const row = Math.min(rows - 1, Math.floor((y * rows) / canvas.height));
    for (let x = 0; x < canvas.width; x += 1) {
      const col = Math.min(cols - 1, Math.floor((x * cols) / canvas.width));
      const i = (y * canvas.width + x) * 4;
      sums[row * cols + col] += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      counts[row * cols + col] += 1;
    }
  }
  return sums.map((sum, index) => sum / (counts[index] || 1));
}

function differenceHash(image, crop = { x: 0, y: 0, w: 1, h: 1 }) {
  const grid = brightnessGrid(image, GRID + 1, GRID, crop);
  const bits = new Uint8Array(BITS);
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      bits[y * GRID + x] = grid[y * (GRID + 1) + x] < grid[y * (GRID + 1) + x + 1] ? 1 : 0;
    }
  }
  return bits;
}

// The part of the image an A-paper crop keeps, with focusY 0 (top) or 0.5 (centre).
function aPaperCrop(image, focusY) {
  const landscape = image.width > image.height;
  const target = landscape ? A_RATIO : 1 / A_RATIO;
  const actual = image.width / image.height;
  if (Math.abs(actual - target) < 0.005) return null;
  if (actual > target) {
    const w = target / actual;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = actual / target;
  return { x: 0, y: (1 - h) * focusY, w: 1, h };
}

// Fingerprints of the image as stored after each way an upload can crop it: as is,
// cropped to A-paper from the centre, or from the top.
export function artworkHashes(image) {
  const hashes = [differenceHash(image)];
  for (const focusY of [0.5, 0]) {
    const crop = aPaperCrop(image, focusY);
    if (crop) hashes.push(differenceHash(image, crop));
  }
  return hashes;
}

export function imageHash(image) {
  return differenceHash(image);
}

function distance(a, b) {
  let count = 0;
  for (let i = 0; i < BITS; i += 1) if (a[i] !== b[i]) count += 1;
  return count;
}

// Closest entry whose fingerprint matches any of the given ones, or null.
export function findDuplicate(hashes, entries) {
  let best = null;
  for (const entry of entries) {
    for (const hash of hashes) {
      for (const other of entry.hashes) {
        const d = distance(hash, other);
        if (d <= DUPLICATE_THRESHOLD && (!best || d < best.distance)) best = { entry, distance: d };
      }
    }
  }
  return best?.entry || null;
}
