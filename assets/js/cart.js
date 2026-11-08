import { api } from './api.js';
import { escapeHTML, money, icon, toast, emptyState, loading, renderError, breadcrumb, confirmDialog } from './ui.js';

const STORAGE_KEY = 'nova-mobile.cart.v1';
const MAX_QUANTITY = 99;
const stockCache = new Map();
let memoryCart = null;
let storageWarningShown = false;
let lastIssues = [];
const sameId = (a, b) => String(a) === String(b);
const keyFor = (productId, variantId) => `${productId}:${variantId}`;
const validId = value => (typeof value === 'string' || typeof value === 'number') && /^[a-zA-Z0-9_-]{1,100}$/.test(String(value));

function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value.slice(0, 100)) {
    if (!item || !validId(item.product_id) || !validId(item.variant_id)) continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) continue;
    const existing = result.find(row => sameId(row.product_id, item.product_id) && sameId(row.variant_id, item.variant_id));
    if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + item.quantity);
    else result.push({ product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity });
  }
  return result;
}

export function getCart() {
  if (memoryCart) return memoryCart.map(item => ({ ...item }));
  try { return sanitizeCart(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return []; }
}

function saveCart(items) {
  const sanitized = sanitizeCart(items);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    memoryCart = null;
  } catch {
    memoryCart = sanitized;
    if (!storageWarningShown) {
      toast('Trình duyệt không cho lưu giỏ hàng. Giỏ chỉ được giữ trong tab này.', 'warning');
      storageWarningShown = true;
    }
  }
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: getCartCount() } }));
}

function validQuantity(quantity, stock = MAX_QUANTITY) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Số lượng phải là số nguyên từ 1 trở lên.');
  const maximum = Math.max(0, Math.min(MAX_QUANTITY, Number(stock) || 0));
  if (quantity > maximum) throw new Error(maximum ? `Bạn có thể chọn tối đa ${maximum} sản phẩm của phiên bản này.` : 'Phiên bản này hiện đã hết hàng.');
}

export function addItem(product, variantId, quantity = 1) {
  if (!product || !validId(product.id) || !Array.isArray(product.variants)) throw new Error('Sản phẩm không hợp lệ.');
  const variant = product.variants.find(item => sameId(item.id, variantId));
  if (!variant || !validId(variant.id)) throw new Error('Vui lòng chọn phiên bản hợp lệ.');
  validQuantity(quantity, variant.stock);
  if (!Number.isFinite(variant.price) || variant.price < 0) throw new Error('Giá của phiên bản này chưa hợp lệ.');
  const items = getCart();
  const existing = items.find(item => sameId(item.product_id, product.id) && sameId(item.variant_id, variant.id));
  const nextQuantity = (existing?.quantity || 0) + quantity;
  validQuantity(nextQuantity, variant.stock);
  stockCache.set(keyFor(product.id, variant.id), variant.stock);
  if (existing) existing.quantity = nextQuantity;
  else items.push({ product_id: product.id, variant_id: variant.id, quantity });
  saveCart(items);
}

export function updateQuantity(productId, variantId, quantity, stock) {
  if (quantity === 0) { removeItem(productId, variantId); return; }
  const items = getCart();
  const item = items.find(row => sameId(row.product_id, productId) && sameId(row.variant_id, variantId));
  if (!item) throw new Error('Sản phẩm không còn trong giỏ hàng.');
  validQuantity(quantity, stock ?? stockCache.get(keyFor(productId, variantId)) ?? MAX_QUANTITY);
  item.quantity = quantity;
  saveCart(items);
}

export function removeItem(productId, variantId) {
  saveCart(getCart().filter(item => !(sameId(item.product_id, productId) && sameId(item.variant_id, variantId))));
}

export function clearCart() { saveCart([]); lastIssues = []; }
export function getCartCount() { return getCart().reduce((sum, item) => sum + item.quantity, 0); }
export function getCartIssues() { return lastIssues.map(issue => ({ ...issue })); }

export async function getCartDetails() {
  const items = getCart();
  const issues = [];
  const products = new Map();
  await Promise.all([...new Set(items.map(item => String(item.product_id)))].map(async id => {
    try { products.set(id, await api.getProduct(id)); }
    catch (error) {
      if (error.status === 404 || error.code === 'NOT_FOUND') products.set(id, null);
      else throw error;
    }
  }));
  const details = [];
  for (const item of items) {
    const product = products.get(String(item.product_id));
    const variant = product?.variants?.find(entry => sameId(entry.id, item.variant_id));
    if (!product || !variant) {
      issues.push({ ...item, type: 'missing', message: `Sản phẩm #${item.product_id}, phiên bản #${item.variant_id} không còn khả dụng.` });
      continue;
    }
    stockCache.set(keyFor(product.id, variant.id), variant.stock);
    if (variant.stock < item.quantity) issues.push({ ...item, type: 'stock', message: `${product.name} (${variant.color}, ${variant.storage}): ${variant.stock > 0 ? `chỉ còn ${variant.stock} sản phẩm` : 'hiện đã hết hàng'}. Vui lòng cập nhật giỏ hàng.` });
    if (!Number.isFinite(variant.price) || variant.price < 0) issues.push({ ...item, type: 'price', message: `Giá của ${product.name} chưa hợp lệ. Vui lòng xóa sản phẩm này và thử lại sau.` });
    details.push({ product, variant, quantity: item.quantity });
  }
  lastIssues = issues;
  return details;
}

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) {
    memoryCart = null;
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: getCartCount() } }));
  }
});

export async function initCartPage(root = document.querySelector('#main')) {
  let rendering = false;
  let renderAgain = false;
  async function render() {
    if (rendering) { renderAgain = true; return; }
    rendering = true;
    root.innerHTML = `<div class="container section">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Giỏ hàng' }])}<div class="page-heading"><div><span class="eyebrow">SẴN SÀNG CHO TRẢI NGHIỆM MỚI</span><h1>Giỏ hàng của bạn</h1></div><div class="button-row"><a class="text-link" href="products.html">Tiếp tục mua sắm ${icon('arrow-right')}</a>${getCart().length ? `<button class="text-button cart-remove" type="button" data-clear-cart>${icon('trash',16)} Xóa giỏ hàng</button>` : ''}</div></div><div id="cart-content" aria-live="polite">${loading(2)}</div></div>`;
    const content = root.querySelector('#cart-content');
    try {
      const details = await getCartDetails();
      const issues = getCartIssues();
      if (!details.length && !issues.length) {
        content.innerHTML = emptyState('Giỏ hàng đang trống', 'Cùng tìm chiếc điện thoại phù hợp với bạn nhé.', 'products.html', 'Khám phá điện thoại');
        return;
      }
      const total = details.reduce((sum, item) => sum + (Number.isFinite(item.variant.price) ? item.variant.price : 0) * item.quantity, 0);
      const count = details.reduce((sum, item) => sum + item.quantity, 0);
      content.innerHTML = `<div class="cart-layout"><div class="cart-items">${issues.length ? `<div class="notice notice-warning" role="alert"><strong>Vui lòng kiểm tra lại giỏ hàng</strong>${issues.map(issue => `<p>${escapeHTML(issue.message)}${issue.type === 'missing' ? ` <button class="text-button" data-remove data-product="${escapeHTML(issue.product_id)}" data-variant="${escapeHTML(issue.variant_id)}">Xóa mục không khả dụng</button>` : ''}</p>`).join('')}</div>` : ''}${details.map(({ product, variant, quantity }) => `<article class="panel cart-item" data-product="${escapeHTML(product.id)}" data-variant="${escapeHTML(variant.id)}" data-stock="${escapeHTML(variant.stock)}"><a class="cart-item-image" href="product.html?id=${encodeURIComponent(product.id)}"><img src="${escapeHTML(variant.image || product.images[0])}" alt="${escapeHTML(product.name)}" width="110" height="130"></a><div class="cart-item-info"><span class="eyebrow">${escapeHTML(product.brand.name)}</span><h2><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHTML(product.name)}</a></h2><p class="muted">${escapeHTML(variant.color)} · ${escapeHTML(variant.storage)}</p><span class="stock ${variant.stock ? '' : 'out-of-stock'}">${variant.stock ? 'Còn hàng' : 'Tạm hết hàng'}</span><div class="cart-item-actions"><div class="quantity-control"><button type="button" data-quantity="-1" aria-label="Giảm số lượng ${escapeHTML(product.name)}" ${quantity <= 1 ? 'disabled' : ''}>${icon('minus',16)}</button><input type="number" min="1" max="${Math.min(MAX_QUANTITY, variant.stock)}" value="${quantity}" inputmode="numeric" aria-label="Số lượng ${escapeHTML(product.name)}" ${!variant.stock ? 'disabled' : ''}><button type="button" data-quantity="1" aria-label="Tăng số lượng ${escapeHTML(product.name)}" ${quantity >= Math.min(MAX_QUANTITY, variant.stock) ? 'disabled' : ''}>${icon('plus',16)}</button></div><button class="text-button cart-remove" type="button" data-remove aria-label="Xóa ${escapeHTML(product.name)}">${icon('trash',16)} Xóa</button></div></div><div class="cart-item-price"><strong>${money(variant.price * quantity)}</strong>${quantity > 1 ? `<small>${money(variant.price)} / sản phẩm</small>` : ''}</div></article>`).join('')}</div><aside class="panel order-summary"><h2>Tóm tắt giỏ hàng</h2><div class="summary-row"><span>Tạm tính (${count} sản phẩm)</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Vận chuyển</span><span>Chờ xác nhận</span></div><div class="summary-row summary-total"><span>Tổng tạm tính</span><strong>${money(total)}</strong></div><p class="muted small">Giá cuối cùng, tồn kho và phí giao hàng sẽ được xác nhận khi đặt hàng.</p>${issues.length ? '<button class="button button-primary button-full" disabled>Kiểm tra giỏ hàng để tiếp tục</button>' : `<a class="button button-primary button-full" href="checkout.html">Tiến hành thanh toán ${icon('arrow-right')}</a>`}<p class="secure-note">${icon('shield',16)} Thông tin mua hàng được bảo vệ</p></aside></div>`;
    } catch (error) {
      renderError(content, error, render);
    } finally {
      rendering = false;
      if (renderAgain) { renderAgain = false; void render(); }
    }
  }
  root.addEventListener('click', async event => {
    if (event.target.closest('[data-clear-cart]')) {
      const confirmed = await confirmDialog({ title: 'Xóa toàn bộ giỏ hàng?', message: 'Các sản phẩm trong giỏ sẽ được xóa. Bạn có thể thêm lại từ danh sách sản phẩm.', confirmLabel: 'Xóa giỏ hàng' });
      if (confirmed) { clearCart(); toast('Đã xóa giỏ hàng.'); void render(); }
      return;
    }
    const button = event.target.closest('[data-remove], [data-quantity]');
    if (!button || button.disabled) return;
    const row = button.closest('.cart-item') || button;
    const productId = row.dataset.product;
    const variantId = row.dataset.variant;
    try {
      if (button.hasAttribute('data-remove')) { removeItem(productId, variantId); toast('Đã xóa sản phẩm khỏi giỏ hàng.'); }
      else {
        const input = row.querySelector('input');
        updateQuantity(productId, variantId, Number(input.value) + Number(button.dataset.quantity), Number(row.dataset.stock));
      }
      void render();
    } catch (error) { toast(error.message, 'error'); }
  });
  root.addEventListener('change', event => {
    if (!event.target.matches('.quantity-control input')) return;
    const row = event.target.closest('.cart-item');
    try { updateQuantity(row.dataset.product, row.dataset.variant, Number(event.target.value), Number(row.dataset.stock)); }
    catch (error) { toast(error.message, 'error'); }
    void render();
  });
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) void render(); });
  await render();
}
