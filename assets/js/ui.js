import { representativeVariant } from './catalog-model.js';

export function escapeHTML(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

export const money = value => new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  cart:'<path d="M3 3h2l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/>',
  'shopping-cart':'<path d="M3 3h2l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/>',
  bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  phone:'<path d="m7 3 3 5-3 3a15 15 0 0 0 6 6l3-3 5 3c-1 6-7 5-12 0S2 4 7 3Z"/>',
  smartphone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-left':'<path d="M20 12H4m6-6-6 6 6 6"/>',
  'chevron-right':'<path d="m9 5 7 7-7 7"/>',
  'chevron-down':'<path d="m5 9 7 7 7-7"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  truck:'<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  refresh:'<path d="M20 8V3l-3 3a8 8 0 1 0 3 10M20 8h-5"/>',
  package:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10M7 4.8l10 5.5"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  'map-pin':'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'credit-card':'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h3"/>',
  lock:'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':'<path d="m3 3 18 18M10 5c7-1 12 7 12 7a20 20 0 0 1-4 4M14 19C7 20 2 12 2 12a20 20 0 0 1 4-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  'trash-2':'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  filter:'<path d="M3 6h18M6 12h12M10 18h4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  'alert-circle':'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
  headphones:'<path d="M4 15v-3a8 8 0 0 1 16 0v3M4 12h3v8H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2ZM20 12h-3v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Z"/>',
  'log-out':'<path d="M9 3H4v18h5M10 12h12m-5-5 5 5-5 5"/>',
};
export function icon(name, size = 20) {
  return `<svg width="${Number(size) || 20}" height="${Number(size) || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}

export function imageUrl(path) {
  try { const url = new URL(path || 'assets/images/fallback.svg', document.baseURI); return ['http:','https:'].includes(url.protocol) ? escapeHTML(url.href) : 'assets/images/fallback.svg'; } catch { return 'assets/images/fallback.svg'; }
}

export function breadcrumb(items = []) {
  items = items.filter((item,index) => !(index === 0 && (item.href === 'index.html' || item.label === 'Trang chủ')));
  return `<nav class="breadcrumb" aria-label="Đường dẫn"><a href="index.html">Trang chủ</a>${items.map(item => `${icon('chevron-right',12)}${item.href ? `<a href="${escapeHTML(item.href)}">${escapeHTML(item.label)}</a>` : `<span aria-current="page">${escapeHTML(item.label)}</span>`}`).join('')}</nav>`;
}

export function productCard(product, filters = {}) {
  const variant = representativeVariant(product, filters);
  if (!variant) return '';
  const discount = Number(variant.original_price) > Number(variant.price) ? Math.round((1 - variant.price / variant.original_price) * 100) : 0;
  const href = `product.html?id=${encodeURIComponent(product.id)}&variant=${encodeURIComponent(variant.id)}`;
  return `<article class="product-card"><div class="product-card-badges">${discount ? `<span class="badge badge-sale">Giảm ${discount}%</span>` : ''}${product.is_new ? '<span class="badge badge-new">Mới</span>' : ''}</div>
    <a class="product-image" href="${href}" tabindex="-1" aria-hidden="true"><img src="${imageUrl(variant.image || product.images?.[0])}" alt="" width="260" height="260" loading="lazy"></a>
    <div class="product-brand">${escapeHTML(product.brand?.name)}</div><h3 class="product-title"><a href="${href}">${escapeHTML(product.name)}</a></h3>
    <div class="product-meta">${escapeHTML(variant.storage)} · ${escapeHTML(variant.color)}</div>
    <div class="product-price-line"><span class="product-price">${money(variant.price)}</span>${discount ? `<span class="original-price">${money(variant.original_price)}</span>` : ''}</div>
    <div class="product-card-bottom"><span class="stock-status ${variant.stock > 0 ? '' : 'unavailable'}">${icon(variant.stock > 0 ? 'check-circle' : 'clock',14)}${variant.stock > 0 ? 'Còn hàng' : 'Tạm hết hàng'}</span><button class="icon-button" type="button" data-quick-add="${escapeHTML(product.id)}" data-variant-id="${escapeHTML(variant.id)}" aria-label="Thêm ${escapeHTML(product.name)} vào giỏ" ${variant.stock > 0 ? '' : 'disabled'}>${icon('plus',18)}</button></div></article>`;
}

export function emptyState(title, text, href, label = 'Khám phá sản phẩm') {
  return `<div class="empty-state"><div class="empty-state-icon">${icon('package',32)}</div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(text)}</p>${href ? `<a class="button button-primary" href="${escapeHTML(href)}">${escapeHTML(label)} ${icon('arrow-right',17)}</a>` : ''}</div>`;
}
export function loading(count = 4) {
  return `<div role="status" aria-label="Đang tải nội dung"><span class="sr-only">Đang tải nội dung…</span><div class="loading-grid">${Array.from({length:count}, () => '<div class="skeleton" aria-hidden="true"></div>').join('')}</div></div>`;
}
export function renderError(root, error, retry) {
  root.innerHTML = emptyState('Chưa thể tải nội dung', error?.message || 'Vui lòng thử lại sau.');
  if (retry) { const button = document.createElement('button'); button.className='button button-primary'; button.textContent='Thử lại'; button.addEventListener('click',retry); root.querySelector('.empty-state').append(button); }
}
export function toast(message, type = 'success') {
  let host = document.querySelector('.toast-container');
  if (!host) { host = document.createElement('div'); host.className='toast-container'; host.setAttribute('aria-live','polite'); document.body.append(host); }
  const element = document.createElement('div'); element.className=`toast ${type === 'error' ? 'error' : ''}`; element.setAttribute('role',type === 'error' ? 'alert' : 'status');
  element.innerHTML = `${icon(type === 'error' ? 'alert-circle' : 'check-circle',22)}<span></span><button type="button" aria-label="Đóng thông báo">${icon('x',16)}</button>`;
  element.querySelector('span').textContent=String(message); element.querySelector('button').addEventListener('click',()=>element.remove()); host.append(element); setTimeout(()=>element.remove(),5500);
}

export function confirmDialog({title, message, confirmLabel = 'Xác nhận'}) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.setAttribute('aria-labelledby','confirmation-title');
    dialog.setAttribute('aria-describedby','confirmation-message');
    dialog.innerHTML = `<form method="dialog"><h2 id="confirmation-title">${escapeHTML(title)}</h2><p id="confirmation-message">${escapeHTML(message)}</p><div class="button-row"><button type="submit" class="button button-outline" value="cancel" autofocus>Giữ lại</button><button type="submit" class="button button-primary" value="confirm">${escapeHTML(confirmLabel)}</button></div></form>`;
    dialog.addEventListener('close',()=>{const confirmed=dialog.returnValue==='confirm';dialog.remove();previousFocus?.focus();resolve(confirmed);},{once:true});
    document.body.append(dialog);
    dialog.showModal();
  });
}
export function postCard(post) {
  const href = `article.html?id=${encodeURIComponent(post.id)}`;
  return `<article class="news-card"><a class="news-card-image" href="${href}" tabindex="-1" aria-hidden="true"><img src="${imageUrl(post.image)}" width="800" height="460" alt="" loading="lazy"></a><div class="news-card-content"><div class="news-meta"><span>${escapeHTML(post.category)}</span><time datetime="${escapeHTML(post.published_at)}">${formatDate(post.published_at)}</time></div><h3><a href="${href}">${escapeHTML(post.title)}</a></h3><p>${escapeHTML(post.excerpt)}</p><a class="text-link" href="${href}">Đọc bài viết ${icon('arrow-right',16)}<span class="sr-only">: ${escapeHTML(post.title)}</span></a></div></article>`;
}
export function formatDate(value) {
  const date = new Date(value); return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'});
}
