import { config } from './config.js';
import { representativeVariant } from './catalog-model.js';

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED', errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

// Every endpoint is defined here, never scattered across page controllers.
const endpoints = Object.freeze({
  products: 'products.php', product: 'product.php', brands: 'brands.php',
  posts: 'posts.php', post: 'post.php', session: 'auth/session.php',
  login: 'auth/login.php', register: 'auth/register.php', logout: 'auth/logout.php',
  orders: 'orders.php', order: 'order.php', contact: 'contact.php',
});

const fixtureCache = new Map();
let csrfToken = null;

function urlFor(base, path, params = {}) {
  const url = new URL(path, new URL(base, document.baseURI));
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }
  return url;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'same-origin' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new ApiError('Máy chủ chưa trả dữ liệu JSON hợp lệ. Vui lòng thử lại sau.', response.status, 'INVALID_RESPONSE');
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new ApiError('Dữ liệu phản hồi không hợp lệ.', response.status, 'INVALID_RESPONSE'); }
    if (!response.ok || payload.success === false) {
      const error = payload.error || {};
      throw new ApiError(error.message || payload.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.', response.status, error.code || 'REQUEST_FAILED', error.fields || error.errors || {});
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') throw new ApiError('Yêu cầu quá thời gian chờ. Vui lòng thử lại.', 0, 'TIMEOUT');
    throw new ApiError('Không thể kết nối máy chủ. Hãy kiểm tra kết nối và thử lại.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

async function liveRequest(endpoint, { method = 'GET', params, body, csrf = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    if (csrf && !csrfToken) {
      const session = await liveRequest(endpoints.session, { csrf: false });
      csrfToken = session.csrf_token;
      if (!csrfToken) throw new ApiError('Phiên bảo mật chưa sẵn sàng. Vui lòng tải lại trang.', 0, 'CSRF_UNAVAILABLE');
    }
    headers['Content-Type'] = 'application/json';
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }
  const payload = await fetchJson(urlFor(config.apiBaseUrl, endpoint, params), {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (payload.success !== true || !Object.hasOwn(payload, 'data')) {
    throw new ApiError('Phản hồi API không đúng cấu trúc đã thống nhất.', 0, 'INVALID_RESPONSE');
  }
  if (payload.data?.csrf_token) csrfToken = payload.data.csrf_token;
  return payload.data;
}

async function fixture(name) {
  if (!fixtureCache.has(name)) {
    const pending = fetchJson(urlFor(config.mockBaseUrl, `${name}.json`));
    fixtureCache.set(name, pending);
    pending.catch(() => fixtureCache.delete(name));
  }
  // The cache contains only fixture files, never authentication or submitted data.
  return fixtureCache.get(name);
}

function unavailable() {
  throw new ApiError('Đây là bản trình diễn giao diện. Chức năng này chưa kết nối máy chủ; thông tin chưa được gửi hoặc lưu.', 503, 'API_NOT_CONFIGURED');
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
}

function pageOf(items, params = {}) {
  const perPage = Math.max(1, Math.min(50, Number.parseInt(params.per_page, 10) || 12));
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page, 10) || 1));
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    pagination: { page, per_page: perPage, total: items.length, total_pages: totalPages },
  };
}

const truthy = value => value === true || value === 'true' || value === 1 || value === '1';

async function mockProducts(params = {}, options = {}) {
  if (['featured', 'new', 'sale'].includes(options.homeSection)) {
    const section = options.homeSection === 'featured'
      ? `featured-${/^[a-z0-9-]+$/.test(params.brand || '') ? params.brand : 'all'}`
      : options.homeSection;
    return pageOf(await fixture(`catalog/home/${section}`), params);
  }
  let products = [...await fixture('catalog/index')];
  if (params.q) products = products.filter(product => normalize(product.name).includes(normalize(params.q).trim()));
  if (params.brand) {
    const brands = (Array.isArray(params.brand) ? params.brand : String(params.brand).split(',')).map(normalize);
    products = products.filter(product => brands.some(brand => [product.brand.slug, product.brand.name, String(product.brand.id)].map(normalize).includes(brand)));
  }
  if (truthy(params.featured)) products = products.filter(product => product.featured);
  if (truthy(params.is_new)) products = products.filter(product => product.is_new);
  // Match every variant-level condition together and sort by the price the card displays.
  products = products.filter(product => representativeVariant(product, params));
  const priceOf = product => Number(representativeVariant(product, params).price);
  switch (params.sort) {
    case 'price_asc': products.sort((a, b) => priceOf(a) - priceOf(b)); break;
    case 'price_desc': products.sort((a, b) => priceOf(b) - priceOf(a)); break;
    case 'name_asc': products.sort((a, b) => a.name.localeCompare(b.name, 'vi')); break;
    default: products.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const result = pageOf(products, params);
  result.items = await Promise.all(result.items.map(product => mockDetail('products', product.id)));
  return result;
}

async function mockDetail(name, id) {
  let item;
  if (name === 'products') {
    let productId = id;
    if (!/^[1-9][0-9]*$/.test(String(id))) {
      productId = (await fixture('catalog/index')).find(entry => entry.slug === id)?.id;
    }
    if (!productId || !/^[1-9][0-9]*$/.test(String(productId))) throw new ApiError('Không tìm thấy sản phẩm này.', 404, 'NOT_FOUND');
    try { item = await fixture(`catalog/products/${productId}`); }
    catch (error) { if (error.status === 404) throw new ApiError('Không tìm thấy sản phẩm này.', 404, 'NOT_FOUND'); throw error; }
  } else item = (await fixture(name)).find(entry => String(entry.id) === String(id) || entry.slug === id);
  if (!item) throw new ApiError(name === 'products' ? 'Không tìm thấy sản phẩm này.' : 'Không tìm thấy bài viết này.', 404, 'NOT_FOUND');
  return item;
}

function useMock() {
  if (!['mock', 'api'].includes(config.dataSource)) throw new ApiError('Cấu hình nguồn dữ liệu không hợp lệ.', 0, 'INVALID_CONFIG');
  return config.dataSource === 'mock';
}

export const api = Object.freeze({
  getProducts: (params = {}, options = {}) => useMock() ? mockProducts(params, options) : liveRequest(endpoints.products, { params }),
  getProduct: id => useMock() ? mockDetail('products', id) : liveRequest(endpoints.product, { params: { id } }),
  getBrands: () => useMock() ? fixture('brands') : liveRequest(endpoints.brands),
  getPosts: async (params = {}) => {
    if (!useMock()) return liveRequest(endpoints.posts, { params });
    let posts = [...await fixture('posts')].sort((a, b) => b.published_at.localeCompare(a.published_at));
    if (params.q) posts = posts.filter(post => normalize(`${post.title} ${post.excerpt}`).includes(normalize(params.q).trim()));
    if (params.category) posts = posts.filter(post => post.category === params.category);
    return pageOf(posts, params);
  },
  getPost: id => useMock() ? mockDetail('posts', id) : liveRequest(endpoints.post, { params: { id } }),
  session: async () => useMock() ? unavailable() : liveRequest(endpoints.session),
  login: async body => useMock() ? unavailable() : liveRequest(endpoints.login, { method: 'POST', body }),
  register: async body => useMock() ? unavailable() : liveRequest(endpoints.register, { method: 'POST', body }),
  logout: async () => {
    if (useMock()) unavailable();
    const result = await liveRequest(endpoints.logout, { method: 'POST', body: {} });
    csrfToken = null;
    return result;
  },
  createOrder: async body => useMock() ? unavailable() : liveRequest(endpoints.orders, { method: 'POST', body }),
  getOrders: async (params = {}) => useMock() ? unavailable() : liveRequest(endpoints.orders, { params }),
  getOrder: async id => useMock() ? unavailable() : liveRequest(endpoints.order, { params: { id } }),
  sendContact: async body => useMock() ? unavailable() : liveRequest(endpoints.contact, { method: 'POST', body }),
});
