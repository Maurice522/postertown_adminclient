import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, ImagePlus, Loader2, RotateCcw, Trash2, Upload, XCircle } from "lucide-react";
import { createProductDraftFromImage } from "../services/api.js";
import { fitUploadLimit, generateMockups, loadImage } from "../utils/posterMockups.js";
import { renderProductImage } from "../utils/printLayout.js";
import { artworkHashes, findDuplicate, imageHash, loadImageFromUrl, smallImageUrl } from "../utils/imageHash.js";

// Print resolution used when artwork is resized to a paper size. A4 at 150dpi is
// 1240 x 1754px, A2 is 2480 x 3508px.
const RESIZE_DPI = 150;

const RESIZE_OPTIONS = [
  { value: "none", label: "Keep original", hint: "Upload the image as it is" },
  { value: "A4", label: "Resize to A4", hint: "1240 × 1754 px" },
  { value: "A3", label: "Resize to A3", hint: "1754 × 2480 px" },
  { value: "A2", label: "Resize to A2", hint: "2480 × 3508 px" }
];

const CROP_OPTIONS = [
  { value: "center", label: "Crop evenly from all sides" },
  { value: "top", label: "Keep the top, crop the bottom" }
];

const STATUS_LABELS = {
  checking: "Checking for duplicates",
  duplicate: "Duplicate",
  waiting: "Waiting",
  resizing: "Resizing",
  mockups: "Creating mockups",
  details: "Generating details",
  uploading: "Uploading",
  done: "Uploaded",
  failed: "Failed"
};

const PARALLEL_OPTIONS = [1, 2, 3, 4, 5];

const BUSY_STATUSES = ["checking", "resizing", "mockups", "details", "uploading"];

let nextItemId = 1;

// Catalog fingerprints by image URL, kept across visits to the page.
const catalogHashCache = new Map();

function catalogImageHash(url) {
  if (!catalogHashCache.has(url)) {
    catalogHashCache.set(
      url,
      loadImageFromUrl(smallImageUrl(url))
        .then((image) => imageHash(image))
        .catch(() => null)
    );
  }
  return catalogHashCache.get(url);
}

// Runs task over items with at most `limit` running at once.
async function forEachLimited(items, limit, task) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await task(queue.shift());
  }));
}

// Crops the artwork to the A-paper shape (every A size shares it) and renders it at
// that paper's pixel size. The image's own orientation is kept.
async function resizeToPaper(file, paper, crop) {
  const image = await loadImage(file);
  const orientation = image.width > image.height ? "landscape" : "portrait";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "poster";
  return renderProductImage(
    image,
    { paper, orientation, dpi: RESIZE_DPI, panels: 1, direction: "horizontal", mode: "crop", focusX: 0.5, focusY: crop === "top" ? 0 : 0.5 },
    baseName,
    Infinity
  );
}

// Upload many posters at once: every image goes through the same steps as a single
// upload (optional resize, mockups, Gemini details) and is saved with the shared sizes.
export default function BulkUpload({ defaultSizes, products = [], onCreateProduct, onFinished }) {
  const [items, setItems] = useState([]);
  const [resize, setResize] = useState("A4");
  const [crop, setCrop] = useState("center");
  const [sizes, setSizes] = useState(() => defaultSizes.map((size) => ({ ...size, enabled: true })));
  const [parallel, setParallel] = useState(3);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Fingerprints of the catalog's main images, and of posters uploaded on this page.
  const catalogRef = useRef([]);
  const catalogReady = useRef(Promise.resolve());
  const uploadedRef = useRef([]);
  const [catalogCheck, setCatalogCheck] = useState({ checked: 0, total: 0 });

  useEffect(() => {
    const withImages = products.filter((product) => product.media?.featuredImage || product.media?.thumbnail);
    let cancelled = false;
    let checked = 0;
    setCatalogCheck({ checked: 0, total: withImages.length });
    catalogReady.current = (async () => {
      const entries = [];
      await forEachLimited(withImages, 6, async (product) => {
        const hash = await catalogImageHash(product.media.featuredImage || product.media.thumbnail);
        if (hash) entries.push({ label: product.name || product.id, hashes: [hash] });
        checked += 1;
        if (!cancelled) setCatalogCheck({ checked, total: withImages.length });
      });
      if (!cancelled) catalogRef.current = entries;
    })();
    return () => {
      cancelled = true;
    };
  }, [products]);

  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  const chosenSizes = sizes.filter((size) => size.enabled);
  const sizesValid = chosenSizes.length > 0 && chosenSizes.every((size) => Number(size.price) > 0);
  const pending = items.filter((item) => item.status === "waiting" || item.status === "failed");
  const doneCount = items.filter((item) => item.status === "done").length;
  const duplicateCount = items.filter((item) => item.status === "duplicate").length;
  const checking = items.some((item) => item.status === "checking");
  const catalogLoading = catalogCheck.checked < catalogCheck.total;

  function patchItem(id, changes) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function addFiles(event) {
    const files = [...event.target.files].filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    const added = files.map((file) => ({ id: nextItemId++, file, preview: URL.createObjectURL(file), status: "checking", error: "", name: "" }));
    setItems((current) => [...current, ...added]);
    checkForDuplicates(added);
  }

  // Marks new images that match a catalog poster or another image in this batch.
  async function checkForDuplicates(added) {
    await catalogReady.current;
    const addedIds = new Set(added.map((item) => item.id));
    const batch = itemsRef.current
      .filter((item) => !addedIds.has(item.id) && item.hashes && item.status !== "duplicate")
      .map((item) => ({ label: item.file.name, hashes: item.hashes }));

    for (const item of added) {
      let hashes;
      try {
        hashes = artworkHashes(await loadImage(item.file));
      } catch {
        // Unreadable here means unreadable for the upload too; that step reports it.
        patchItem(item.id, { status: "waiting" });
        continue;
      }
      const inCatalog = findDuplicate(hashes, [...catalogRef.current, ...uploadedRef.current]);
      const inBatch = inCatalog ? null : findDuplicate(hashes, batch);
      if (inCatalog || inBatch) {
        patchItem(item.id, {
          status: "duplicate",
          hashes,
          error: inCatalog ? `already in the catalog as "${inCatalog.label}"` : `same image as ${inBatch.label}`
        });
      } else {
        batch.push({ label: item.file.name, hashes });
        patchItem(item.id, { status: "waiting", hashes });
      }
    }
  }

  function uploadAnyway(id) {
    patchItem(id, { status: "waiting", error: "", allowDuplicate: true });
  }

  function removeDuplicates() {
    setItems((current) => {
      current.filter((item) => item.status === "duplicate").forEach((item) => URL.revokeObjectURL(item.preview));
      return current.filter((item) => item.status !== "duplicate");
    });
  }

  function removeItem(id) {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.id !== id);
    });
  }

  function clearUploaded() {
    setItems((current) => {
      current.filter((item) => item.status === "done").forEach((item) => URL.revokeObjectURL(item.preview));
      return current.filter((item) => item.status !== "done");
    });
  }

  function updateSize(index, key, value) {
    setSizes((current) => current.map((size, sizeIndex) => (sizeIndex === index ? { ...size, [key]: value } : size)));
  }

  async function processItem(item, productSizes) {
    let artwork = item.file;
    if (resize !== "none") {
      patchItem(item.id, { status: "resizing", error: "" });
      artwork = await resizeToPaper(item.file, resize, crop);
    }

    // Compare the poster as it will be stored; a crop can hide a match in the original.
    const hash = imageHash(await loadImage(artwork));
    if (!item.allowDuplicate) {
      const match = findDuplicate([hash], [...catalogRef.current, ...uploadedRef.current]);
      if (match) {
        patchItem(item.id, { status: "duplicate", error: `already in the catalog as "${match.label}"` });
        return false;
      }
    }

    patchItem(item.id, { status: "mockups", error: "" });
    const mockups = await generateMockups(artwork);
    mockups.forEach((mockup) => URL.revokeObjectURL(mockup.url));

    patchItem(item.id, { status: "details" });
    const draft = await createProductDraftFromImage(await fitUploadLimit(artwork));

    patchItem(item.id, { status: "uploading", name: draft.name || "" });
    await onCreateProduct(draft, productSizes, mockups.map((mockup) => mockup.file));
    uploadedRef.current.push({ label: draft.name || item.file.name, hashes: [hash] });
    patchItem(item.id, { status: "done" });
    return true;
  }

  // A few posters at a time: each worker takes the next waiting poster until none are
  // left. Kept small because every poster holds its mockups in memory and Gemini's
  // free tier limits requests per minute.
  async function start() {
    if (!sizesValid || !pending.length || checking) return;
    await catalogReady.current;
    const productSizes = chosenSizes.map(({ enabled, ...size }) => size);
    const queue = [...pending];
    let uploaded = 0;
    let limitReached = false;
    setRunning(true);
    setMessage("");

    async function worker() {
      while (queue.length && !limitReached) {
        const item = queue.shift();
        if (!itemsRef.current.some((entry) => entry.id === item.id)) continue;
        try {
          if (await processItem(item, productSizes)) uploaded += 1;
        } catch (err) {
          if (err.status === 429) {
            limitReached = true;
            patchItem(item.id, { status: "failed", error: "Gemini limit reached" });
            setMessage(`${err.message} The rest are still waiting; press Start again later.`);
          } else {
            patchItem(item.id, { status: "failed", error: err.message });
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));
    setRunning(false);
    if (uploaded) await onFinished(uploaded);
  }

  return (
    <section className="panel wide-panel bulk-upload">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Create</p>
          <h3>Bulk Upload</h3>
        </div>
      </div>

      <p className="bulk-intro">
        Each image is resized (if you choose to), gets its mockups, has its details written by Gemini, and is uploaded
        with the sizes and prices below. Several posters are processed at the same time.
      </p>

      <div className="bulk-step">
        <h4><span className="bulk-step-number">1</span> Choose images</h4>
        <label className="image-uploader bulk-dropzone">
          <ImagePlus size={27} />
          <strong>{items.length ? "Add more poster images" : "Choose poster images"}</strong>
          <span>Select several PNG, JPG or WEBP files at once. Posters already in the catalog are skipped.</span>
          <input type="file" accept="image/*" multiple onChange={addFiles} disabled={running} />
        </label>

        {catalogLoading && (
          <p className="bulk-catalog-check">
            <Loader2 size={14} className="spin" /> Reading {catalogCheck.total} catalog posters to spot duplicates ({catalogCheck.checked}/{catalogCheck.total})
          </p>
        )}

        {items.length > 0 && (
          <>
            <div className="bulk-list-head">
              <span>
                {items.length} image{items.length === 1 ? "" : "s"}
                {doneCount ? ` · ${doneCount} uploaded` : ""}
                {duplicateCount ? ` · ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}` : ""}
              </span>
              <span className="bulk-list-actions">
                {duplicateCount > 0 && !running && (
                  <button type="button" className="text-button" onClick={removeDuplicates}>Remove duplicates</button>
                )}
                {doneCount > 0 && !running && (
                  <button type="button" className="text-button" onClick={clearUploaded}>Clear uploaded</button>
                )}
              </span>
            </div>
            <ul className="bulk-items">
              {items.map((item) => (
                <li key={item.id} className={`bulk-item is-${item.status}`}>
                  <img src={item.preview} alt="" />
                  <div className="bulk-item-copy">
                    <strong title={item.file.name}>{item.name || item.file.name}</strong>
                    <span className="bulk-item-status">
                      {BUSY_STATUSES.includes(item.status) && <Loader2 size={14} className="spin" />}
                      {item.status === "done" && <CheckCircle2 size={14} />}
                      {item.status === "failed" && <XCircle size={14} />}
                      {item.status === "duplicate" && <Copy size={14} />}
                      {STATUS_LABELS[item.status]}
                      {item.error && `: ${item.error}`}
                    </span>
                  </div>
                  <div className="bulk-item-actions">
                    {!running && item.status === "duplicate" && (
                      <button type="button" className="text-button" onClick={() => uploadAnyway(item.id)}>Upload anyway</button>
                    )}
                    {!running && item.status !== "done" && (
                      <button type="button" className="icon-button" title="Remove" onClick={() => removeItem(item.id)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="bulk-step">
        <h4><span className="bulk-step-number">2</span> Resize</h4>
        <div className="bulk-options" role="radiogroup" aria-label="Resize">
          {RESIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={resize === option.value}
              className={`bulk-option${resize === option.value ? " active" : ""}`}
              disabled={running}
              onClick={() => setResize(option.value)}>
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>
        {resize !== "none" && (
          <label className="field bulk-crop">
            <span>Images that aren't A-paper shape are cropped</span>
            <select value={crop} onChange={(event) => setCrop(event.target.value)} disabled={running}>
              {CROP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="bulk-step">
        <h4><span className="bulk-step-number">3</span> Sizes and prices for every poster</h4>
        <div className="bulk-sizes">
          {sizes.map((size, index) => (
            <div key={size.type} className={`bulk-size${size.enabled ? " active" : ""}`}>
              <label className="bulk-size-toggle">
                <input type="checkbox" checked={size.enabled} disabled={running} onChange={(event) => updateSize(index, "enabled", event.target.checked)} />
                <span>
                  <strong>{size.paper} · {size.type}</strong>
                  <small>{size.inches} in</small>
                </span>
              </label>
              <label className="field">
                <span>Price (₹)</span>
                <input type="number" min="1" value={size.price} disabled={!size.enabled || running} onChange={(event) => updateSize(index, "price", event.target.value)} />
              </label>
              <label className="field">
                <span>Stock</span>
                <input type="number" min="0" value={size.stock} disabled={!size.enabled || running} onChange={(event) => updateSize(index, "stock", event.target.value)} />
              </label>
            </div>
          ))}
        </div>
        {!sizesValid && <p className="error-text">Pick at least one size and give each chosen size a price.</p>}
      </div>

      <label className="field bulk-parallel">
        <span>Posters processed at the same time</span>
        <select value={parallel} onChange={(event) => setParallel(Number(event.target.value))} disabled={running}>
          {PARALLEL_OPTIONS.map((count) => (
            <option key={count} value={count}>{count === 1 ? "1 (one after another)" : count}</option>
          ))}
        </select>
      </label>

      {message && <div className="loading-panel">{message}</div>}

      <button type="button" className="primary-button" disabled={running || checking || !sizesValid || !pending.length} onClick={start}>
        {running ? <Loader2 size={16} className="spin" /> : pending.some((item) => item.status === "failed") ? <RotateCcw size={16} /> : <Upload size={16} />}
        {running
          ? "Uploading…"
          : pending.length
            ? `Start: upload ${pending.length} poster${pending.length === 1 ? "" : "s"}`
            : "Add images to upload"}
      </button>
    </section>
  );
}
