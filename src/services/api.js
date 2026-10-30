import { mockupLabelFor } from "../utils/posterMockups.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const apiRoutes = {
  baseUrl: API_BASE_URL,
  products: "/api/products",
  productDraftFromImage: "/api/products/draft-from-image",
  product: (id) => `/api/products/${encodeURIComponent(id)}`,
  orders: "/api/orders",
  order: (id) => `/api/orders/${encodeURIComponent(id)}`,
  users: "/api/users",
  user: (id) => `/api/users/${encodeURIComponent(id)}`
};

async function parseResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

// Admin session from /api/admin/login. Sent with every request; when the server
// rejects it, the console goes back to the login screen.
const SESSION_KEY = "postertown_admin_session";
export const SESSION_EXPIRED_EVENT = "postertown-admin-session-expired";

export function getAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return session?.token && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}

export async function loginAdmin(username, code) {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, code })
  });
  const data = await parseResponse(response);
  const session = {
    token: data.token,
    username: data.username,
    expiresAt: Date.now() + data.expiresInHours * 60 * 60 * 1000
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function checkAdminSession() {
  const session = getAdminSession();
  if (!session) return null;
  try {
    await request("/api/admin/session");
    return session;
  } catch {
    return null;
  }
}

async function request(route, options = {}) {
  const session = getAdminSession();
  const response = await fetch(`${API_BASE_URL}${route}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers
    }
  });

  if (response.status === 401 && session) {
    clearAdminSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  return parseResponse(response);
}

function productFormData(product, images = []) {
  const formData = new FormData();
  formData.append("product", JSON.stringify(product));
  images.forEach((image) => formData.append("images", image));
  // One label per image, in upload order, so the storefront can caption mockups.
  formData.append("imageLabels", JSON.stringify(images.map((image) => mockupLabelFor(image?.name))));
  return formData;
}

export function listCollections() {
  return request("/api/collections");
}

export function listProducts() {
  return request(apiRoutes.products);
}

export function createProduct(product, images) {
  return request(apiRoutes.products, {
    method: "POST",
    body: productFormData(product, images)
  });
}

export function updateProduct(id, product, images) {
  return request(apiRoutes.product(id), {
    method: "PATCH",
    body: productFormData(product, images)
  });
}

export function createProductDraftFromImage(image) {
  const formData = new FormData();
  formData.append("image", image);

  return request(apiRoutes.productDraftFromImage, {
    method: "POST",
    body: formData
  });
}

export function deleteProduct(id) {
  return request(apiRoutes.product(id), {
    method: "DELETE"
  });
}

export function listOrders() {
  return request(apiRoutes.orders);
}

export function createOrder(order) {
  return request(apiRoutes.orders, {
    method: "POST",
    body: JSON.stringify(order)
  });
}

export function updateOrder(id, order) {
  return request(apiRoutes.order(id), {
    method: "PATCH",
    body: JSON.stringify(order)
  });
}
