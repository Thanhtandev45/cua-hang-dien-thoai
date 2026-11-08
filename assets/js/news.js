import { api } from './api.js';
import { escapeHTML, icon, loading, emptyState, renderError, breadcrumb } from './ui.js';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}
function imagePath(value) {
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : 'assets/images/editorial-guide.svg';
  } catch { return 'assets/images/editorial-guide.svg'; }
}
export function postCard(post, featured = false) {
  return `<article class="news-card ${featured ? 'news-card-featured' : ''}"><a class="news-card-image" href="article.html?id=${encodeURIComponent(post.id)}" tabindex="-1" aria-hidden="true"><img src="${escapeHTML(imagePath(post.image))}" alt="" loading="lazy" width="640" height="400"></a><div class="news-card-content"><div class="news-meta"><span>${escapeHTML(post.category || 'Góc công nghệ')}</span><time datetime="${escapeHTML(post.published_at)}">${formatDate(post.published_at)}</time></div><h2><a href="article.html?id=${encodeURIComponent(post.id)}">${escapeHTML(post.title)}</a></h2><p>${escapeHTML(post.excerpt)}</p><a class="text-link" href="article.html?id=${encodeURIComponent(post.id)}">Đọc bài viết ${icon('arrow-right', 16)}<span class="sr-only">: ${escapeHTML(post.title)}</span></a></div></article>`;
}

export async function initNewsPage(root = document.querySelector('#main')) {
  document.title = 'Góc công nghệ | NOVA Mobile';
  const initial = new URLSearchParams(location.search);
  const state = { q: initial.get('q') || '', page: Math.max(1, Number.parseInt(initial.get('page'), 10) || 1), per_page: 6 };
  root.innerHTML = `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Góc công nghệ' }])}<section class="section"><div class="news-page-heading"><div><span class="eyebrow">KẾT NỐI VỚI THẾ GIỚI CÔNG NGHỆ</span><h1>Góc công nghệ</h1><p class="muted">Những câu chuyện, mẹo hay và góc nhìn giúp bạn chọn đúng.</p></div><form class="news-search" role="search"><label class="sr-only" for="news-query">Tìm bài viết</label>${icon('search')}<input id="news-query" name="q" type="search" placeholder="Tìm bài viết…" value="${escapeHTML(state.q)}" maxlength="200"><button type="submit" class="button button-primary">Tìm</button></form></div><div class="notice news-demo-note">Nội dung biên tập mẫu dành cho bản trải nghiệm giao diện.</div><div id="news-results" aria-live="polite">${loading(3)}</div></section></div>`;
  const results = root.querySelector('#news-results');
  let request = 0;
  async function load() {
    const sequence = ++request;
    results.setAttribute('aria-busy', 'true');
    results.innerHTML = loading(3);
    try {
      const result = await api.getPosts(state);
      if (sequence !== request) return;
      const items = result.items || [];
      const pagination = result.pagination || { total: items.length, total_pages: 1 };
      const params = new URLSearchParams();
      if (state.q) params.set('q', state.q);
      if (state.page > 1) params.set('page', String(state.page));
      history.replaceState(null, '', `news.html${params.size ? `?${params}` : ''}`);
      if (!items.length) {
        results.innerHTML = emptyState('Chưa tìm thấy bài viết phù hợp', 'Thử một từ khóa khác hoặc khám phá tất cả bài viết.', 'news.html', 'Xem tất cả bài viết');
      } else {
        results.innerHTML = `<div class="news-results-heading"><p class="muted">${Number(pagination.total) || items.length} bài viết${state.q ? ` cho “${escapeHTML(state.q)}”` : ''}</p><span class="muted">Trang ${state.page} / ${Math.max(1, pagination.total_pages || 1)}</span></div><div class="news-grid">${items.map(post => postCard(post)).join('')}</div>${pagination.total_pages > 1 ? `<nav class="pagination" aria-label="Phân trang bài viết">${Array.from({ length: pagination.total_pages }, (_, index) => `<button type="button" data-page="${index + 1}" class="${state.page === index + 1 ? 'active' : ''}" ${state.page === index + 1 ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')}</nav>` : ''}`;
        results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); root.querySelector('h1').scrollIntoView({ block: 'start', behavior: 'smooth' }); }));
      }
    } catch (error) { if (sequence === request) renderError(results, error, load); }
    finally { if (sequence === request) results.setAttribute('aria-busy', 'false'); }
  }
  root.querySelector('.news-search').addEventListener('submit', event => {
    event.preventDefault();
    state.q = root.querySelector('#news-query').value.trim();
    state.page = 1;
    load();
  });
  await load();
}

export async function initArticlePage(root = document.querySelector('#main')) {
  document.title = 'Bài viết | NOVA Mobile';
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { root.innerHTML = `<div class="container section">${emptyState('Chưa chọn bài viết', 'Khám phá những câu chuyện mới trong góc công nghệ.', 'news.html', 'Xem bài viết')}</div>`; return; }
  root.innerHTML = `<div class="container section">${loading(3)}</div>`;
  try {
    const post = await api.getPost(id);
    if (!post?.id) throw Object.assign(new Error('Bài viết không tồn tại.'), { status: 404 });
    document.title = `${post.title} | NOVA Mobile`;
    root.innerHTML = `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Góc công nghệ', href: 'news.html' }, { label: post.title }])}<section class="section article-section"><article class="article-content"><header class="article-header"><div class="news-meta"><span>${escapeHTML(post.category || 'Góc công nghệ')}</span><time datetime="${escapeHTML(post.published_at)}">${formatDate(post.published_at)}</time></div><h1>${escapeHTML(post.title)}</h1><p class="article-excerpt">${escapeHTML(post.excerpt)}</p><div class="article-byline">Biên tập bởi NOVA Mobile <span>·</span> Nội dung mẫu</div></header><img class="article-cover" src="${escapeHTML(imagePath(post.image))}" alt="Minh họa cho ${escapeHTML(post.title)}" width="960" height="600"><div class="article-body">${(Array.isArray(post.content) ? post.content : [post.content || post.excerpt]).map(paragraph => `<p>${escapeHTML(typeof paragraph === 'string' ? paragraph : paragraph.text || '')}</p>`).join('')}<div class="notice">Bài viết mẫu phục vụ phát triển giao diện, không phải thông tin giá bán hoặc cam kết từ nhà sản xuất.</div></div><div class="article-bottom"><a class="text-link" href="news.html">← Quay lại góc công nghệ</a><a class="button button-primary" href="products.html">Khám phá điện thoại ${icon('arrow-right')}</a></div></article><div class="related-news" id="related-news"></div></section></div>`;
    try {
      const related = await api.getPosts({ per_page: 4, page: 1 });
      const items = (related.items || []).filter(item => String(item.id) !== String(post.id)).slice(0, 3);
      if (items.length) root.querySelector('#related-news').innerHTML = `<div class="section-heading"><div><span class="eyebrow">TIẾP TỤC KHÁM PHÁ</span><h2>Có thể bạn quan tâm</h2></div><a class="text-link" href="news.html">Tất cả bài viết ${icon('arrow-right', 16)}</a></div><div class="news-grid">${items.map(item => postCard(item)).join('')}</div>`;
    } catch { /* The article remains readable if related content cannot load. */ }
  } catch (error) {
    if (error.status === 404) root.innerHTML = `<div class="container section">${emptyState('Bài viết không tồn tại', 'Bài viết có thể đã được chuyển hoặc chưa được xuất bản.', 'news.html', 'Xem các bài viết khác')}</div>`;
    else renderError(root, error, () => initArticlePage(root));
  }
}
