import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Edit3,
  Boxes,
  Layers,
  Crop,
  ImagePlus,
  Sparkles,
  LayoutGrid,
  Mail,
  MapPin,
  PackagePlus,
  Phone,
  RefreshCcw,
  Save,
  ShoppingBag,
  LogOut,
  Trash2,
  Upload,
  X,
  ZoomIn
} from "lucide-react";
import {
  apiRoutes,
  checkAdminSession,
  clearAdminSession,
  getAdminSession,
  SESSION_EXPIRED_EVENT,
  createProduct,
  createProductDraftFromImage,
  deleteProduct,
  listOrders,
  listProducts,
  updateOrder,
  updateProduct
} from "./services/api.js";
import MockupGallery from "./components/MockupGallery.jsx";
import ImageTools from "./components/ImageTools.jsx";
import PaymentCheck from "./components/PaymentCheck.jsx";
import CollectionPicker from "./components/CollectionPicker.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import BulkUpload from "./components/BulkUpload.jsx";
import { fitUploadLimit, generateMockups } from "./utils/posterMockups.js";
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

// The storefront sells every poster in these three sizes; new uploads start with them filled in.
function standardSizes() {
  return [
    { type: "Small", paper: "A4", inches: "12 x 9", price: 999, stock: 25 },
    { type: "Medium", paper: "A3", inches: "15.8 x 12", price: 1499, stock: 25 },
    { type: "Large", paper: "A2", inches: "24 x 18", price: 1699, stock: 25 }
  ];
}

const paperSizeOptions = ["", "A5", "A4", "A3", "A2"];
const sizeTypes = ["Small", "Medium", "Large", "Extra Large"];
const orientationOptions = [
  { value: "", label: "Select orientation" },
  { value: "Portrait", label: "Portrait" },
  { value: "Landscape", label: "Landscape" }
];

function cloneTemplate() {
  return structuredClone(productTemplate);
}

function normalizeOrientation(value = "") {
  if (/landscape|horizontal/i.test(value)) return "Landscape";
  if (/portrait|vertical/i.test(value)) return "Portrait";
  return value || "";
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
    specifications: {
      ...productTemplate.specifications,
      ...(product.specifications || {}),
      orientation: normalizeOrientation(product.specifications?.orientation)
    },
    productAttributes: { ...productTemplate.productAttributes, ...(product.productAttributes || {}) },
    filterableAttributes: {
      ...productTemplate.filterableAttributes,
      ...(product.filterableAttributes || {}),
      orientation: normalizeOrientation(product.filterableAttributes?.orientation)
    },
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

function productPayload(form, options = {}) {
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
  payload.specifications.orientation = normalizeOrientation(payload.specifications.orientation);
  payload.filterableAttributes.orientation = normalizeOrientation(payload.filterableAttributes.orientation || payload.specifications.orientation);

  const normalizedSizes = payload.sizes
    .filter((size) => size.type && size.inches && size.price)
    .map((size) => {
      const price = toNumber(size.price);
      const compareAtPrice = price ? Math.round(Number(price) / (1 - discountPercent / 100)) : "";
      const stock = size.stock === "" || size.stock === null || size.stock === undefined ? 25 : toNumber(size.stock);
      const safeType = String(size.type).toLowerCase().replace(/\s+/g, "-");
      const skuBase = String(payload.sku || payload.slug || payload.id || "poster").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      const variantId = size.variantId || `${payload.id}-var-${safeType}`;

      return {
        id: size.id || `${payload.id}-size-${safeType}`,
        type: size.type,
        paper: size.paper || "",
        inches: size.inches,
        price,
        stock,
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
  const sizeStockTotal = normalizedSizes.reduce((total, size) => total + Number(size.stock || 0), 0);
  const inventoryStock = options.inventoryStockOverride ?? sizeStockTotal;
  payload.inventory = {
    ...payload.inventory,
    stock: inventoryStock,
    trackInventory: true,
    lowStockThreshold: 5,
    allowBackorders: false,
    status: "in_stock"
  };
  payload.urgency = {
    ...payload.urgency,
    lowStock: false,
    stockLeft: inventoryStock
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
  showImageTools = false,
  onGenerateMockups,
  mockupLoading = false
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

      <CollectionPicker form={form} setForm={setForm} />

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
              <ImagePlus size={16} />
              <span>{images.length ? `${images.length} selected` : "Choose poster image"}</span>
              <input type="file" accept="image/*" multiple onChange={(event) => setImages([...event.target.files])} />
            </label>
          </Field>
        )}
        {showImageTools && (
          <div className="media-actions">
            <button type="button" className="secondary-button" disabled={!images.length || draftLoading} onClick={onGenerateDraft}>
              <ImagePlus size={15} /> {draftLoading ? "Generating..." : "Upload Image & Autofill"}
            </button>
            {onGenerateMockups && (
              <button type="button" className="secondary-button" disabled={(!images.length && !form.media?.featuredImage) || mockupLoading} onClick={onGenerateMockups}>
                <Sparkles size={15} /> {mockupLoading ? "Generating..." : "Generate Mockups"}
              </button>
            )}
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
                    <Trash2 size={15} />
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
          options={orientationOptions}
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
          options={orientationOptions}
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
        {mode === "edit" ? <Save size={16} /> : <Upload size={16} />}
        {mode === "edit" ? "Save Product" : "Upload Product"}
      </button>
    </form>
  );
}

function ProductCard({ product, onEdit, onDelete, onOpen }) {
  const image = product.media?.thumbnail || product.media?.featuredImage || "/placeholder.svg";
  return (
    <article
      className="product-card clickable-card"
      onClick={() => onOpen(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(product);
      }}
      role="button"
      tabIndex={0}
    >
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
          <button className="secondary-button" onClick={(event) => { event.stopPropagation(); onEdit(product); }}>
            <Edit3 size={14} /> Edit
          </button>
          <button className="secondary-button danger-button" onClick={(event) => { event.stopPropagation(); onDelete(product.id); }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function formatFieldLabel(value) {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function ProductFieldValue({ value }) {
  if (value === null || value === undefined || value === "") {
    return <span className="muted-value">-</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span className="muted-value">-</span>;
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      const short = value.every((item) => String(item).length <= 32);
      return short ? (
        <div className="detail-chips">
          {value.map((item, index) => <span key={`chip-${index}`}>{String(item)}</span>)}
        </div>
      ) : (
        <ul className="detail-list">
          {value.map((item, index) => <li key={`item-${index}`}>{String(item)}</li>)}
        </ul>
      );
    }
    return (
      <div className="detail-nested-list">
        {value.map((item, index) => (
          <div className="detail-nested-item" key={`array-${index}`}>
            <ProductFieldValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return <span className="muted-value">-</span>;
    return (
      <div className="detail-field-grid nested">
        {entries.map(([key, item]) => (
          <div className="detail-field" key={key}>
            <span>{formatFieldLabel(key)}</span>
            <ProductFieldValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function isEmptyValue(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (typeof value === "object") return Object.values(value).every(isEmptyValue);
  return false;
}

// Long text gets a wider card so it reads like a paragraph instead of a narrow column.
function fieldWidthClass(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return " span-3";
  const text = Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
  if (text.length > 220) return " span-3";
  if (text.length > 70) return " span-2";
  return "";
}

function ProductDetailSection({ title, data }) {
  if (!data || isEmptyValue(data)) return null;

  return (
    <section className="detail-section">
      <h4>{title}</h4>
      <div className="detail-field-grid">
        {Object.entries(data).map(([key, value]) => (
          <div className={`detail-field${fieldWidthClass(value)}`} key={key}>
            <span>{formatFieldLabel(key)}</span>
            <ProductFieldValue value={value} />
          </div>
        ))}
      </div>
    </section>
  );
}

// Product images as pictures (with their mockup captions), not raw URLs.
function MediaSection({ media, onOpen }) {
  const featured = media?.featuredImage;
  const gallery = (Array.isArray(media?.gallery) ? media.gallery : []).filter((url) => url && url !== featured);
  const labels = Array.isArray(media?.galleryLabels) ? media.galleryLabels : [];
  const labelFor = (url) => labels.find((entry) => entry?.url === url)?.label || "Gallery image";
  const cloudinary = (Array.isArray(media?.cloudinary) ? media.cloudinary : []).filter(Boolean);
  if (!featured && !gallery.length) return null;

  return (
    <section className="detail-section">
      <h4>Media</h4>
      <div className="media-grid">
        {featured && (
          <button type="button" className="media-tile featured" onClick={() => onOpen(featured)}>
            <img src={featured} alt="Main product image" />
            <span>Main image</span>
          </button>
        )}
        {gallery.map((url, index) => (
          <button type="button" className="media-tile" key={`${url}-${index}`} onClick={() => onOpen(url)}>
            <img src={url} alt={labelFor(url)} loading="lazy" />
            <span>{labelFor(url)}</span>
          </button>
        ))}
      </div>
      {media?.video && (
        <p className="media-video">
          Video: <a href={media.video} target="_blank" rel="noopener noreferrer">{media.video}</a>
        </p>
      )}
      {cloudinary.length > 0 && (
        <details className="detail-technical">
          <summary>Technical details ({cloudinary.length} files on Cloudinary)</summary>
          <table className="detail-table">
            <thead>
              <tr><th>File</th><th>Size</th><th>Format</th></tr>
            </thead>
            <tbody>
              {cloudinary.map((item, index) => (
                <tr key={`${item.publicId || item.url}-${index}`}>
                  <td><a href={item.url} target="_blank" rel="noopener noreferrer">{String(item.publicId || item.url).split("/").pop()}</a></td>
                  <td>{item.width && item.height ? `${item.width} × ${item.height}` : "-"}</td>
                  <td>{item.format || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

// Sizes as one readable table; variants mirror them, so they stay folded away.
function SizesSection({ sizes, variants }) {
  const rows = Array.isArray(sizes) ? sizes : [];
  if (!rows.length) return null;

  return (
    <section className="detail-section">
      <h4>Sizes</h4>
      <div className="detail-table-wrap">
        <table className="detail-table">
          <thead>
            <tr><th>Size</th><th>Paper</th><th>Inches</th><th>Price</th><th>Was</th><th>Stock</th><th>SKU</th></tr>
          </thead>
          <tbody>
            {rows.map((size, index) => (
              <tr key={size.id || index}>
                <td><strong>{size.type || "-"}</strong></td>
                <td>{size.paper || "-"}</td>
                <td>{size.inches || "-"}</td>
                <td>INR {Number(size.price || 0).toLocaleString("en-IN")}</td>
                <td>{size.pricing?.compareAtPrice ? `INR ${Number(size.pricing.compareAtPrice).toLocaleString("en-IN")}` : "-"}</td>
                <td>{size.stock ?? "-"}</td>
                <td className="detail-sku">{size.sku || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Array.isArray(variants) && variants.length > 0 && (
        <details className="detail-technical">
          <summary>Variants ({variants.length})</summary>
          <ProductFieldValue value={variants} />
        </details>
      )}
    </section>
  );
}

function ImageLightbox({ image, alt, onClose }) {
  if (!image) return null;

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="icon-button lightbox-close" type="button" onClick={onClose} title="Close image">
        <X size={16} />
      </button>
      <img src={image} alt={alt || "Product image"} onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function ProductDetailPage({ product, onBack, onEdit, onDelete }) {
  const [activeImage, setActiveImage] = useState("");
  const normalizedProduct = mergeProduct(product || {});
  const images = productImageUrls(normalizedProduct);
  const heroImage = images[0] || "/placeholder.svg";

  const {
    id,
    sku,
    slug,
    name,
    subtitle,
    brand,
    vendor,
    createdAt,
    updatedAt,
    category,
    description,
    media,
    pricing,
    inventory,
    urgency,
    variants,
    specifications,
    productAttributes,
    filterableAttributes,
    filters,
    badges,
    ratings,
    reviews,
    metrics,
    socialProof,
    userState,
    shipping,
    careInstructions,
    seo,
    crossSell,
    flags,
    compliance,
    sizes,
    collections,
    importKey,
    ...otherFields
  } = normalizedProduct;
  // Defaults like "No" / empty counters are not real metrics; only show the section when something was recorded.
  const hasMetrics = [metrics, socialProof].some((group) =>
    Object.values(group || {}).some((value) => value !== "" && value !== null && value !== undefined && value !== false)
  );

  return (
    <>
      <section className="panel wide-panel product-detail-page">
        <div className="detail-toolbar">
          <button className="secondary-button" type="button" onClick={onBack}>
            <ArrowLeft size={14} /> Back
          </button>
          <div className="row-actions">
            {id && (
              <button className="secondary-button" type="button" onClick={() => onEdit(normalizedProduct)}>
                <Edit3 size={14} /> Edit
              </button>
            )}
            {id && (
              <button className="secondary-button danger-button" type="button" onClick={() => onDelete(id)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>

        <div className="product-detail-hero">
          <button className="detail-hero-image" type="button" onClick={() => setActiveImage(heroImage)}>
            <img src={heroImage} alt={name || "Product"} />
            <span><ZoomIn size={15} /> View larger</span>
          </button>
          <div className="detail-hero-copy">
            <p className="eyebrow">Product Detail</p>
            <h3>{name || "Untitled Product"}</h3>
            <p>{subtitle || description?.short || id}</p>
            <div className="product-meta">
              <span>{category?.main || "No category"}</span>
              <span>{pricing?.currency || "INR"} {pricing?.price || 0}</span>
              <span>{inventory?.stock || 0} stock</span>
              <span>{inventory?.status || "stock unknown"}</span>
            </div>
          </div>
        </div>

        <ProductDetailSection
          title="Identity"
          data={{ id, sku, slug, name, subtitle, brand, vendor, createdAt, updatedAt }}
        />
        <ProductDetailSection title="Category" data={{ ...category, collections }} />
        <ProductDetailSection title="Description" data={description} />
        <MediaSection media={media} onOpen={setActiveImage} />
        <ProductDetailSection title="Pricing" data={pricing} />
        <ProductDetailSection title="Inventory" data={inventory} />
        <SizesSection sizes={sizes} variants={variants} />
        <ProductDetailSection title="Specifications" data={specifications} />
        <ProductDetailSection title="Product Attributes" data={productAttributes} />
        <ProductDetailSection title="Filter Attributes" data={filterableAttributes} />
        <ProductDetailSection title="Filters & Badges" data={{ ...filters, badges }} />
        <ProductDetailSection title="Ratings & Reviews" data={{ ratings, reviews }} />
        {hasMetrics && <ProductDetailSection title="Metrics & Social Proof" data={{ metrics, socialProof }} />}
        <ProductDetailSection title="Shipping" data={{ ...shipping, careInstructions }} />
        <ProductDetailSection title="SEO" data={seo} />
        <ProductDetailSection title="Cross Sell" data={crossSell} />
        <ProductDetailSection title="Flags & Compliance" data={{ ...flags, ...compliance }} />
        {Object.keys(otherFields).length > 0 && <ProductDetailSection title="Other Fields" data={otherFields} />}
      </section>
      <ImageLightbox image={activeImage} alt={name || "Product image"} onClose={() => setActiveImage("")} />
    </>
  );
}

function ImageDraftStep({ images, setImages, imagePreview, setImagePreview, onGenerateDraft, draftLoading, children }) {
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
            <ImagePlus size={27} />
            <strong>Choose main poster image</strong>
            <span>PNG, JPG, or WEBP. Large files are compressed automatically.</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={chooseImage} />
      </label>

      <button className="primary-button" disabled={!images.length || draftLoading} onClick={onGenerateDraft}>
        <Upload size={16} />
        {draftLoading ? "Uploading & Generating..." : "Upload Image & Generate Details"}
      </button>
      {draftLoading && <div className="loading-panel">Gemini is reading the poster and preparing the product details. This can take a moment.</div>}
      {children}
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
              <Field label="Paper">
                <select value={size.paper || ""} onChange={(event) => updateSize(index, "paper", event.target.value)}>
                  {paperSizeOptions.map((paper) => <option key={paper} value={paper}>{paper || "None"}</option>)}
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

function inventoryRowsFromProduct(product) {
  if (!product) return [];
  const sourceRows = product.sizes?.length
    ? product.sizes
    : (product.variants || []).map((variant) => ({
        id: variant.id,
        variantId: variant.id,
        sku: variant.sku,
        type: variant.sizeType,
        inches: variant.size,
        price: variant.price ?? variant.pricing?.price,
        stock: variant.stock
      }));

  return sourceRows.map((size) => ({
    id: size.id || "",
    variantId: size.variantId || "",
    sku: size.sku || "",
    type: size.type || size.sizeType || "Small",
    paper: size.paper || "",
    inches: size.inches || size.size || "",
    price: size.price ?? size.pricing?.price ?? "",
    stock: size.stock ?? ""
  }));
}

function inventoryDraftFromProduct(product) {
  const rows = inventoryRowsFromProduct(product);
  const sizeStockTotal = rows.reduce((total, row) => total + Number(row.stock || 0), 0);
  return {
    totalStock: rows.length ? sizeStockTotal : product?.inventory?.stock ?? 0,
    rows
  };
}

function persistedInventoryDraftFromProduct(product) {
  const rows = inventoryRowsFromProduct(product);
  return {
    totalStock: product?.inventory?.stock ?? rows.reduce((total, row) => total + Number(row.stock || 0), 0),
    rows
  };
}

function inventoryDraftSignature(draft) {
  return JSON.stringify({
    totalStock: String(draft?.totalStock ?? ""),
    rows: (draft?.rows || []).map((row) => ({
      id: row.id || "",
      variantId: row.variantId || "",
      sku: row.sku || "",
      type: row.type || "",
      inches: row.inches || "",
      price: String(row.price ?? ""),
      stock: String(row.stock ?? "")
    }))
  });
}

function getInventoryStats(draft) {
  const rows = draft?.rows || [];
  const sizeStockTotal = rows.reduce((total, row) => total + Number(row.stock || 0), 0);
  const totalStock = Number(draft?.totalStock ?? sizeStockTotal);
  const lowestPrice = rows
    .map((row) => Number(row.price || 0))
    .filter((price) => price > 0)
    .sort((a, b) => a - b)[0] || 0;
  const inventoryValue = rows.reduce((total, row) => total + Number(row.price || 0) * Number(row.stock || 0), 0);

  return { totalStock, sizeStockTotal, lowestPrice, inventoryValue };
}

function getProductSortPrice(product) {
  return getInventoryStats(inventoryDraftFromProduct(product)).lowestPrice || Number.MAX_SAFE_INTEGER;
}

function productImageUrl(product) {
  return product?.media?.thumbnail || product?.media?.featuredImage || product?.media?.gallery?.[0] || "/placeholder.svg";
}

function InventoryManager({
  products,
  drafts,
  expandedProductIds,
  loading,
  onAddRow,
  onCollapseAll,
  onDiscard,
  onExpandAll,
  onExpand,
  onRemoveRow,
  onSave,
  onSaveAll,
  onSort,
  onUpdateRow,
  onUpdateTotalStock,
  sortKey
}) {
  const sortedProducts = [...products].sort((a, b) => {
    if (sortKey === "createdAt") {
      return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
    }
    if (sortKey === "price") {
      return getProductSortPrice(a) - getProductSortPrice(b);
    }
    if (sortKey === "stock") {
      return getInventoryStats(inventoryDraftFromProduct(b)).totalStock - getInventoryStats(inventoryDraftFromProduct(a)).totalStock;
    }
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  });

  function getDraft(product) {
    return drafts[product.id] || inventoryDraftFromProduct(product);
  }

  function isDirty(product) {
    return inventoryDraftSignature(getDraft(product)) !== inventoryDraftSignature(persistedInventoryDraftFromProduct(product));
  }

  const dirtyProductIds = sortedProducts.filter(isDirty).map((product) => product.id);
  const allExpanded = products.length > 0 && expandedProductIds.length === products.length;

  if (!products.length) {
    return (
      <section className="panel wide-panel inventory-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Inventory</p>
            <h3>Inventory & Prices</h3>
          </div>
        </div>
        <p className="empty">No products available.</p>
      </section>
    );
  }

  return (
    <section className="panel wide-panel inventory-panel">
      <div className="panel-heading inventory-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h3>Manage Product Stock</h3>
        </div>
        <div className="inventory-toolbar">
          <label className="sort-control">
            <span>Sort by</span>
            <select value={sortKey} onChange={(event) => onSort(event.target.value)}>
              <option value="name">Name</option>
              <option value="createdAt">Created At</option>
              <option value="price">Price</option>
              <option value="stock">Total Stock</option>
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={allExpanded ? onCollapseAll : onExpandAll}>
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
          <button type="button" className="primary-button inventory-save-all" disabled={!dirtyProductIds.length || loading} onClick={() => onSaveAll(dirtyProductIds)}>
            <Save size={16} /> Save All
          </button>
        </div>
      </div>

      <div className="inventory-list">
        <div className="inventory-product-row inventory-product-head">
          <span>Product</span>
          <span>Total Stock</span>
          <span>Starting Price</span>
          <span>Stock Value</span>
          <span>Sizes</span>
          <span></span>
        </div>

        {sortedProducts.map((product) => {
          const draft = getDraft(product);
          const stats = getInventoryStats(draft);
          const dirty = isDirty(product);
          const expanded = expandedProductIds.includes(product.id);

          return (
            <div className={`inventory-product ${dirty ? "is-dirty" : ""}`} key={product.id}>
              <div className="inventory-product-row">
                <div className="inventory-product-name">
                  <img src={productImageUrl(product)} alt={product.name || "Product"} />
                  <div>
                    <strong>{product.name || product.id}</strong>
                    <span>{product.sku || product.id}</span>
                  </div>
                </div>
                <input
                  className="inventory-total-input"
                  min="0"
                  type="number"
                  value={draft.totalStock}
                  onChange={(event) => onUpdateTotalStock(product.id, event.target.value)}
                />
                <strong>{stats.lowestPrice ? `INR ${stats.lowestPrice}` : "-"}</strong>
                <strong>{`INR ${stats.inventoryValue.toLocaleString("en-IN")}`}</strong>
                <button type="button" className="secondary-button" onClick={() => onExpand(product.id)}>
                  {expanded ? "Hide Sizes" : `Sizes (${draft.rows.length})`}
                </button>
                <div className={`inventory-actions ${dirty ? "has-discard" : ""}`}>
                  {dirty && (
                    <button type="button" className="secondary-button" disabled={loading} onClick={() => onDiscard(product.id)}>
                      Discard
                    </button>
                  )}
                  <button type="button" className="primary-button" disabled={!dirty || loading} onClick={() => onSave(product.id)}>
                    <Save size={16} /> Save
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="inventory-size-dropdown">
                  <div className="section-title-row">
                    <h4>Size Pricing</h4>
                    <button type="button" className="secondary-button" onClick={() => onAddRow(product.id)}>Add Size</button>
                  </div>
                  <div className="inventory-table">
                    <div className="inventory-row inventory-row-head">
                      <span>Size</span>
                      <span>Inches</span>
                      <span>Price</span>
                      <span>Size Stock</span>
                      <span>SKU</span>
                      <span></span>
                    </div>
                    {draft.rows.map((row, index) => (
                      <div className="inventory-row" key={`${row.id || row.type}-${index}`}>
                        <select value={row.type} onChange={(event) => onUpdateRow(product.id, index, "type", event.target.value)}>
                          {sizeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <input value={row.inches} placeholder="12 x 9" onChange={(event) => onUpdateRow(product.id, index, "inches", event.target.value)} />
                        <input type="number" min="0" value={row.price} placeholder="699" onChange={(event) => onUpdateRow(product.id, index, "price", event.target.value)} />
                        <input type="number" min="0" value={row.stock} placeholder="25" onChange={(event) => onUpdateRow(product.id, index, "stock", event.target.value)} />
                        <input value={row.sku} placeholder="Optional" onChange={(event) => onUpdateRow(product.id, index, "sku", event.target.value)} />
                        <button type="button" className="icon-button danger" onClick={() => onRemoveRow(product.id, index)} disabled={draft.rows.length === 1} title="Remove size">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const orderStatuses = [
  { value: "payment_verification", label: "Pending Verification" },
  { value: "payment_not_verified", label: "Payment Not Verified" },
  { value: "product_packing", label: "Product Packing" },
  { value: "sending_to_transit", label: "Sending To Transit" },
  { value: "in_transit", label: "In Transit" },
  { value: "completed", label: "Completed" },
  { value: "return_requested", label: "Return Request Pending" },
  { value: "return_processing", label: "Return Processing" },
  { value: "cancelled", label: "Cancelled" },
  { value: "return_in_transit", label: "Return In Transit" },
  { value: "refunded", label: "Refunded" }
];

const orderTabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled_refunded", label: "Cancelled / Refunded" }
];

const pendingOrderStatuses = [
  "payment_verification",
  "product_packing",
  "sending_to_transit",
  "return_requested",
  "return_processing",
  "cancel_requested",
  "refund_requested"
];
const inTransitOrderStatuses = ["in_transit", "return_in_transit"];
const cancelledRefundedStatuses = ["payment_not_verified", "cancelled", "refunded"];

function isReturnOrder(order) {
  const status = order?.status || "";
  const values = [
    status,
    order?.statusLabel,
    order?.type,
    order?.flow,
    order?.requestType,
    order?.returnStatus,
    order?.actions?.returnRequested ? "return" : "",
    order?.actions?.refundRequested ? "refund" : ""
  ];

  return values.some((value) => /return|refund/i.test(String(value || "")));
}

function effectiveOrderStatus(order) {
  if ((order?.status === "in_transit" || order?.status === "shipped") && isReturnOrder(order)) {
    return "return_in_transit";
  }
  return order?.status || "payment_verification";
}

function orderStatusLabel(order) {
  const status = effectiveOrderStatus(order);
  return orderStatuses.find((item) => item.value === status)?.label || status || "Pending Verification";
}

function orderTabForStatus(statusOrOrder) {
  const status = typeof statusOrOrder === "object" ? effectiveOrderStatus(statusOrOrder) : statusOrOrder;
  if (pendingOrderStatuses.includes(status)) return "pending";
  if (inTransitOrderStatuses.includes(status)) return "in_transit";
  if (status === "completed") return "completed";
  if (cancelledRefundedStatuses.includes(status)) return "cancelled_refunded";
  return "pending";
}

function orderActionsForOrder(order) {
  const status = effectiveOrderStatus(order);
  if (["cancel_requested", "refund_requested", "return_requested"].includes(status)) {
    return [{ status: "return_processing", label: "Process Request" }];
  }
  if (status === "return_processing") {
    return [{ status: "return_in_transit", label: "Move In Transit" }];
  }
  if (status === "product_packing") {
    return [{ status: "sending_to_transit", label: "Order Packed" }];
  }
  if (status === "sending_to_transit") {
    return [{ status: "in_transit", label: "Move In Transit" }];
  }
  if (status === "in_transit") {
    return [
      { status: "completed", label: "Completed" },
      { status: "cancelled", label: "Cancelled" }
    ];
  }
  if (status === "completed") {
    return [{ status: "return_requested", label: "Process Return Request" }];
  }
  if (status === "cancelled") {
    return [{ status: "return_processing", label: "Process Request" }];
  }
  if (status === "return_in_transit") {
    return [{ status: "refunded", label: "Process Refund" }];
  }
  if (["payment_not_verified", "refunded"].includes(status)) {
    return [];
  }
  // Orders waiting for payment are handled by the PaymentCheck panel.
  if (status === "payment_verification") {
    return [];
  }

  return [
    { status: "product_packing", label: "Verify Payment" },
    { status: "payment_not_verified", label: "Incorrect / Not Verified" }
  ];
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function productImageUrls(product) {
  const values = [
    product?.media?.featuredImage,
    product?.media?.thumbnail,
    ...(product?.media?.gallery || []),
    ...(product?.media?.cloudinary || []).map((image) => image?.url || image?.secure_url)
  ];

  return [...new Set(values.filter(Boolean))];
}

function itemImageUrl(item) {
  if (Array.isArray(item?.image)) return item.image?.[0]?.url || item.image?.[0] || "/placeholder.svg";
  return item?.image || item?.media?.thumbnail || item?.media?.featuredImage || "/placeholder.svg";
}

function findProductForOrderItem(item, products) {
  const identifiers = [
    item?.productId,
    item?.product?.id,
    item?.id,
    item?.sku,
    item?.variantId
  ].filter(Boolean).map((value) => String(value).toLowerCase());
  const name = String(item?.name || "").toLowerCase();

  return products.find((product) => {
    const productValues = [
      product.id,
      product.sku,
      product.slug,
      ...(product.variants || []).flatMap((variant) => [variant.id, variant.sku]),
      ...(product.sizes || []).flatMap((size) => [size.id, size.sku, size.variantId])
    ].filter(Boolean).map((value) => String(value).toLowerCase());

    return productValues.some((value) => identifiers.includes(value)) || (name && String(product.name || "").toLowerCase() === name);
  });
}

function orderTimestampUpdates(order, status) {
  if (!["completed", "delivered"].includes(status)) return {};
  const timestamp = new Date().toISOString();

  return {
    deliveredAt: order.deliveredAt || timestamp,
    completedAt: order.completedAt || timestamp,
    deliveryCompletedAt: order.deliveryCompletedAt || timestamp
  };
}

function OrdersManager({ orders, products, loading, onStatusChange, onOpenProduct }) {
  const [activeOrderTab, setActiveOrderTab] = useState("all");
  const visibleOrders = orders.filter((order) => (
    activeOrderTab === "all" ? true : orderTabForStatus(order) === activeOrderTab
  ));
  const tabCounts = orderTabs.reduce((counts, tab) => {
    counts[tab.value] = tab.value === "all"
      ? orders.length
      : orders.filter((order) => orderTabForStatus(order) === tab.value).length;
    return counts;
  }, {});

  if (!orders.length) {
    return (
      <section className="panel wide-panel orders-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Orders</p>
            <h3>Placed Orders</h3>
          </div>
        </div>
        <p className="empty">No orders placed yet.</p>
      </section>
    );
  }

  return (
    <section className="panel wide-panel orders-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Orders</p>
          <h3>{visibleOrders.length} Placed Orders</h3>
        </div>
      </div>

      <div className="order-tabs">
        {orderTabs.map((tab) => (
          <button
            type="button"
            className={activeOrderTab === tab.value ? "active" : ""}
            key={tab.value}
            onClick={() => setActiveOrderTab(tab.value)}
          >
            {tab.label}
            <span>{tabCounts[tab.value] || 0}</span>
          </button>
        ))}
      </div>

      <div className="admin-orders-list">
        {visibleOrders.map((order) => {
          const actions = orderActionsForOrder(order);

          return (
            <article className="admin-order-card" key={order.id}>
              <div className="admin-order-top">
                <div>
                  <p className="eyebrow">Order ID</p>
                  <h4>{order.id}</h4>
                  <span>{formatDateTime(order.createdAt)}</span>
                </div>
                <div className="order-workflow">
                  <span className={`order-status-badge status-${orderTabForStatus(order)}`}>{orderStatusLabel(order)}</span>
                  <div className="order-workflow-actions">
                    {actions.map((action) => (
                      <button
                        type="button"
                        className={["payment_not_verified", "cancelled", "refunded"].includes(action.status) ? "secondary-button danger-button" : "secondary-button"}
                        disabled={loading}
                        key={action.status}
                        onClick={() => onStatusChange(order, action.status)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            {effectiveOrderStatus(order) === "payment_verification" && (
              <PaymentCheck order={order} orders={orders} loading={loading} onDecision={onStatusChange} />
            )}

            <div className="order-summary-grid">
              <div>
                <span>Customer</span>
                <strong>{order.customer?.name || order.shipping?.recipient || "Customer"}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>INR {Number(order.totals?.total || 0).toLocaleString("en-IN")}</strong>
              </div>
              <div>
                <span>Items</span>
                <strong>{order.items?.length || 0}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{order.payment?.transactionId || "Not shared"}</strong>
              </div>
            </div>

            <div className="order-detail-grid">
              <section className="order-detail-box">
                <h5>Customer Details</h5>
                <p><Mail size={14} /> {order.customer?.email || "-"}</p>
                <p><Phone size={14} /> {order.customer?.phone || order.shipping?.phone || "-"}</p>
                <p><MapPin size={14} /> {order.shipping?.destination || [order.shipping?.addressLine1, order.shipping?.addressLine2, order.shipping?.city, order.shipping?.state, order.shipping?.pincode].filter(Boolean).join(", ") || "-"}</p>
              </section>

              <section className="order-detail-box">
                <h5>Payment Details</h5>
                <p><strong>Method:</strong> {order.payment?.method || "-"}</p>
                <p><strong>Payer:</strong> {order.payment?.payerName || "-"}</p>
                <p><strong>UPI:</strong> {order.payment?.receiverUpiId || "-"}</p>
                {order.payment?.screenshotDataUrl && <img className="payment-proof-image" src={order.payment.screenshotDataUrl} alt="Payment proof" />}
              </section>

              <section className="order-detail-box">
                <h5>Totals</h5>
                <p><strong>Subtotal:</strong> INR {Number(order.totals?.subtotal || 0).toLocaleString("en-IN")}</p>
                <p><strong>GST:</strong> INR {Number(order.totals?.gst || 0).toLocaleString("en-IN")}</p>
                <p><strong>Shipping:</strong> INR {Number(order.totals?.shipping || 0).toLocaleString("en-IN")}</p>
                <p><strong>Total:</strong> INR {Number(order.totals?.total || 0).toLocaleString("en-IN")}</p>
              </section>

              <section className="order-detail-box">
                <h5>Timeline</h5>
                <p><strong>Delivered:</strong> {formatDateTime(order.deliveredAt)}</p>
                <p><strong>Completed:</strong> {formatDateTime(order.completedAt)}</p>
                <p><strong>Delivery Done:</strong> {formatDateTime(order.deliveryCompletedAt)}</p>
              </section>
            </div>

            <div className="admin-order-items">
              <div className="section-title-row">
                <h4>Products</h4>
                <span>{order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"}</span>
              </div>
              {(order.items || []).map((item, index) => {
                const matchedProduct = findProductForOrderItem(item, products);
                const fallbackProduct = mergeProduct({
                  id: item.productId || item.id || item.sku || `${order.id}-item-${index}`,
                  sku: item.sku || "",
                  name: item.name || item.id || "Order item",
                  subtitle: item.subtitle || "",
                  media: {
                    ...productTemplate.media,
                    featuredImage: itemImageUrl(item),
                    thumbnail: itemImageUrl(item)
                  },
                  pricing: {
                    ...productTemplate.pricing,
                    price: item.price || 0
                  },
                  sizes: [{
                    type: item.sizeType || item.size || "",
                    inches: item.size || "",
                    price: item.price || 0,
                    stock: ""
                  }]
                });

                return (
                  <button
                    className="admin-order-item clickable-order-item"
                    key={`${order.id}-item-${item.id || index}`}
                    type="button"
                    onClick={() => onOpenProduct(matchedProduct || fallbackProduct)}
                  >
                    <img src={itemImageUrl(item)} alt={item.name || "Order item"} />
                    <div>
                      <strong>{item.name || item.id}</strong>
                      <span>{item.subtitle || item.sku || item.id}</span>
                      <span>Size: {item.size || item.sizeType || "-"} | Qty: {item.amount || 1}</span>
                    </div>
                    <strong>INR {Number((item.price || 0) * (item.amount || 1)).toLocaleString("en-IN")}</strong>
                  </button>
                );
              })}
            </div>
          </article>
          );
        })}
        {!visibleOrders.length && <p className="empty">No orders in this tab.</p>}
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
            <ImagePlus size={21} />
            <span>Add additional product image</span>
          </button>
        )}
        {files.map((file, index) => (
          <div className="extra-image-row" key={`extra-${index}`}>
            {file && <img className="extra-image-preview" src={URL.createObjectURL(file)} alt={`Additional ${index + 1}`} />}
            <label className="file-drop">
              <ImagePlus size={16} />
              <span>{file?.name || "Choose additional image"}</span>
              <input type="file" accept="image/*" onChange={(event) => updateFile(index, [...event.target.files])} />
            </label>
            <button type="button" className="icon-button danger" onClick={() => removeSlot(index)} title="Remove image">
              <Trash2 size={15} />
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

      <CollectionPicker form={form} setForm={setForm} />

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
        <SelectField form={form} setForm={setForm} label="Orientation" path="specifications.orientation" options={orientationOptions} />
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
        <SelectField form={form} setForm={setForm} label="Orientation" path="filterableAttributes.orientation" options={orientationOptions} />
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
        <Save size={16} /> Go To Review
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
            <strong>{size.type}{size.paper ? ` · ${size.paper}` : ""}</strong>
            <span>{size.inches}</span>
            <span>INR {size.price}</span>
          </div>
        ))}
      </div>
      <ReadOnlyDetails payload={payload} />
      <div className="review-actions">
        <button type="button" className="secondary-button" onClick={onBack}>Back & Edit</button>
        <button type="button" className="primary-button" disabled={loading} onClick={onUpload}>
          <Upload size={16} /> {loading ? "Uploading..." : "Upload Product"}
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
              <strong>{size.type}{size.paper ? ` · ${size.paper}` : ""}</strong>
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

// The current page lives in the URL hash (#/inventory, #/products/<id>, #/edit/<id>)
// so a refresh, a bookmark or the browser's back button lands on the same screen.
const PAGES = ["upload", "bulk", "edit", "inventory", "orders", "products", "tools"];

function readRoute() {
  const [section = "", id = ""] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (section === "products" && id) return { page: "productDetail", id };
  if (PAGES.includes(section)) return { page: section, id: section === "edit" ? id : "" };
  return { page: "upload", id: "" };
}

function routeHash(page, id) {
  if (page === "productDetail") return id ? `#/products/${encodeURIComponent(id)}` : "#/products";
  if (page === "edit" && id) return `#/edit/${encodeURIComponent(id)}`;
  return `#/${page}`;
}

function ConsoleApp({ adminSession, onLogout }) {
  const [page, setPage] = useState(() => readRoute().page);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(() => cloneTemplate());
  const [images, setImages] = useState([]);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadStep, setUploadStep] = useState("image");
  const [sizes, setSizes] = useState(standardSizes);
  const [additionalImages, setAdditionalImages] = useState([]);
  const [editAdditionalImages, setEditAdditionalImages] = useState([]);
  const [editingId, setEditingId] = useState(() => (readRoute().page === "edit" ? readRoute().id : ""));
  const [inventoryDrafts, setInventoryDrafts] = useState({});
  const [expandedInventoryIds, setExpandedInventoryIds] = useState([]);
  const [inventorySort, setInventorySort] = useState("name");
  const [selectedProductId, setSelectedProductId] = useState(() => (readRoute().page === "productDetail" ? readRoute().id : ""));
  const [selectedProductFallback, setSelectedProductFallback] = useState(null);
  const [previousProductPage, setPreviousProductPage] = useState("products");
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [mockups, setMockups] = useState([]);
  const [selectedMockups, setSelectedMockups] = useState([]);
  const [mockupLoading, setMockupLoading] = useState(false);
  const [mockupError, setMockupError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingId),
    [editingId, products]
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || selectedProductFallback,
    [products, selectedProductId, selectedProductFallback]
  );

  // Page -> URL. A new history entry per page, so Back returns to the previous screen.
  const routeId = page === "productDetail" ? selectedProductId : page === "edit" ? editingId : "";
  useEffect(() => {
    const hash = routeHash(page, routeId);
    if (!window.location.hash) {
      window.history.replaceState(null, "", hash);
    } else if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, [page, routeId]);

  // URL -> page, for the browser's back/forward buttons and edited addresses.
  useEffect(() => {
    function syncFromUrl() {
      const route = readRoute();
      setPage(route.page);
      if (route.page === "productDetail") setSelectedProductId(route.id);
      if (route.page === "edit") setEditingId(route.id);
    }
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("hashchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("hashchange", syncFromUrl);
    };
  }, []);

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

  async function refreshOrders() {
    setLoading(true);
    setError("");
    try {
      setOrders(await listOrders());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentPage() {
    if (page === "orders") {
      await refreshOrders();
      return;
    }
    await refreshProducts();
  }

  useEffect(() => {
    refreshProducts();
    refreshOrders();
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setForm(mergeProduct(editingProduct));
      setImages([]);
      setEditAdditionalImages([]);
    }
  }, [editingProduct]);

  async function buildMockups(file) {
    setMockupLoading(true);
    setMockupError("");
    try {
      const generated = await generateMockups(file);
      setMockups(generated);
      setSelectedMockups(generated.map((mockup) => mockup.key));
      return generated;
    } catch (err) {
      setMockups([]);
      setMockupError(`Could not generate mockups: ${err.message}`);
      return [];
    } finally {
      setMockupLoading(false);
    }
  }

  function clearMockups() {
    mockups.forEach((mockup) => URL.revokeObjectURL(mockup.url));
    setMockups([]);
    setSelectedMockups([]);
    setMockupError("");
  }

  // New uploads: build the mockups as soon as the main image is chosen.
  const chosenUploadImage = page === "upload" && uploadStep === "image" ? images[0] : null;
  useEffect(() => {
    if (chosenUploadImage) buildMockups(chosenUploadImage);
  }, [chosenUploadImage]);

  function toggleMockup(key) {
    setSelectedMockups((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  async function handleEditMockups() {
    setError("");
    try {
      let source = images[0];
      if (!source) {
        const response = await fetch(form.media.featuredImage);
        if (!response.ok) throw new Error("Could not download the current main image");
        const blob = await response.blob();
        source = new File([blob], `${form.slug || form.id || "poster"}.jpg`, { type: blob.type });
      }
      const generated = await buildMockups(source);
      setEditAdditionalImages((current) => [...current.filter(Boolean), ...generated.map((mockup) => mockup.file)]);
      if (generated.length) setNotice(`${generated.length} mockups added to Additional Images. Save to upload them.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function useImageForProduct(file) {
    resetUpload();
    setImages([file]);
    setImagePreview(URL.createObjectURL(file));
    setPage("upload");
    setNotice("Image loaded into Upload Product.");
  }

  function resetUpload() {
    clearMockups();
    setForm(cloneTemplate());
    setImages([]);
    setImagePreview("");
    setUploadStep("image");
    setSizes(standardSizes());
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

  // Saves one poster from Bulk Upload: the Gemini draft plus the sizes and mockups
  // chosen for the whole batch.
  async function createBulkProduct(draft, productSizes, mockupFiles) {
    const merged = mergeAiDraft(cloneTemplate(), draft);
    const product = {
      ...merged,
      id: generateProductId(merged),
      sku: generateSku(merged),
      createdAt: merged.createdAt || new Date().toISOString().slice(0, 10)
    };
    await createProduct(productPayload({ ...product, sizes: productSizes }), mockupFiles);
  }

  async function handleBulkFinished(count) {
    setNotice(`${count} product${count === 1 ? "" : "s"} uploaded.`);
    await refreshProducts();
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
      const draft = await createProductDraftFromImage(await fitUploadLimit(images[0]));
      const editing = page === "edit";
      setForm((current) => {
        const merged = mergeAiDraft(current, draft);
        if (editing) {
          // Keep the product's identity and existing gallery; only the copy is refreshed.
          return {
            ...merged,
            id: current.id,
            sku: current.sku || generateSku(merged),
            slug: current.slug || merged.slug,
            media: {
              ...merged.media,
              gallery: [...new Set([...(merged.media?.gallery || []), ...(current.media?.gallery || [])])],
              cloudinary: [...(merged.media?.cloudinary || []), ...(current.media?.cloudinary || [])]
            }
          };
        }
        return {
          ...merged,
          id: generateProductId(merged),
          sku: generateSku(merged),
          createdAt: merged.createdAt || new Date().toISOString().slice(0, 10)
        };
      });
      if (!editing) {
        setAdditionalImages(mockups.filter((mockup) => selectedMockups.includes(mockup.key)).map((mockup) => mockup.file));
        setUploadStep("details");
      }
      setImages([]);
      setImagePreview("");
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

  function updateInventoryDraft(productId, updater) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setInventoryDrafts((current) => {
      const draft = current[productId] || inventoryDraftFromProduct(product);
      return {
        ...current,
        [productId]: updater(structuredClone(draft))
      };
    });
  }

  function handleInventoryTotalStock(productId, value) {
    updateInventoryDraft(productId, (draft) => {
      const requestedTotal = Number(value || 0);
      if (!draft.rows.length) return { ...draft, totalStock: value };

      const otherRowsTotal = draft.rows.slice(1).reduce((total, row) => total + Number(row.stock || 0), 0);
      draft.rows[0] = {
        ...draft.rows[0],
        stock: Math.max(0, requestedTotal - otherRowsTotal)
      };
      draft.totalStock = draft.rows.reduce((total, row) => total + Number(row.stock || 0), 0);
      return draft;
    });
  }

  function handleInventoryRowChange(productId, rowIndex, key, value) {
    updateInventoryDraft(productId, (draft) => {
      draft.rows[rowIndex] = { ...draft.rows[rowIndex], [key]: value };
      if (key === "stock") {
        draft.totalStock = draft.rows.reduce((total, row) => total + Number(row.stock || 0), 0);
      }
      return draft;
    });
  }

  function handleInventoryAddRow(productId) {
    updateInventoryDraft(productId, (draft) => ({
      ...draft,
      rows: [...draft.rows, { type: "Small", inches: "", price: "", stock: "", sku: "" }]
    }));
    setExpandedInventoryIds((current) => (current.includes(productId) ? current : [...current, productId]));
  }

  function handleInventoryRemoveRow(productId, rowIndex) {
    updateInventoryDraft(productId, (draft) => {
      const rows = draft.rows.filter((_, index) => index !== rowIndex);
      return {
        ...draft,
        rows,
        totalStock: rows.reduce((total, row) => total + Number(row.stock || 0), 0)
      };
    });
  }

  function handleInventoryDiscard(productId) {
    setInventoryDrafts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function toggleInventoryExpanded(productId) {
    setExpandedInventoryIds((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ));
  }

  function expandAllInventory() {
    setExpandedInventoryIds(products.map((product) => product.id));
  }

  function collapseAllInventory() {
    setExpandedInventoryIds([]);
  }

  async function saveInventoryProduct(productId) {
    const product = products.find((item) => item.id === productId);
    const draft = inventoryDrafts[productId] || (product ? inventoryDraftFromProduct(product) : null);
    if (!product || !draft) {
      setError("Choose a product to update inventory.");
      return false;
    }

    const usableRows = draft.rows.filter((row) => row.type && row.inches && row.price !== "");
    if (!usableRows.length) {
      setError("Add at least one size with inches and price.");
      return false;
    }

    const payload = productPayload(
      { ...mergeProduct(product), sizes: usableRows },
      { inventoryStockOverride: toNumber(draft.totalStock) }
    );
    await updateProduct(product.id, payload, []);
    handleInventoryDiscard(product.id);
    return true;
  }

  async function handleInventorySave(productId) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveInventoryProduct(productId);
      if (saved) {
        await refreshProducts();
        setNotice("Inventory and prices updated.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInventorySaveAll(productIds) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      let savedCount = 0;
      for (const productId of productIds) {
        const saved = await saveInventoryProduct(productId);
        if (saved) savedCount += 1;
      }
      await refreshProducts();
      setNotice(`${savedCount} product${savedCount === 1 ? "" : "s"} updated.`);
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
      if (selectedProductId === productId) {
        setSelectedProductId("");
        setSelectedProductFallback(null);
        setPage("products");
      }
      await refreshProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOrderStatusChange(order, status) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const statusMeta = orderStatuses.find((item) => item.value === status);
      await updateOrder(order.id, {
        ...order,
        status,
        statusLabel: statusMeta?.label || status,
        ...orderTimestampUpdates(order, status),
        updatedAt: new Date().toISOString()
      });
      setNotice("Order status updated.");
      await refreshOrders();
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

  function goProductDetail(product) {
    setSelectedProductId(product?.id || "");
    setSelectedProductFallback(product || null);
    setPreviousProductPage(page === "productDetail" ? previousProductPage : page);
    setPage("productDetail");
  }

  function leaveProductDetail() {
    setPage(previousProductPage || "products");
  }

  const title = {
    upload: "Upload Product",
    bulk: "Bulk Upload",
    edit: "Edit Product",
    inventory: "Inventory & Prices",
    orders: "Orders",
    products: "All Products",
    tools: "Image Tools",
    productDetail: selectedProduct?.name || "Product Detail"
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
            <PackagePlus size={18} /> Upload Product
          </button>
          <button className={page === "bulk" ? "active" : ""} onClick={() => setPage("bulk")}>
            <Layers size={18} /> Bulk Upload
          </button>
          <button className={page === "edit" ? "active" : ""} onClick={() => setPage("edit")}>
            <Edit3 size={18} /> Edit Product
          </button>
          <button className={page === "inventory" ? "active" : ""} onClick={() => setPage("inventory")}>
            <Boxes size={18} /> Inventory & Prices
          </button>
          <button className={page === "orders" ? "active" : ""} onClick={() => setPage("orders")}>
            <ShoppingBag size={18} /> Orders
          </button>
          <button className={page === "products" || page === "productDetail" ? "active" : ""} onClick={() => setPage("products")}>
            <LayoutGrid size={18} /> All Products
          </button>
          <button className={page === "tools" ? "active" : ""} onClick={() => setPage("tools")}>
            <Crop size={18} /> Image Tools
          </button>
        </nav>
        <div className="api-box">
          <span>API base</span>
          <strong>{apiRoutes.baseUrl}</strong>
        </div>
        <div className="session-box">
          <span>Signed in as <strong>{adminSession.username}</strong></span>
          <button type="button" className="secondary-button" onClick={onLogout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Product Management</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={refreshCurrentPage} disabled={loading} title="Refresh">
            <RefreshCcw size={16} />
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
              >
                <MockupGallery
                  mockups={mockups}
                  selected={selectedMockups}
                  onToggle={toggleMockup}
                  loading={mockupLoading}
                  error={mockupError}
                  note={mockups.length ? "Selected mockups are added to the product's gallery. Click one to leave it out." : ""}
                />
              </ImageDraftStep>
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

        {page === "bulk" && (
          <BulkUpload defaultSizes={standardSizes()} products={products} onCreateProduct={createBulkProduct} onFinished={handleBulkFinished} />
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
                onGenerateMockups={handleEditMockups}
                mockupLoading={mockupLoading}
              />
            ) : (
              <p className="empty">Select a product from the dropdown to edit its full syntax fields.</p>
            )}
          </section>
        )}

        {page === "inventory" && (
          <InventoryManager
            products={products}
            drafts={inventoryDrafts}
            expandedProductIds={expandedInventoryIds}
            onSave={handleInventorySave}
            onSaveAll={handleInventorySaveAll}
            onDiscard={handleInventoryDiscard}
            onUpdateTotalStock={handleInventoryTotalStock}
            onUpdateRow={handleInventoryRowChange}
            onAddRow={handleInventoryAddRow}
            onRemoveRow={handleInventoryRemoveRow}
            onExpand={toggleInventoryExpanded}
            onExpandAll={expandAllInventory}
            onCollapseAll={collapseAllInventory}
            sortKey={inventorySort}
            onSort={setInventorySort}
            loading={loading}
          />
        )}

        {page === "orders" && (
          <OrdersManager
            orders={orders}
            products={products}
            loading={loading}
            onStatusChange={handleOrderStatusChange}
            onOpenProduct={goProductDetail}
          />
        )}

        {page === "productDetail" && selectedProduct && (
          <ProductDetailPage
            product={selectedProduct}
            onBack={leaveProductDetail}
            onEdit={goEdit}
            onDelete={handleDelete}
          />
        )}

        {page === "tools" && <ImageTools onUseForProduct={useImageForProduct} />}

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
                <ProductCard key={product.id} product={product} onEdit={goEdit} onDelete={handleDelete} onOpen={goProductDetail} />
              ))}
              {!products.length && <p className="empty">No products yet.</p>}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

// Shows the login screen until there is a valid admin session.
function App() {
  const [session, setSession] = useState(getAdminSession);
  const [checking, setChecking] = useState(() => Boolean(getAdminSession()));
  const [loginNotice, setLoginNotice] = useState("");

  useEffect(() => {
    if (!session) return;
    checkAdminSession().then((valid) => {
      if (!valid) {
        clearAdminSession();
        setSession(null);
        setLoginNotice("Your session has expired. Please log in again.");
      }
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    function handleExpired() {
      setSession(null);
      setLoginNotice("Your session has expired. Please log in again.");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  if (checking) return null;

  if (!session) {
    return (
      <AdminLogin
        notice={loginNotice}
        onLoggedIn={(nextSession) => {
          setLoginNotice("");
          setSession(nextSession);
        }}
      />
    );
  }

  return (
    <ConsoleApp
      adminSession={session}
      onLogout={() => {
        clearAdminSession();
        setSession(null);
        setLoginNotice("You have been logged out.");
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(<App />);




