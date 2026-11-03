import { fitUploadLimit, generateMockups, mockupTypes } from "./posterMockups.js";

// Gallery images are recognised as generated mockups by their caption ("Room wall",
// "Held in hand", ...), so other photos the admin added are never touched.
const MOCKUP_LABELS = new Set(mockupTypes.map((type) => type.label));

async function downloadMainImage(product) {
  const url = product.media?.featuredImage || product.media?.thumbnail;
  if (!url) throw new Error("this product has no main image to build mockups from");
  const response = await fetch(url);
  if (!response.ok) throw new Error("could not download the current main image");
  const blob = await response.blob();
  return new File([blob], `${product.slug || product.id || "poster"}.jpg`, { type: blob.type || "image/jpeg" });
}

// Builds fresh mockups and works out the product's new media. With newMainFile the
// main image is replaced too; without it the current main image is reused.
// Returns { media, files }: send media as the product update and files as its uploads.
export async function rebuildProductImages(product, newMainFile = null) {
  const media = product.media || {};
  const oldMockups = new Set(
    (media.galleryLabels || []).filter((entry) => MOCKUP_LABELS.has(entry?.label)).map((entry) => entry.url)
  );
  const dropped = (url) => oldMockups.has(url) || (Boolean(newMainFile) && url === media.featuredImage);

  const source = newMainFile || (await downloadMainImage(product));
  const mockups = await generateMockups(source);
  mockups.forEach((mockup) => URL.revokeObjectURL(mockup.url));

  const nextMedia = {
    ...media,
    gallery: (media.gallery || []).filter((url) => !dropped(url)),
    cloudinary: (media.cloudinary || []).filter((image) => !dropped(image?.url)),
    galleryLabels: (media.galleryLabels || []).filter((entry) => !dropped(entry?.url))
  };
  if (newMainFile) {
    // Left out so the backend makes the first upload (the new photo) the main image.
    delete nextMedia.featuredImage;
    delete nextMedia.thumbnail;
  }

  const files = [...(newMainFile ? [await fitUploadLimit(newMainFile)] : []), ...mockups.map((mockup) => mockup.file)];
  return { media: nextMedia, files, mockupCount: mockups.length };
}

// Words in the search box all have to appear somewhere in the product's name, id,
// SKU, category or collections.
export function matchesProductSearch(product, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    product.name,
    product.id,
    product.sku,
    product.subtitle,
    product.category?.main,
    product.category?.subCategory,
    ...(product.collections || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}
