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

async function request(route, options = {}) {
  const response = await fetch(`${API_BASE_URL}${route}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers
    }
  });

  return parseResponse(response);
}

function productFormData(product, images = []) {
  const formData = new FormData();
  formData.append("product", JSON.stringify(product));
  images.forEach((image) => formData.append("images", image));
  return formData;
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
