import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, RotateCcw, Trash2, Upload, XCircle } from "lucide-react";
import { createProductDraftFromImage } from "../services/api.js";
import { fitUploadLimit, generateMockups, loadImage } from "../utils/posterMockups.js";
import { renderProductImage } from "../utils/printLayout.js";

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
  waiting: "Waiting",
  resizing: "Resizing",
  mockups: "Creating mockups",
  details: "Generating details",
  uploading: "Uploading",
  done: "Uploaded",
  failed: "Failed"
};

const BUSY_STATUSES = ["resizing", "mockups", "details", "uploading"];

let nextItemId = 1;

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
export default function BulkUpload({ defaultSizes, onCreateProduct, onFinished }) {
  const [items, setItems] = useState([]);
  const [resize, setResize] = useState("A4");
  const [crop, setCrop] = useState("center");
  const [sizes, setSizes] = useState(() => defaultSizes.map((size) => ({ ...size, enabled: true })));
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  const chosenSizes = sizes.filter((size) => size.enabled);
  const sizesValid = chosenSizes.length > 0 && chosenSizes.every((size) => Number(size.price) > 0);
  const pending = items.filter((item) => item.status === "waiting" || item.status === "failed");
  const doneCount = items.filter((item) => item.status === "done").length;

  function patchItem(id, changes) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function addFiles(event) {
    const files = [...event.target.files].filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    setItems((current) => [
      ...current,
      ...files.map((file) => ({ id: nextItemId++, file, preview: URL.createObjectURL(file), status: "waiting", error: "", name: "" }))
    ]);
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

    patchItem(item.id, { status: "mockups", error: "" });
    const mockups = await generateMockups(artwork);
    mockups.forEach((mockup) => URL.revokeObjectURL(mockup.url));

    patchItem(item.id, { status: "details" });
    const draft = await createProductDraftFromImage(await fitUploadLimit(artwork));

    patchItem(item.id, { status: "uploading", name: draft.name || "" });
    await onCreateProduct(draft, productSizes, mockups.map((mockup) => mockup.file));
    patchItem(item.id, { status: "done" });
  }

  // One poster at a time: Gemini's free tier rejects bursts, and the browser only has
  // to hold one set of mockups in memory.
  async function start() {
    if (!sizesValid || !pending.length) return;
    const productSizes = chosenSizes.map(({ enabled, ...size }) => size);
    setRunning(true);
    setMessage("");
    let uploaded = 0;
    for (const item of pending) {
      if (!itemsRef.current.some((entry) => entry.id === item.id)) continue;
      try {
        await processItem(item, productSizes);
        uploaded += 1;
      } catch (err) {
        if (err.status === 429) {
          patchItem(item.id, { status: "failed", error: "Gemini limit reached" });
          setMessage("Gemini is rate limited (the free tier allows about 20 drafts a day). The rest are still waiting; press Start again later.");
          break;
        }
        patchItem(item.id, { status: "failed", error: err.message });
      }
    }
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
        with the sizes and prices below. Posters are processed one after another.
      </p>

      <div className="bulk-step">
        <h4><span className="bulk-step-number">1</span> Choose images</h4>
        <label className="image-uploader bulk-dropzone">
          <ImagePlus size={27} />
          <strong>{items.length ? "Add more poster images" : "Choose poster images"}</strong>
          <span>Select several PNG, JPG or WEBP files at once.</span>
          <input type="file" accept="image/*" multiple onChange={addFiles} disabled={running} />
        </label>

        {items.length > 0 && (
          <>
            <div className="bulk-list-head">
              <span>{items.length} image{items.length === 1 ? "" : "s"}{doneCount ? ` · ${doneCount} uploaded` : ""}</span>
              {doneCount > 0 && !running && (
                <button type="button" className="text-button" onClick={clearUploaded}>Clear uploaded</button>
              )}
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
                      {STATUS_LABELS[item.status]}
                      {item.error && `: ${item.error}`}
                    </span>
                  </div>
                  {!running && item.status !== "done" && (
                    <button type="button" className="icon-button" title="Remove" onClick={() => removeItem(item.id)}>
                      <Trash2 size={15} />
                    </button>
                  )}
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

      {message && <div className="loading-panel">{message}</div>}

      <button type="button" className="primary-button" disabled={running || !sizesValid || !pending.length} onClick={start}>
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
