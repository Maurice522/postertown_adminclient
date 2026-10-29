import React from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { downloadFile } from "../utils/posterMockups.js";

// Grid of generated product mockups. Selected ones are uploaded with the product.
export default function MockupGallery({ mockups, selected, onToggle, loading, error, note }) {
  if (!loading && !error && !mockups.length) return null;

  return (
    <section className="mockup-gallery">
      <div className="section-title-row">
        <h4>Product Mockups</h4>
        {loading && <span className="mockup-status"><Loader2 size={14} className="spin" /> Generating...</span>}
      </div>
      {note && <p className="mockup-note">{note}</p>}
      {error && <p className="mockup-note error-text">{error}</p>}
      <div className="mockup-grid">
        {mockups.map((mockup) => {
          const isSelected = selected.includes(mockup.key);
          return (
            <figure className={`mockup-card ${isSelected ? "selected" : ""}`} key={mockup.key}>
              <button type="button" className="mockup-image" onClick={() => onToggle(mockup.key)} title={isSelected ? "Don't upload this mockup" : "Upload this mockup"}>
                <img src={mockup.url} alt={mockup.label} />
                <span className="mockup-check">{isSelected && <Check size={14} />}</span>
              </button>
              <figcaption>
                <span>{mockup.label}</span>
                <button type="button" className="icon-button" onClick={() => downloadFile(mockup.file)} title="Download">
                  <Download size={15} />
                </button>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
