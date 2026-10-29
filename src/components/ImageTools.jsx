import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, PackagePlus, Scissors } from "lucide-react";
import { downloadFile, loadImage } from "../utils/posterMockups.js";
import { effectiveDpi, layoutPixels, paperSizes, renderPreview, renderProductImage, renderSheets } from "../utils/printLayout.js";

const defaultOptions = {
  paper: "A3",
  orientation: "portrait",
  panels: 1,
  direction: "horizontal",
  mode: "crop",
  background: "blur",
  focusX: 0.5,
  focusY: 0.5,
  dpi: 300
};

function baseNameOf(file) {
  return String(file?.name || "poster").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "poster";
}

function Choice({ label, value, options, onChange }) {
  return (
    <div className="tool-choice">
      <span>{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            type="button"
            key={String(option.value)}
            className={option.value === value ? "active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Fits artwork to A-series paper and optionally cuts it into 2-3 printable sheets.
export default function ImageTools({ onUseForProduct }) {
  const [file, setFile] = useState(null);
  const [image, setImage] = useState(null);
  const [options, setOptions] = useState(defaultOptions);
  const [sheets, setSheets] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const previewRef = useRef(null);

  const set = (key) => (value) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setSheets([]);
  };

  async function chooseFile(event) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setError("");
    setSheets([]);
    try {
      const loaded = await loadImage(chosen);
      setFile(chosen);
      setImage(loaded);
      // Start with the orientation that matches the artwork's shape.
      setOptions((current) => ({ ...current, orientation: loaded.width > loaded.height ? "landscape" : "portrait" }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const holder = previewRef.current;
    if (!holder || !image) return;
    const canvas = renderPreview(image, options, 900);
    canvas.className = "tool-preview-canvas";
    holder.replaceChildren(canvas);
  }, [image, options]);

  const [layoutW, layoutH] = layoutPixels(options);
  const dpiAtPrint = useMemo(() => (image ? effectiveDpi(image, options) : 0), [image, options]);
  const sheetLabel = `${options.paper} ${options.orientation}`;
  const sizeMm = paperSizes[options.paper];
  const [sheetMmW, sheetMmH] = options.orientation === "landscape" ? [sizeMm.height, sizeMm.width] : [sizeMm.width, sizeMm.height];
  const cropAxis = image && options.mode === "crop"
    ? (image.width / image.height > layoutW / layoutH ? "x" : "y")
    : "";

  async function handleRender() {
    setBusy("Rendering sheets at print resolution...");
    setError("");
    try {
      setSheets(await renderSheets(image, options, baseNameOf(file)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleUseForProduct() {
    setBusy("Preparing product image...");
    try {
      onUseForProduct(await renderProductImage(image, options, baseNameOf(file)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel wide-panel image-tools">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Print Prep</p>
          <h3>Ratio Fixer & Splitter</h3>
        </div>
        <label className="secondary-button file-button">
          <ImagePlus size={16} /> {file ? "Change Image" : "Choose Image"}
          <input type="file" accept="image/*" onChange={chooseFile} />
        </label>
      </div>

      {!image && (
        <label className="image-uploader tool-empty">
          <ImagePlus size={27} />
          <strong>Choose artwork to resize</strong>
          <span>Fit it to A5, A4, A3 or A2, or cut it into 2-3 sheets</span>
          <input type="file" accept="image/*" onChange={chooseFile} />
        </label>
      )}

      {image && (
        <div className="tool-layout">
          <div className="tool-controls">
            <Choice label="Paper" value={options.paper} onChange={set("paper")} options={Object.keys(paperSizes).map((key) => ({ value: key, label: key }))} />
            <Choice label="Sheet orientation" value={options.orientation} onChange={set("orientation")} options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />
            <Choice label="Split into" value={options.panels} onChange={set("panels")} options={[{ value: 1, label: "1 sheet" }, { value: 2, label: "2 sheets" }, { value: 3, label: "3 sheets" }]} />
            {options.panels > 1 && (
              <Choice label="Sheets placed" value={options.direction} onChange={set("direction")} options={[{ value: "horizontal", label: "Side by side" }, { value: "vertical", label: "Stacked" }]} />
            )}
            <Choice label="Fix ratio by" value={options.mode} onChange={set("mode")} options={[{ value: "crop", label: "Cropping" }, { value: "fit", label: "Adding border" }]} />
            {options.mode === "fit" && (
              <Choice label="Border" value={options.background} onChange={set("background")} options={[{ value: "blur", label: "Blurred art" }, { value: "white", label: "White" }, { value: "black", label: "Black" }]} />
            )}
            {cropAxis && (
              <label className="tool-slider">
                <span>{cropAxis === "x" ? "Crop position (left - right)" : "Crop position (top - bottom)"}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={cropAxis === "x" ? options.focusX : options.focusY}
                  onChange={(event) => set(cropAxis === "x" ? "focusX" : "focusY")(Number(event.target.value))}
                />
              </label>
            )}
            <Choice label="Resolution" value={options.dpi} onChange={set("dpi")} options={[{ value: 300, label: "300 DPI (print)" }, { value: 150, label: "150 DPI" }]} />

            <div className="tool-summary">
              <div><strong>Each sheet</strong><span>{sheetLabel} · {sheetMmW} × {sheetMmH} mm</span></div>
              <div>
                <strong>Output</strong>
                <span>{options.panels > 1 ? `${options.panels} files, each ` : ""}{layoutPixels({ ...options, panels: 1 }).join(" × ")} px</span>
              </div>
              <div>
                <strong>Source detail</strong>
                <span className={dpiAtPrint < 150 ? "error-text" : ""}>
                  {dpiAtPrint} DPI when printed{dpiAtPrint < 150 ? " - will look soft, use a larger image" : ""}
                </span>
              </div>
            </div>

            <div className="tool-actions">
              <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={handleRender}>
                <Scissors size={16} /> {options.panels > 1 ? `Cut into ${options.panels} sheets` : `Make ${options.paper} file`}
              </button>
              <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={handleUseForProduct}>
                <PackagePlus size={16} /> Use as product image
              </button>
            </div>
            {busy && <div className="loading-panel">{busy}</div>}
            {error && <p className="error-text">{error}</p>}
          </div>

          <div className="tool-preview">
            <div ref={previewRef} className="tool-preview-holder" />
            {sheets.length > 0 && (
              <div className="tool-results">
                {sheets.map((sheet) => (
                  <button type="button" className="secondary-button" key={sheet.name} onClick={() => downloadFile(sheet)}>
                    <Download size={15} /> {sheet.name} ({(sheet.size / 1024 / 1024).toFixed(1)} MB)
                  </button>
                ))}
                {sheets.length > 1 && (
                  <button type="button" className="primary-button" onClick={() => sheets.forEach((sheet, index) => setTimeout(() => downloadFile(sheet), index * 400))}>
                    <Download size={15} /> Download all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
