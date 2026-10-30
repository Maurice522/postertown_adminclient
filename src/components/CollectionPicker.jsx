import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { listCollections } from "../services/api.js";

let cachedCollections;

// Toggle chips for product.collections. Gemini and the backend's keyword rules fill
// it on upload; the admin can switch collections on or off here.
export default function CollectionPicker({ form, setForm }) {
  const [collections, setCollections] = useState(cachedCollections || []);
  const [error, setError] = useState("");
  const selected = Array.isArray(form.collections) ? form.collections : null;

  useEffect(() => {
    if (cachedCollections) return;
    listCollections()
      .then((items) => {
        cachedCollections = items;
        setCollections(items);
      })
      .catch((err) => setError(err.message));
  }, []);

  function toggle(slug) {
    setForm((current) => {
      const currentSlugs = Array.isArray(current.collections) ? current.collections : [];
      const next = currentSlugs.includes(slug)
        ? currentSlugs.filter((item) => item !== slug)
        : [...currentSlugs, slug];
      return { ...current, collections: next };
    });
  }

  return (
    <section className="form-section collection-picker">
      <div className="section-title-row">
        <h4>Collections</h4>
        <span className="collection-picker-note">
          {selected
            ? `${selected.length} selected`
            : "Not set yet. Collections are assigned automatically when you save."}
        </span>
      </div>
      {error && <p className="error-text">Could not load collections: {error}</p>}
      <div className="collection-chips">
        {collections.map((collection) => {
          const active = selected?.includes(collection.slug);
          return (
            <button
              type="button"
              key={collection.slug}
              className={active ? "collection-chip active" : "collection-chip"}
              aria-pressed={Boolean(active)}
              onClick={() => toggle(collection.slug)}
            >
              {active && <Check size={13} />}
              {collection.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}
