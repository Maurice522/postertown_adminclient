import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Edit3,
  ImagePlus,
  LayoutGrid,
  PackagePlus,
  RefreshCcw,
  Save,
  Trash2,
  Upload
} from "lucide-react";
import {
  apiRoutes,
  createProduct,
  createProductDraftFromImage,
  deleteProduct,
  listProducts,
  updateProduct
} from "./services/api.js";
import "./styles.css";

const productTemplate = {
  id: "",
  sku: "",
  slug: "",
  name: "",
  subtitle: "",
  brand: "Poster Town",
  vendor: "",
  category: {
    main: "",
    subCategory: "",
    collection: ""
  },
  description: {
    short: "",
    full: "",
    features: []
  },
  media: {
    featuredImage: "",
    thumbnail: "",
    gallery: [],
    video: ""
  },
  pricing: {
    price: "",
    compareAtPrice: "",
    currency: "INR",
    discountPercent: "",
    taxInclusive: true
  },
  inventory: {
    stock: "",
    trackInventory: true,
    lowStockThreshold: "",
    allowBackorders: false,
    status: "in_stock"
  },
  urgency: {
    lowStock: false,
    stockLeft: ""
  },
  variants: [],
  specifications: {
    material: "",
    finish: "",
    orientation: "",
    shape: "",
    thickness: "",
    weight: "",
    mountType: ""
  },
  productAttributes: {
    waterproof: true,
    rustResistant: true,
    scratchResistant: true,
    fadeResistant: true
  },
  filterableAttributes: {
    animeSeries: "",
    character: "",
    theme: "",
    material: "",
    orientation: ""
  },
  filters: {
    theme: [],
    character: [],
    colorPalette: [],
    roomType: [],
    style: []
  },
  badges: [],
  ratings: {
    average: "",
    count: "",
    breakdown: {
      1: "",
      2: "",
      3: "",
      4: "",
      5: ""
    }
  },
  reviews: [],
  metrics: {
    salesCount: "",
    wishlistCount: "",
    viewCount: "",
    cartAdds: "",
    conversionRate: ""
  },
  socialProof: {
    currentlyViewing: "",
    popularThisWeek: false,
    trendingScore: ""
  },
  userState: {
    wishlisted: false,
    recentlyViewed: false,
    lastViewedAt: ""
  },
  shipping: {
    freeShipping: true,
    estimatedDelivery: "",
    dispatchTime: "",
    codAvailable: false
  },
  careInstructions: [],
  seo: {
    metaTitle: "",
    metaDescription: "",
    keywords: []
  },
  crossSell: {
    relatedProducts: [],
    frequentlyBoughtTogether: []
  },
  flags: {
    featured: false,
    newArrival: false,
    exclusive: false
  },
  compliance: {
    hsnCode: "",
    taxClass: ""
  },
  createdAt: "",
  updatedAt: "",
  sizes: []
};

const defaultVariants = [
  {
    id: "",
    sku: "",
    size: "",
    sizeType: "Small",
    price: "",
    stock: "",
    pricing: {
      price: "",
      compareAtPrice: "",
      currency: "INR",
      discountPercent: "",
      taxInclusive: true
    }
  }
];

const defaultSizes = [
  {
    id: "",
    type: "Small",
    inches: "",
    price: "",
    stock: "",
    sku: "",
    variantId: "",
    pricing: {
      price: "",
      compareAtPrice: "",
      currency: "INR",
      discountPercent: "",
      taxInclusive: true
    }
  }
];

const sizeTypes = ["Small", "Medium", "Large", "Extra Large"];

function cloneTemplate() {
  return structuredClone(productTemplate);
}

function mergeProduct(product) {
  return {
    ...cloneTemplate(),
    ...product,
    category: { ...productTemplate.category, ...(product.category || {}) },
    description: { ...productTemplate.description, ...(product.description || {}) },
    media: { ...productTemplate.media, ...(product.media || {}) },
    pricing: { ...productTemplate.pricing, ...(product.pricing || {}) },
    inventory: { ...productTemplate.inventory, ...(product.inventory || {}) },
    urgency: { ...productTemplate.urgency, ...(product.urgency || {}) },
    specifications: { ...productTemplate.specifications, ...(product.specifications || {}) },
    productAttributes: { ...productTemplate.productAttributes, ...(product.productAttributes || {}) },
    filterableAttributes: { ...productTemplate.filterableAttributes, ...(product.filterableAttributes || {}) },
    filters: { ...productTemplate.filters, ...(product.filters || {}) },
    ratings: {
      ...productTemplate.ratings,
      ...(product.ratings || {}),
      breakdown: { ...productTemplate.ratings.breakdown, ...(product.ratings?.breakdown || {}) }
    },
    metrics: { ...productTemplate.metrics, ...(product.metrics || {}) },
    socialProof: { ...productTemplate.socialProof, ...(product.socialProof || {}) },
    userState: { ...productTemplate.userState, ...(product.userState || {}) },
    shipping: { ...productTemplate.shipping, ...(product.shipping || {}) },
    seo: { ...productTemplate.seo, ...(product.seo || {}) },
    crossSell: { ...productTemplate.crossSell, ...(product.crossSell || {}) },
    flags: { ...productTemplate.flags, ...(product.flags || {}) },
    compliance: { ...productTemplate.compliance, ...(product.compliance || {}) }
  };
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return value;
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

function splitLines(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object) ?? "";
}

function writePath(object, path, value) {
  const keys = path.split(".");
  const copy = structuredClone(object);
  let cursor = copy;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
  return copy;
}

function productPayload(form) {
  const payload = structuredClone(form);
  const discountPercent = 25;
  payload.description.features = splitLines(payload.description.features);
  payload.media.gallery = splitLines(payload.media.gallery);
  payload.filters.theme = splitLines(payload.filters.theme);
  payload.filters.character = splitLines(payload.filters.character);
  payload.filters.colorPalette = splitLines(payload.filters.colorPalette);
  payload.filters.roomType = splitLines(payload.filters.roomType);
  payload.filters.style = splitLines(payload.filters.style);
  payload.badges = splitLines(payload.badges);
  payload.careInstructions = splitLines(payload.careInstructions);
  payload.seo.keywords = splitLines(payload.seo.keywords);
  payload.crossSell.relatedProducts = splitLines(payload.crossSell.relatedProducts);
  payload.crossSell.frequentlyBoughtTogether = splitLines(payload.crossSell.frequentlyBoughtTogether);

  const normalizedSizes = payload.sizes
    .filter((size) => size.type && size.inches && size.price)
    .map((size) => {
      const price = toNumber(size.price);
      const compareAtPrice = price ? Math.round(Number(price) / (1 - discountPercent / 100)) : "";
      const safeType = String(size.type).toLowerCase().replace(/\s+/g, "-");
      const skuBase = String(payload.sku || payload.slug || payload.id || "poster").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      const variantId = `${payload.id}-var-${safeType}`;

      return {
        id: size.id || `${payload.id}-size-${safeType}`,
        type: size.type,
        inches: size.inches,
        price,
        stock: 25,
        sku: size.sku || `${skuBase}-${safeType.toUpperCase()}`,
        variantId,
        pricing: {
          price,
          compareAtPrice,
          currency: "INR",
          discountPercent,
          taxInclusive: true
        }
      };
    });

  payload.sizes = normalizedSizes;
  payload.variants = normalizedSizes.map((size) => ({
    id: size.variantId,
    sku: size.sku,
    size: size.inches,
    sizeType: size.type,
    price: size.price,
    stock: size.stock,
    pricing: size.pricing
  }));

  const primarySize = normalizedSizes[0];
  payload.pricing = {
    ...payload.pricing,
    price: primarySize?.pricing.price ?? toNumber(payload.pricing.price),
    compareAtPrice: primarySize?.pricing.compareAtPrice ?? toNumber(payload.pricing.compareAtPrice),
    currency: "INR",
    discountPercent: primarySize?.pricing.discountPercent ?? toNumber(payload.pricing.discountPercent),
    taxInclusive: true
  };
  payload.inventory = {
    ...payload.inventory,
    stock: normalizedSizes.reduce((total, size) => total + Number(size.stock || 0), 0),
    trackInventory: true,
    lowStockThreshold: 5,
    allowBackorders: false,
    status: "in_stock"
  };
  payload.urgency = {
    ...payload.urgency,
    lowStock: false,
    stockLeft: payload.inventory.stock
  };
  payload.socialProof.currentlyViewing = toNumber(payload.socialProof.currentlyViewing);
  payload.socialProof.trendingScore = toNumber(payload.socialProof.trendingScore);

  payload.variants = payload.variants.map((variant) => ({
    ...variant,
    price: toNumber(variant.price),
    stock: toNumber(variant.stock),
    pricing: {
      ...variant.pricing,
      price: toNumber(variant.pricing?.price),
      compareAtPrice: toNumber(variant.pricing?.compareAtPrice),
      discountPercent: toNumber(variant.pricing?.discountPercent)
    }
  }));

  payload.sizes = payload.sizes.map((size) => ({
    ...size,
    price: toNumber(size.price),
    stock: toNumber(size.stock),
    pricing: {
      ...size.pricing,
      price: toNumber(size.pricing?.price),
      compareAtPrice: toNumber(size.pricing?.compareAtPrice),
      discountPercent: toNumber(size.pricing?.discountPercent)
    }
  }));

  payload.updatedAt = payload.updatedAt || new Date().toISOString().slice(0, 10);
  delete payload.ratings;
  delete payload.reviews;
  delete payload.metrics;
  delete payload.socialProof;
  delete payload.userState;
  return payload;
}

function generateProductId(draft) {
  const base = String(draft?.slug || draft?.name || "poster")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "poster";

  return `${base}-${Date.now()}`;
}

function generateSku(product) {
  const source = String(product?.slug || product?.name || product?.id || "poster");
  const base = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "POSTER";
  const suffix = String(Date.now()).slice(-5);

  return `PT-${base}-${suffix}`;
}

function mergeAiDraft(current, draft) {
  const { id, ...draftWithoutId } = draft || {};
  const preserved = {
    id: current.id,
    pricing: current.pricing,
    inventory: current.inventory,
    urgency: current.urgency,
    variants: current.variants,
    sizes: current.sizes,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt
  };

  return mergeProduct({
    ...current,
    ...draftWithoutId,
    ...preserved,
    media: draftWithoutId.media || current.media
  });
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextField({ form, setForm, label, path, type = "text", required = false, placeholder = "" }) {
  return (
    <Field label={label}>
      <input
        required={required}
        type={type}
        value={readPath(form, path)}
        placeholder={placeholder}
        onChange={(event) => setForm((current) => writePath(current, path, event.target.value))}
      />
    </Field>
  );
}

function SelectField({ form, setForm, label, path, options }) {
  return (
    <Field label={label}>
      <select value={readPath(form, path)} onChange={(event) => setForm((current) => writePath(current, path, event.target.value))}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function LinesField({ form, setForm, label, path, rows = 4 }) {
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        value={joinLines(readPath(form, path))}
        onChange={(event) => setForm((current) => writePath(current, path, splitLines(event.target.value)))}
      />
    </Field>
  );
}

function ToggleField({ form, setForm, label, path }) {
  return (
    <label className="toggle-field">
      <input
        type="checkbox"
        checked={Boolean(readPath(form, path))}
        onChange={(event) => setForm((current) => writePath(current, path, event.target.checked))}
      />
      <span>{label}</span>
    </label>
  );
}

function removeGalleryImage(form, setForm, imageUrl) {
  setForm((current) => {
    const gallery = (current.media?.gallery || []).filter((url) => url !== imageUrl);
    const cloudinary = (current.media?.cloudinary || []).filter((image) => image.url !== imageUrl);
    const fallback = gallery[0] || "";
    const featuredImage = current.media?.featuredImage === imageUrl ? fallback : current.media?.featuredImage;
    const thumbnail = current.media?.thumbnail === imageUrl ? fallback : current.media?.thumbnail;

    return {
      ...current,
      media: {
        ...(current.media || {}),
        featuredImage,
        thumbnail,
        gallery,
        cloudinary
      }
    };
  });
}

function Section({ title, children }) {
  return (
    <section className="form-section">
      <h4>{title}</h4>
      <div className="form-grid">{children}</div>
    </section>
  );
}

function VariantEditor({ title, items, onChange, template }) {
  function updateItem(index, path, value) {
    const next = structuredClone(items);
    next[index] = writePath(next[index], path, value);
    onChange(next);
  }

  function addItem() {
    onChange([...items, structuredClone(template)]);
  }

  function removeItem(index) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="form-section">
      <div className="section-title-row">
        <h4>{title}</h4>
        <button type="button" className="secondary-button" onClick={addItem}>Add</button>
      </div>
      <div className="variant-stack">
        {items.map((item, index) => (
          <div className="variant-card" key={`${title}-${index}`}>
            <div className="form-grid">
              <Field label="ID">
                <input value={item.id || ""} onChange={(event) => updateItem(index, "id", event.target.value)} />
              </Field>
              <Field label="SKU">
                <input value={item.sku || ""} onChange={(event) => updateItem(index, "sku", event.target.value)} />
              </Field>
              {"size" in item && (
                <Field label="Size">
                  <input value={item.size || ""} onChange={(event) => updateItem(index, "size", event.target.value)} />
                </Field>
              )}
              {"sizeType" in item && (
                <Field label="Size Type">
                  <input value={item.sizeType || ""} onChange={(event) => updateItem(index, "sizeType", event.target.value)} />
                </Field>
              )}
              {"type" in item && (
                <Field label="Type">
                  <input value={item.type || ""} onChange={(event) => updateItem(index, "type", event.target.value)} />
                </Field>
              )}
              {"inches" in item && (
                <Field label="Inches">
                  <input value={item.inches || ""} onChange={(event) => updateItem(index, "inches", event.target.value)} />
                </Field>
              )}
              {"variantId" in item && (
                <Field label="Variant ID">
                  <input value={item.variantId || ""} onChange={(event) => updateItem(index, "variantId", event.target.value)} />
                </Field>
              )}
              <Field label="Price">
                <input type="number" value={item.price || ""} onChange={(event) => updateItem(index, "price", event.target.value)} />
              </Field>
              <Field label="Stock">
                <input type="number" value={item.stock || ""} onChange={(event) => updateItem(index, "stock", event.target.value)} />
              </Field>
              <Field label="Compare At">
                <input type="number" value={item.pricing?.compareAtPrice || ""} onChange={(event) => updateItem(index, "pricing.compareAtPrice", event.target.value)} />
              </Field>
              <Field label="Discount %">
                <input type="number" value={item.pricing?.discountPercent || ""} onChange={(event) => updateItem(index, "pricing.discountPercent", event.target.value)} />
              </Field>
            </div>
            <button type="button" className="text-button danger-text" onClick={() => removeItem(index)}>Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductForm({
  mode,
  form,
  setForm,
  images,
  setImages,
  additionalImages = [],
  setAdditionalImages = () => {},
  onSubmit,
  onGenerateDraft,
  loading,
  draftLoading,
  showImageTools = false
}) {
  return (
    <form className="product-form" onSubmit={onSubmit}>
      <Section title="Identity">
        <TextField form={form} setForm={setForm} label="Product ID" path="id" required />
        <TextField form={form} setForm={setForm} label="SKU" path="sku" />
        <TextField form={form} setForm={setForm} label="Slug" path="slug" />
        <TextField form={form} setForm={setForm} label="Name" path="name" required />
        <TextField form={form} setForm={setForm} label="Subtitle" path="subtitle" />
        <TextField form={form} setForm={setForm} label="Brand" path="brand" />
        <TextField form={form} setForm={setForm} label="Vendor" path="vendor" />
      </Section>

      <Section title="Category">
        <TextField form={form} setForm={setForm} label="Main" path="category.main" />
        <TextField form={form} setForm={setForm} label="Sub Category" path="category.subCategory" />
        <TextField form={form} setForm={setForm} label="Collection" path="category.collection" />
      </Section>

      <section className="form-section">
        <h4>Description</h4>
        <div className="form-grid">
          <TextField form={form} setForm={setForm} label="Short" path="description.short" />
          <LinesField form={form} setForm={setForm} label="Features" path="description.features" />
        </div>
        <Field label="Full Description">
          <textarea value={form.description.full} onChange={(event) => setForm((current) => writePath(current, "description.full", event.target.value))} />
        </Field>
      </section>

      <Section title="Media">
        <TextField form={form} setForm={setForm} label="Video URL" path="media.video" />
        {showImageTools && (
          <Field label="Replace Main Image">
            <label className="file-drop">
              <ImagePlus size={22} />
              <span>{images.length ? `${images.length} selected` : "Choose poster image"}</span>
              <input type="file" accept="image/*" multiple onChange={(event) => setImages([...event.target.files])} />
            </label>
          </Field>
        )}
        {showImageTools && (
          <div className="media-actions">
            <button type="button" className="secondary-button" disabled={!images.length || draftLoading} onClick={onGenerateDraft}>
              <ImagePlus size={20} /> {draftLoading ? "Generating..." : "Upload Image & Autofill"}
            </button>
          </div>
        )}
        {showImageTools && images[0] && (
          <img className="media-preview" src={URL.createObjectURL(images[0])} alt="Selected main replacement" />
        )}
        {form.media?.featuredImage && <img className="media-preview" src={form.media.featuredImage} alt={form.name || "Uploaded poster"} />}
      </Section>

      {showImageTools && Boolean(form.media?.gallery?.length) && (
        <section className="form-section">
          <h4>Current Gallery Images</h4>
          <div className="gallery-preview-grid">
            {form.media.gallery.map((imageUrl, index) => (
              <div className="gallery-preview-item" key={`${imageUrl}-${index}`}>
                <img src={imageUrl} alt={`Gallery ${index + 1}`} />
                {imageUrl === form.media?.featuredImage ? (
                  <span className="main-image-badge">Main</span>
                ) : (
                  <button type="button" className="icon-button danger" onClick={() => removeGalleryImage(form, setForm, imageUrl)} title="Remove image">
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showImageTools && <AdditionalImages files={additionalImages} setFiles={setAdditionalImages} />}

      <Section title="Pricing & Inventory">
        <TextField form={form} setForm={setForm} label="Price" path="pricing.price" type="number" />
        <TextField form={form} setForm={setForm} label="Compare At Price" path="pricing.compareAtPrice" type="number" />
        <TextField form={form} setForm={setForm} label="Currency" path="pricing.currency" />
        <TextField form={form} setForm={setForm} label="Discount Percent" path="pricing.discountPercent" type="number" />
        <TextField form={form} setForm={setForm} label="Stock" path="inventory.stock" type="number" />
        <TextField form={form} setForm={setForm} label="Low Stock Threshold" path="inventory.lowStockThreshold" type="number" />
        <SelectField
          form={form}
          setForm={setForm}
          label="Inventory Status"
          path="inventory.status"
          options={[
            { value: "in_stock", label: "In Stock" },
            { value: "low_stock", label: "Low Stock" },
            { value: "out_of_stock", label: "Out of Stock" }
          ]}
        />
        <TextField form={form} setForm={setForm} label="Stock Left" path="urgency.stockLeft" type="number" />
      </Section>

      <section className="toggle-grid">
        <ToggleField form={form} setForm={setForm} label="Tax Inclusive" path="pricing.taxInclusive" />
        <ToggleField form={form} setForm={setForm} label="Track Inventory" path="inventory.trackInventory" />
        <ToggleField form={form} setForm={setForm} label="Allow Backorders" path="inventory.allowBackorders" />
        <ToggleField form={form} setForm={setForm} label="Low Stock Urgency" path="urgency.lowStock" />
      </section>

      <VariantEditor
        title="Sizes"
        items={form.sizes}
        template={defaultSizes[0]}
        onChange={(items) => setForm((current) => ({ ...current, sizes: items }))}
      />

      <Section title="Specifications">
        <TextField form={form} setForm={setForm} label="Material" path="specifications.material" />
        <TextField form={form} setForm={setForm} label="Finish" path="specifications.finish" />
        <SelectField
          form={form}
          setForm={setForm}
          label="Orientation"
          path="specifications.orientation"
          options={[
            { value: "", label: "Select orientation" },
            { value: "Portrait", label: "Portrait" },
            { value: "Horizontal", label: "Horizontal" }
          ]}
        />
        <TextField form={form} setForm={setForm} label="Shape" path="specifications.shape" />
        <TextField form={form} setForm={setForm} label="Thickness" path="specifications.thickness" />
        <TextField form={form} setForm={setForm} label="Weight" path="specifications.weight" />
        <TextField form={form} setForm={setForm} label="Mount Type" path="specifications.mountType" />
      </Section>

      <section className="toggle-grid">
        <ToggleField form={form} setForm={setForm} label="Waterproof" path="productAttributes.waterproof" />
        <ToggleField form={form} setForm={setForm} label="Rust Resistant" path="productAttributes.rustResistant" />
        <ToggleField form={form} setForm={setForm} label="Scratch Resistant" path="productAttributes.scratchResistant" />
        <ToggleField form={form} setForm={setForm} label="Fade Resistant" path="productAttributes.fadeResistant" />
      </section>

      <Section title="Filters">
        <TextField form={form} setForm={setForm} label="Anime Series" path="filterableAttributes.animeSeries" />
        <TextField form={form} setForm={setForm} label="Character" path="filterableAttributes.character" />
        <TextField form={form} setForm={setForm} label="Theme" path="filterableAttributes.theme" />
        <TextField form={form} setForm={setForm} label="Material" path="filterableAttributes.material" />
        <SelectField
          form={form}
          setForm={setForm}
          label="Orientation"
          path="filterableAttributes.orientation"
          options={[
            { value: "", label: "Select orientation" },
            { value: "Portrait", label: "Portrait" },
            { value: "Horizontal", label: "Horizontal" }
          ]}
        />
        <LinesField form={form} setForm={setForm} label="Theme Filters" path="filters.theme" />
        <LinesField form={form} setForm={setForm} label="Character Filters" path="filters.character" />
        <LinesField form={form} setForm={setForm} label="Color Palette" path="filters.colorPalette" />
        <LinesField form={form} setForm={setForm} label="Room Type" path="filters.roomType" />
        <LinesField form={form} setForm={setForm} label="Style" path="filters.style" />
        <LinesField form={form} setForm={setForm} label="Badges" path="badges" />
      </Section>

      <Section title="Shipping, SEO & Flags">
        <TextField form={form} setForm={setForm} label="Estimated Delivery" path="shipping.estimatedDelivery" />
        <TextField form={form} setForm={setForm} label="Dispatch Time" path="shipping.dispatchTime" />
        <LinesField form={form} setForm={setForm} label="Care Instructions" path="careInstructions" />
        <TextField form={form} setForm={setForm} label="SEO Title" path="seo.metaTitle" />
        <TextField form={form} setForm={setForm} label="SEO Description" path="seo.metaDescription" />
        <LinesField form={form} setForm={setForm} label="SEO Keywords" path="seo.keywords" />
        <LinesField form={form} setForm={setForm} label="Related Products" path="crossSell.relatedProducts" />
        <LinesField form={form} setForm={setForm} label="Frequently Bought Together" path="crossSell.frequentlyBoughtTogether" />
        <TextField form={form} setForm={setForm} label="HSN Code" path="compliance.hsnCode" />
        <TextField form={form} setForm={setForm} label="Tax Class" path="compliance.taxClass" />
      </Section>

      <section className="toggle-grid">
        <ToggleField form={form} setForm={setForm} label="Free Shipping" path="shipping.freeShipping" />
        <ToggleField form={form} setForm={setForm} label="COD Available" path="shipping.codAvailable" />
        <ToggleField form={form} setForm={setForm} label="Featured" path="flags.featured" />
        <ToggleField form={form} setForm={setForm} label="New Arrival" path="flags.newArrival" />
        <ToggleField form={form} setForm={setForm} label="Exclusive" path="flags.exclusive" />
      </section>

      <button className="primary-button sticky-submit" disabled={loading}>
        {mode === "edit" ? <Save size={22} /> : <Upload size={22} />}
        {mode === "edit" ? "Save Product" : "Upload Product"}
      </button>
    </form>
  );
}

function ProductCard({ product, onEdit, onDelete }) {
  const image = product.media?.thumbnail || product.media?.featuredImage || "/placeholder.svg";
  return (
    <article className="product-card">
      <img src={image} alt={product.name || "Product"} />
      <div className="product-card-body">
        <div>
          <h3>{product.name || "Untitled product"}</h3>
          <p>{product.subtitle || product.description?.short || product.id}</p>
        </div>
        <div className="product-meta">
          <span>{product.category?.main || "No category"}</span>
          <span>{product.pricing?.currency || "INR"} {product.pricing?.price || 0}</span>
          <span>{product.inventory?.status || "stock unknown"}</span>
        </div>
        <div className="row-actions">
          <button className="secondary-button" onClick={() => onEdit(product)}>
            <Edit3 size={18} /> Edit
          </button>
          <button className="secondary-button danger-button" onClick={() => onDelete(product.id)}>
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function ImageDraftStep({ images, setImages, imagePreview, setImagePreview, onGenerateDraft, draftLoading }) {
  function chooseImage(event) {
    const files = [...event.target.files];
    setImages(files);
    setImagePreview(files[0] ? URL.createObjectURL(files[0]) : "");
  }

  return (
    <section className="draft-step">
      <div className="draft-copy">
        <p className="eyebrow">Step 1</p>
        <h3>Upload Main Poster Image</h3>
        <p>Gemini will inspect this image and prepare the poster details. After that, you can review the generated form and add pricing, sizes, variants, stock, and discount details.</p>
      </div>

      <label className={`image-uploader ${imagePreview ? "has-preview" : ""}`}>
        {imagePreview ? (
          <img src={imagePreview} alt="Selected poster preview" />
        ) : (
          <>
            <ImagePlus size={36} />
            <strong>Choose main poster image</strong>
            <span>PNG, JPG, or WEBP up to 5MB</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={chooseImage} />
      </label>

      <button className="primary-button" disabled={!images.length || draftLoading} onClick={onGenerateDraft}>
        <Upload size={22} />
        {draftLoading ? "Uploading & Generating..." : "Upload Image & Generate Details"}
      </button>
      {draftLoading && <div className="loading-panel">Gemini is reading the poster and preparing the product details. This can take a moment.</div>}
    </section>
  );
}

function SizeRows({ sizes, setSizes }) {
  function updateSize(index, key, value) {
    const next = structuredClone(sizes);
    next[index] = { ...next[index], [key]: value };
    setSizes(next);
  }

  function addSize() {
    setSizes([...sizes, { type: "Small", inches: "", price: "" }]);
  }

  function removeSize(index) {
    setSizes(sizes.filter((_, sizeIndex) => sizeIndex !== index));
  }

  return (
    <section className="form-section">
      <div className="section-title-row">
        <h4>Sizes</h4>
        <button type="button" className="secondary-button" onClick={addSize}>Add Size</button>
      </div>
      <div className="variant-stack">
        {sizes.map((size, index) => (
          <div className="variant-card compact-variant" key={`size-${index}`}>
            <div className="form-grid">
              <Field label="Type">
                <select value={size.type} onChange={(event) => updateSize(index, "type", event.target.value)}>
                  {sizeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Inches">
                <input value={size.inches || ""} placeholder="12 x 9" onChange={(event) => updateSize(index, "inches", event.target.value)} />
              </Field>
              <Field label="Price">
                <input type="number" value={size.price || ""} placeholder="999" onChange={(event) => updateSize(index, "price", event.target.value)} />
              </Field>
            </div>
            {sizes.length > 1 && <button type="button" className="text-button danger-text" onClick={() => removeSize(index)}>Remove</button>}
          </div>
        ))}
      </div>
    </section>
  );
}

function AdditionalImages({ files, setFiles }) {
  function updateFile(index, fileList) {
    const next = [...files];
    next[index] = fileList[0];
    setFiles(next.filter(Boolean));
  }

  function addSlot() {
    setFiles([...files, null]);
  }

  function removeSlot(index) {
    setFiles(files.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <section className="form-section">
      <div className="section-title-row">
        <h4>Additional Images</h4>
        <button type="button" className="secondary-button" onClick={addSlot}>Add Image</button>
      </div>
      <div className="extra-image-list">
        {!files.length && (
          <button type="button" className="image-add-tile" onClick={addSlot}>
            <ImagePlus size={28} />
            <span>Add additional product image</span>
          </button>
        )}
        {files.map((file, index) => (
          <div className="extra-image-row" key={`extra-${index}`}>
            {file && <img className="extra-image-preview" src={URL.createObjectURL(file)} alt={`Additional ${index + 1}`} />}
            <label className="file-drop">
              <ImagePlus size={22} />
              <span>{file?.name || "Choose additional image"}</span>
              <input type="file" accept="image/*" onChange={(event) => updateFile(index, [...event.target.files])} />
            </label>
            <button type="button" className="icon-button danger" onClick={() => removeSlot(index)} title="Remove image">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function GeneratedDetailsForm({ form, setForm, sizes, setSizes, additionalImages, setAdditionalImages, onReview }) {
  return (
    <form className="product-form" onSubmit={(event) => { event.preventDefault(); onReview(); }}>
      <Section title="Identity">
        <TextField form={form} setForm={setForm} label="Product ID" path="id" required />
        <TextField form={form} setForm={setForm} label="SKU" path="sku" />
        <TextField form={form} setForm={setForm} label="Slug" path="slug" />
        <TextField form={form} setForm={setForm} label="Name" path="name" required />
        <TextField form={form} setForm={setForm} label="Subtitle" path="subtitle" />
        <TextField form={form} setForm={setForm} label="Category" path="category.main" />
        <TextField form={form} setForm={setForm} label="Sub Category" path="category.subCategory" />
        <TextField form={form} setForm={setForm} label="Collection" path="category.collection" />
      </Section>

      {form.media?.featuredImage && <img className="media-preview large-preview" src={form.media.featuredImage} alt={form.name || "Generated poster"} />}

      <section className="form-section">
        <h4>Generated Copy</h4>
        <div className="form-grid">
          <TextField form={form} setForm={setForm} label="Short Description" path="description.short" />
          <LinesField form={form} setForm={setForm} label="Features" path="description.features" />
        </div>
        <Field label="Full Description">
          <textarea value={form.description.full} onChange={(event) => setForm((current) => writePath(current, "description.full", event.target.value))} />
        </Field>
      </section>

      <Section title="Media">
        <TextField form={form} setForm={setForm} label="Video URL" path="media.video" />
      </Section>

      <Section title="Specifications">
        <TextField form={form} setForm={setForm} label="Material" path="specifications.material" />
        <TextField form={form} setForm={setForm} label="Finish" path="specifications.finish" />
        <TextField form={form} setForm={setForm} label="Orientation" path="specifications.orientation" />
        <TextField form={form} setForm={setForm} label="Shape" path="specifications.shape" />
        <TextField form={form} setForm={setForm} label="Thickness" path="specifications.thickness" />
        <TextField form={form} setForm={setForm} label="Weight" path="specifications.weight" />
        <TextField form={form} setForm={setForm} label="Mount Type" path="specifications.mountType" />
      </Section>

      <section className="toggle-grid">
        <ToggleField form={form} setForm={setForm} label="Waterproof" path="productAttributes.waterproof" />
        <ToggleField form={form} setForm={setForm} label="Rust Resistant" path="productAttributes.rustResistant" />
        <ToggleField form={form} setForm={setForm} label="Scratch Resistant" path="productAttributes.scratchResistant" />
        <ToggleField form={form} setForm={setForm} label="Fade Resistant" path="productAttributes.fadeResistant" />
      </section>

      <Section title="Filters">
        <TextField form={form} setForm={setForm} label="Anime Series" path="filterableAttributes.animeSeries" />
        <TextField form={form} setForm={setForm} label="Character" path="filterableAttributes.character" />
        <TextField form={form} setForm={setForm} label="Theme" path="filterableAttributes.theme" />
        <TextField form={form} setForm={setForm} label="Material" path="filterableAttributes.material" />
        <TextField form={form} setForm={setForm} label="Orientation" path="filterableAttributes.orientation" />
        <LinesField form={form} setForm={setForm} label="Theme Filters" path="filters.theme" />
        <LinesField form={form} setForm={setForm} label="Character Filters" path="filters.character" />
        <LinesField form={form} setForm={setForm} label="Color Palette" path="filters.colorPalette" />
        <LinesField form={form} setForm={setForm} label="Room Type" path="filters.roomType" />
        <LinesField form={form} setForm={setForm} label="Style" path="filters.style" />
        <LinesField form={form} setForm={setForm} label="Badges" path="badges" />
      </Section>

      <SizeRows sizes={sizes} setSizes={setSizes} />
      <AdditionalImages files={additionalImages} setFiles={setAdditionalImages} />

      <Section title="Shipping, SEO & Flags">
        <TextField form={form} setForm={setForm} label="Estimated Delivery" path="shipping.estimatedDelivery" />
        <TextField form={form} setForm={setForm} label="Dispatch Time" path="shipping.dispatchTime" />
        <LinesField form={form} setForm={setForm} label="Care Instructions" path="careInstructions" />
        <TextField form={form} setForm={setForm} label="SEO Title" path="seo.metaTitle" />
        <TextField form={form} setForm={setForm} label="SEO Description" path="seo.metaDescription" />
        <LinesField form={form} setForm={setForm} label="SEO Keywords" path="seo.keywords" />
        <LinesField form={form} setForm={setForm} label="Related Products" path="crossSell.relatedProducts" />
        <LinesField form={form} setForm={setForm} label="Frequently Bought Together" path="crossSell.frequentlyBoughtTogether" />
        <TextField form={form} setForm={setForm} label="HSN Code" path="compliance.hsnCode" />
        <TextField form={form} setForm={setForm} label="Tax Class" path="compliance.taxClass" />
      </Section>

      <section className="toggle-grid">
        <ToggleField form={form} setForm={setForm} label="Free Shipping" path="shipping.freeShipping" />
        <ToggleField form={form} setForm={setForm} label="COD Available" path="shipping.codAvailable" />
        <ToggleField form={form} setForm={setForm} label="Featured" path="flags.featured" />
        <ToggleField form={form} setForm={setForm} label="New Arrival" path="flags.newArrival" />
        <ToggleField form={form} setForm={setForm} label="Exclusive" path="flags.exclusive" />
      </section>

      <button className="primary-button sticky-submit">
        <Save size={22} /> Go To Review
      </button>
    </form>
  );
}

function ProductReview({ form, sizes, additionalImages, onBack, onUpload, loading }) {
  const payload = productPayload({ ...form, sizes });

  return (
    <section className="review-layout">
      <div className="review-hero">
        <img src={form.media?.featuredImage || "/placeholder.svg"} alt={form.name || "Product"} />
        <div>
          <p className="eyebrow">Step 3</p>
          <h3>{form.name}</h3>
          <p>{form.description?.short}</p>
        </div>
      </div>
      <div className="review-grid">
        <div><strong>Product ID</strong><span>{form.id}</span></div>
        <div><strong>SKU</strong><span>{form.sku}</span></div>
        <div><strong>Category</strong><span>{form.category?.main}</span></div>
        <div><strong>Extra Images</strong><span>{additionalImages.filter(Boolean).length}</span></div>
      </div>
      <div className="review-sizes">
        {sizes.map((size, index) => (
          <div key={`review-size-${index}`}>
            <strong>{size.type}</strong>
            <span>{size.inches}</span>
            <span>INR {size.price}</span>
          </div>
        ))}
      </div>
      <ReadOnlyDetails payload={payload} />
      <div className="review-actions">
        <button type="button" className="secondary-button" onClick={onBack}>Back & Edit</button>
        <button type="button" className="primary-button" disabled={loading} onClick={onUpload}>
          <Upload size={22} /> {loading ? "Uploading..." : "Upload Product"}
        </button>
      </div>
    </section>
  );
}

function ReviewValue({ label, value }) {
  return (
    <div className="review-field">
      <strong>{label}</strong>
      <span>{Array.isArray(value) ? value.join(", ") : String(value ?? "")}</span>
    </div>
  );
}

function ReadOnlyDetails({ payload }) {
  return (
    <section className="readonly-details">
      <section className="form-section">
        <h4>Identity</h4>
        <div className="review-grid">
          <ReviewValue label="Product ID" value={payload.id} />
          <ReviewValue label="SKU" value={payload.sku} />
          <ReviewValue label="Slug" value={payload.slug} />
          <ReviewValue label="Name" value={payload.name} />
          <ReviewValue label="Subtitle" value={payload.subtitle} />
          <ReviewValue label="Brand" value={payload.brand} />
          <ReviewValue label="Vendor" value={payload.vendor} />
        </div>
      </section>

      <section className="form-section">
        <h4>Category & Description</h4>
        <div className="review-grid">
          <ReviewValue label="Category" value={payload.category?.main} />
          <ReviewValue label="Sub Category" value={payload.category?.subCategory} />
          <ReviewValue label="Collection" value={payload.category?.collection} />
          <ReviewValue label="Short Description" value={payload.description?.short} />
          <ReviewValue label="Features" value={payload.description?.features} />
        </div>
        <div className="review-field full-review-field">
          <strong>Full Description</strong>
          <span>{payload.description?.full}</span>
        </div>
      </section>

      <section className="form-section">
        <h4>Pricing, Sizes & Inventory</h4>
        <div className="review-grid">
          <ReviewValue label="Base Price" value={payload.pricing?.price} />
          <ReviewValue label="Compare At" value={payload.pricing?.compareAtPrice} />
          <ReviewValue label="Discount %" value={payload.pricing?.discountPercent} />
          <ReviewValue label="Currency" value={payload.pricing?.currency} />
          <ReviewValue label="Total Stock" value={payload.inventory?.stock} />
          <ReviewValue label="Inventory Status" value={payload.inventory?.status} />
        </div>
        <div className="review-sizes">
          {payload.sizes.map((size) => (
            <div key={size.id}>
              <strong>{size.type}</strong>
              <span>{size.inches}</span>
              <span>INR {size.price}</span>
              <span>{size.sku}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h4>Specifications & Attributes</h4>
        <div className="review-grid">
          <ReviewValue label="Material" value={payload.specifications?.material} />
          <ReviewValue label="Finish" value={payload.specifications?.finish} />
          <ReviewValue label="Orientation" value={payload.specifications?.orientation} />
          <ReviewValue label="Shape" value={payload.specifications?.shape} />
          <ReviewValue label="Thickness" value={payload.specifications?.thickness} />
          <ReviewValue label="Weight" value={payload.specifications?.weight} />
          <ReviewValue label="Mount Type" value={payload.specifications?.mountType} />
          <ReviewValue label="Waterproof" value={payload.productAttributes?.waterproof ? "Yes" : "No"} />
          <ReviewValue label="Rust Resistant" value={payload.productAttributes?.rustResistant ? "Yes" : "No"} />
          <ReviewValue label="Scratch Resistant" value={payload.productAttributes?.scratchResistant ? "Yes" : "No"} />
          <ReviewValue label="Fade Resistant" value={payload.productAttributes?.fadeResistant ? "Yes" : "No"} />
        </div>
      </section>

      <section className="form-section">
        <h4>Filters & SEO</h4>
        <div className="review-grid">
          <ReviewValue label="Anime Series" value={payload.filterableAttributes?.animeSeries} />
          <ReviewValue label="Character" value={payload.filterableAttributes?.character} />
          <ReviewValue label="Theme" value={payload.filterableAttributes?.theme} />
          <ReviewValue label="Room Types" value={payload.filters?.roomType} />
          <ReviewValue label="Styles" value={payload.filters?.style} />
          <ReviewValue label="Badges" value={payload.badges} />
          <ReviewValue label="SEO Title" value={payload.seo?.metaTitle} />
          <ReviewValue label="SEO Description" value={payload.seo?.metaDescription} />
          <ReviewValue label="SEO Keywords" value={payload.seo?.keywords} />
        </div>
      </section>

      <section className="form-section">
        <h4>Shipping & Compliance</h4>
        <div className="review-grid">
          <ReviewValue label="Free Shipping" value={payload.shipping?.freeShipping ? "Yes" : "No"} />
          <ReviewValue label="COD Available" value={payload.shipping?.codAvailable ? "Yes" : "No"} />
          <ReviewValue label="Estimated Delivery" value={payload.shipping?.estimatedDelivery} />
          <ReviewValue label="Dispatch Time" value={payload.shipping?.dispatchTime} />
          <ReviewValue label="Care Instructions" value={payload.careInstructions} />
          <ReviewValue label="HSN Code" value={payload.compliance?.hsnCode} />
          <ReviewValue label="Tax Class" value={payload.compliance?.taxClass} />
        </div>
      </section>
    </section>
  );
}

function App() {
  const [page, setPage] = useState("upload");
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(() => cloneTemplate());
  const [images, setImages] = useState([]);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadStep, setUploadStep] = useState("image");
  const [sizes, setSizes] = useState([{ type: "Small", inches: "", price: "" }]);
  const [additionalImages, setAdditionalImages] = useState([]);
  const [editAdditionalImages, setEditAdditionalImages] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingId),
    [editingId, products]
  );

  async function refreshProducts() {
    setLoading(true);
    setError("");
    try {
      setProducts(await listProducts());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProducts();
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setForm(mergeProduct(editingProduct));
      setImages([]);
      setEditAdditionalImages([]);
    }
  }, [editingProduct]);

  function resetUpload() {
    setForm(cloneTemplate());
    setImages([]);
    setImagePreview("");
    setUploadStep("image");
    setSizes([{ type: "Small", inches: "", price: "" }]);
    setAdditionalImages([]);
  }

  async function handleUpload(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await createProduct(productPayload({ ...form, sizes }), additionalImages.filter(Boolean));
      setNotice("Product uploaded.");
      resetUpload();
      await refreshProducts();
      setPage("products");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDraft() {
    if (!images.length) {
      setError("Choose a poster image first.");
      return;
    }

    setDraftLoading(true);
    setError("");
    setNotice("");
    try {
      const draft = await createProductDraftFromImage(images[0]);
      setForm((current) => {
        const merged = mergeAiDraft(current, draft);
        return {
          ...merged,
          id: generateProductId(merged),
          sku: merged.sku || generateSku(merged),
          createdAt: merged.createdAt || new Date().toISOString().slice(0, 10)
        };
      });
      setImages([]);
      setImagePreview("");
      setUploadStep("details");
      setNotice("Image uploaded and product details generated.");
    } catch (err) {
      setError(err.status === 429 ? "Gemini is rate limited right now. Please try again after a few minutes." : err.message);
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!editingId) {
      setError("Choose a product to edit.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await updateProduct(editingId, productPayload(form), [...images, ...editAdditionalImages.filter(Boolean)]);
      setNotice("Product updated.");
      setImages([]);
      setEditAdditionalImages([]);
      await refreshProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productId) {
    if (!window.confirm("Delete this product?")) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await deleteProduct(productId);
      setNotice("Product deleted.");
      if (editingId === productId) {
        setEditingId("");
        setForm(cloneTemplate());
      }
      await refreshProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function goEdit(product) {
    setEditingId(product.id);
    setPage("edit");
  }

  const title = {
    upload: "Upload Product",
    edit: "Edit Product",
    products: "All Products"
  }[page];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Poster Town</p>
          <h1>Admin Console</h1>
        </div>
        <nav className="nav">
          <button className={page === "upload" ? "active" : ""} onClick={() => { setPage("upload"); resetUpload(); }}>
            <PackagePlus size={24} /> Upload Product
          </button>
          <button className={page === "edit" ? "active" : ""} onClick={() => setPage("edit")}>
            <Edit3 size={24} /> Edit Product
          </button>
          <button className={page === "products" ? "active" : ""} onClick={() => setPage("products")}>
            <LayoutGrid size={24} /> All Products
          </button>
        </nav>
        <div className="api-box">
          <span>API base</span>
          <strong>{apiRoutes.baseUrl}</strong>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Product Management</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={refreshProducts} disabled={loading} title="Refresh products">
            <RefreshCcw size={22} />
          </button>
        </header>

        {(notice || error) && <div className={`message ${error ? "error" : "success"}`}>{error || notice}</div>}

        {page === "upload" && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Create</p>
                <h3>{uploadStep === "image" ? "New Product" : uploadStep === "details" ? "Generated Product Details" : "Review Product"}</h3>
              </div>
            </div>
            {uploadStep === "image" && (
              <ImageDraftStep
                images={images}
                setImages={setImages}
                imagePreview={imagePreview}
                setImagePreview={setImagePreview}
                onGenerateDraft={handleGenerateDraft}
                draftLoading={draftLoading}
              />
            )}
            {uploadStep === "details" && (
              <GeneratedDetailsForm
                form={form}
                setForm={setForm}
                sizes={sizes}
                setSizes={setSizes}
                additionalImages={additionalImages}
                setAdditionalImages={setAdditionalImages}
                onReview={() => setUploadStep("review")}
              />
            )}
            {uploadStep === "review" && (
              <ProductReview
                form={form}
                sizes={sizes}
                additionalImages={additionalImages}
                onBack={() => setUploadStep("details")}
                onUpload={() => handleUpload()}
                loading={loading}
              />
            )}
          </section>
        )}

        {page === "edit" && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Update</p>
                <h3>{editingProduct?.name || "Choose Product"}</h3>
              </div>
              <select className="product-picker" value={editingId} onChange={(event) => setEditingId(event.target.value)}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name || product.id}</option>
                ))}
              </select>
            </div>
            {editingId ? (
              <ProductForm
                mode="edit"
                form={form}
                setForm={setForm}
                images={images}
                setImages={setImages}
                additionalImages={editAdditionalImages}
                setAdditionalImages={setEditAdditionalImages}
                onSubmit={handleEdit}
                onGenerateDraft={handleGenerateDraft}
                loading={loading}
                draftLoading={draftLoading}
                showImageTools
              />
            ) : (
              <p className="empty">Select a product from the dropdown to edit its full syntax fields.</p>
            )}
          </section>
        )}

        {page === "products" && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Catalog</p>
                <h3>{products.length} Products</h3>
              </div>
            </div>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onEdit={goEdit} onDelete={handleDelete} />
              ))}
              {!products.length && <p className="empty">No products yet.</p>}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
