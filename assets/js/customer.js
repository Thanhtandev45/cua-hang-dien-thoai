import { api } from './api.js';
import { config } from './config.js';
import { escapeHTML, money, icon, loading, emptyState, renderError, breadcrumb, toast } from './ui.js';
import { validateForm, bindFieldFeedback, applyServerErrors, setFormMessage, setPending, requiredName, validEmail, phoneIsValid } from './auth.js';

const orderStatuses = {
  pending: ['Chờ xác nhận', 'pending'], confirmed: ['Đã xác nhận', 'confirmed'], processing: ['Đang chuẩn bị', 'confirmed'], shipping: ['Đang giao hàng', 'shipping'], delivered: ['Đã giao hàng', 'delivered'], cancelled: ['Đã hủy', 'cancelled'],
};
function statusBadge(status) {
  const [label, css] = Object.hasOwn(orderStatuses, status) ? orderStatuses[status] : ['Đang cập nhật', 'pending'];
  return `<span class="order-status ${css}">${label}</span>`;
}
const dateText = value => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Đang cập nhật' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};
function accountNav(active) {
  return `<aside class="panel account-nav"><div class="account-nav-title">${icon('user', 28)}<div><strong>Không gian của bạn</strong><small>Tài khoản NOVA</small></div></div><nav aria-label="Tài khoản"><a href="account.html" class="${active === 'account' ? 'active' : ''}" ${active === 'account' ? 'aria-current="page"' : ''}>${icon('user')} Thông tin cá nhân</a><a href="orders.html" class="${active === 'orders' ? 'active' : ''}" ${active === 'orders' ? 'aria-current="page"' : ''}>${icon('package')} Đơn hàng của tôi</a><a href="contact.html">${icon('mail')} Liên hệ hỗ trợ</a><a href="products.html">${icon('arrow-right')} Tiếp tục mua sắm</a></nav></aside>`;
}
function accountLayout(title, content, active = 'account') {
  return `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: title }])}<section class="section"><div class="page-heading"><span class="eyebrow">NOVA MEMBERS</span><h1>${escapeHTML(title)}</h1></div><div class="account-layout">${accountNav(active)}<div class="account-content">${content}</div></div></section></div>`;
}
function pendingAccount(title = 'Tài khoản đang chờ kết nối') {
  return `<div class="panel">${emptyState(title, 'Thông tin cá nhân và đơn hàng sẽ được hiển thị sau khi hệ thống tài khoản được tích hợp. Chưa có phiên đăng nhập hoặc dữ liệu đơn hàng được tạo.', 'products.html', 'Tiếp tục khám phá')}<p class="account-signin-link">Đã có tài khoản? <a href="login.html">Xem giao diện đăng nhập</a></p></div>`;
}
function loginRequired() {
  return `<div class="panel">${emptyState('Đăng nhập để tiếp tục', 'Đăng nhập tài khoản của bạn để xem thông tin cá nhân và đơn hàng.', 'login.html', 'Đăng nhập')}<p class="account-signin-link">Chưa có tài khoản? <a href="register.html">Đăng ký ngay</a></p></div>`;
}
async function requireUser() {
  const session = await api.session();
  return session?.user || null;
}

export async function initAccountPage(root = document.querySelector('#main')) {
  document.title = 'Tài khoản | NOVA Mobile';
  if (config.dataSource === 'mock') { root.innerHTML = accountLayout('Tài khoản của bạn', pendingAccount()); return; }
  root.innerHTML = accountLayout('Tài khoản của bạn', loading(2));
  try {
    const user = await requireUser();
    if (!user) { root.innerHTML = accountLayout('Tài khoản của bạn', loginRequired()); return; }
    root.innerHTML = accountLayout('Tài khoản của bạn', `<div class="panel profile-panel"><div class="profile-heading"><div class="profile-avatar">${icon('user', 30)}</div><div><span class="eyebrow">CHÀO BẠN</span><h2>${escapeHTML(user.name)}</h2><p class="muted">Thông tin tài khoản được xác nhận bởi hệ thống.</p></div></div><dl class="profile-details"><div><dt>Họ và tên</dt><dd>${escapeHTML(user.name)}</dd></div><div><dt>Địa chỉ email</dt><dd>${escapeHTML(user.email)}</dd></div><div><dt>Số điện thoại</dt><dd>${escapeHTML(user.phone || 'Chưa cập nhật')}</dd></div></dl><div class="button-row"><a class="button button-primary" href="orders.html">Xem đơn hàng ${icon('arrow-right')}</a><button class="button button-outline" id="logout-button" type="button">Đăng xuất</button></div><p class="input-hint">Cần cập nhật thông tin? <a href="contact.html">Liên hệ bộ phận hỗ trợ</a>.</p><div id="account-message" role="alert"></div></div>`);
    root.querySelector('#logout-button').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Đang đăng xuất…';
      try { await api.logout(); window.location.assign('login.html'); }
      catch (error) { root.querySelector('#account-message').textContent = error.message; button.disabled = false; button.textContent = 'Đăng xuất'; }
    });
  } catch (error) {
    if (error.status === 401) { root.innerHTML = accountLayout('Tài khoản của bạn', loginRequired()); return; }
    renderError(root, error, () => initAccountPage(root));
  }
}

export async function initOrdersPage(root = document.querySelector('#main')) {
  document.title = 'Đơn hàng của tôi | NOVA Mobile';
  if (config.dataSource === 'mock') { root.innerHTML = accountLayout('Đơn hàng của tôi', pendingAccount('Chưa có dữ liệu đơn hàng'), 'orders'); return; }
  root.innerHTML = accountLayout('Đơn hàng của tôi', loading(3), 'orders');
  try {
    if (!await requireUser()) { root.innerHTML = accountLayout('Đơn hàng của tôi', loginRequired(), 'orders'); return; }
    const page = Math.max(1, Number.parseInt(new URLSearchParams(location.search).get('page'), 10) || 1);
    const result = await api.getOrders({ page, per_page: 8 });
    const orders = result.items || [];
    const pagination = result.pagination || { page: 1, total_pages: 1 };
    const content = orders.length ? `<div class="order-list">${orders.map(order => `<article class="panel order-card"><div class="order-card-heading"><div><span class="muted">Mã đơn hàng</span><h2><a href="order.html?id=${encodeURIComponent(order.id)}">${escapeHTML(order.code || order.id)}</a></h2></div>${statusBadge(order.status)}</div><div class="order-card-info"><span>${icon('clock', 16)} ${dateText(order.created_at)}</span><strong>${money(order.total || 0)}</strong></div><a class="text-link" href="order.html?id=${encodeURIComponent(order.id)}">Xem chi tiết ${icon('arrow-right', 16)}</a></article>`).join('')}</div>${pagination.total_pages > 1 ? `<nav class="pagination" aria-label="Phân trang đơn hàng">${Array.from({ length: pagination.total_pages }, (_, index) => `<a class="${page === index + 1 ? 'active' : ''}" href="orders.html?page=${index + 1}" ${page === index + 1 ? 'aria-current="page"' : ''}>${index + 1}</a>`).join('')}</nav>` : ''}` : `<div class="panel">${emptyState('Chưa có đơn hàng nào', 'Một chiếc điện thoại mới đang chờ bạn khám phá.', 'products.html', 'Khám phá sản phẩm')}</div>`;
    root.innerHTML = accountLayout('Đơn hàng của tôi', content, 'orders');
  } catch (error) {
    if (error.status === 401) { root.innerHTML = accountLayout('Đơn hàng của tôi', loginRequired(), 'orders'); return; }
    renderError(root, error, () => initOrdersPage(root));
  }
}

export async function initOrderPage(root = document.querySelector('#main')) {
  document.title = 'Chi tiết đơn hàng | NOVA Mobile';
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { root.innerHTML = accountLayout('Chi tiết đơn hàng', `<div class="panel">${emptyState('Chưa chọn đơn hàng', 'Chọn một đơn hàng trong lịch sử để xem thông tin.', 'orders.html', 'Xem lịch sử đơn hàng')}</div>`, 'orders'); return; }
  if (config.dataSource === 'mock') { root.innerHTML = accountLayout('Chi tiết đơn hàng', pendingAccount('Chi tiết đơn hàng đang chờ kết nối'), 'orders'); return; }
  root.innerHTML = accountLayout('Chi tiết đơn hàng', loading(3), 'orders');
  try {
    const order = await api.getOrder(id);
    const shipping = order.shipping || {};
    root.innerHTML = accountLayout('Chi tiết đơn hàng', `<article class="panel order-detail"><div class="order-card-heading"><div><span class="eyebrow">ĐƠN HÀNG ${escapeHTML(order.code || order.id)}</span><h2>Cảm ơn bạn đã chọn NOVA</h2><p class="muted">Đặt ngày ${dateText(order.created_at)}</p></div>${statusBadge(order.status)}</div><div class="order-delivery"><div>${icon('truck', 25)}<h3>Thông tin nhận hàng</h3><strong>${escapeHTML(shipping.name || 'Đang cập nhật')}</strong><p>${escapeHTML(shipping.phone || '')}</p><p>${escapeHTML(shipping.address || 'Đang cập nhật')}</p>${shipping.note ? `<p class="muted">Ghi chú: ${escapeHTML(shipping.note)}</p>` : ''}</div><div>${icon('credit-card', 25)}<h3>Thanh toán</h3><p>${order.payment_method === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Theo thông tin xác nhận của đơn hàng'}</p><p class="muted">Chi tiết giá do hệ thống xác nhận.</p></div></div><h3>Sản phẩm đã đặt</h3><div class="order-detail-items">${(order.items || []).map(item => `<div class="order-detail-item"><div><strong>${escapeHTML(item.product_name || item.name || 'Sản phẩm')}</strong><small>${escapeHTML(item.color || '')} ${escapeHTML(item.storage || '')} · SL: ${Number(item.quantity) || 0}</small></div><strong>${money(Number(item.unit_price || 0) * Number(item.quantity || 0))}</strong></div>`).join('')}</div><div class="summary-row summary-total"><span>Tổng đơn hàng</span><strong>${money(order.total || 0)}</strong></div><div class="button-row"><a class="button button-outline" href="orders.html">← Danh sách đơn hàng</a><a class="button button-primary" href="contact.html">Liên hệ hỗ trợ</a></div></article>`, 'orders');
  } catch (error) {
    if (error.status === 401) { root.innerHTML = accountLayout('Chi tiết đơn hàng', loginRequired(), 'orders'); return; }
    if (error.status === 404 || error.status === 403) { root.innerHTML = accountLayout('Chi tiết đơn hàng', `<div class="panel">${emptyState('Không tìm thấy đơn hàng', 'Đơn hàng không tồn tại hoặc không thuộc tài khoản của bạn.', 'orders.html', 'Quay lại lịch sử')}</div>`, 'orders'); return; }
    renderError(root, error, () => initOrderPage(root));
  }
}

export function initContactPage(root = document.querySelector('#main')) {
  document.title = 'Liên hệ | NOVA Mobile';
  root.innerHTML = `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Liên hệ' }])}<section class="section"><div class="page-heading contact-page-heading"><span class="eyebrow">CHÚNG TÔI LUÔN LẮNG NGHE</span><h1>Cùng bạn chọn đúng công nghệ.</h1><p class="muted">Bạn cần tư vấn sản phẩm hoặc hỗ trợ đơn hàng? Gửi lời nhắn cho NOVA.</p></div><div class="contact-layout"><div class="contact-intro"><div class="contact-visual">${icon('mail', 48)}<h2>Một lời nhắn.<br>Nhiều điều được giải đáp.</h2><p>Chia sẻ câu hỏi và thông tin liên hệ để đội ngũ hỗ trợ có thể phản hồi đúng nhu cầu của bạn.</p></div><div class="contact-topic">${icon('phone', 24)}<div><h3>Tư vấn sản phẩm</h3><p>Chọn cấu hình, dung lượng và chiếc điện thoại phù hợp.</p></div></div><div class="contact-topic">${icon('package', 24)}<div><h3>Hỗ trợ đơn hàng</h3><p>Thông tin giao nhận, bảo hành và chính sách mua sắm.</p></div></div><div class="notice">Thông tin cửa hàng và kênh liên hệ chính thức sẽ được cập nhật trước khi website vận hành.</div><a class="text-link" href="policy.html">Tìm hiểu chính sách ${icon('arrow-right', 16)}</a></div><form id="contact-form" class="panel contact-form" novalidate><h2>Gửi lời nhắn cho NOVA</h2><p class="muted">Các trường có dấu * là bắt buộc.</p>${config.dataSource === 'mock' ? '<div class="notice">Biểu mẫu trải nghiệm: lời nhắn chưa thể được gửi khi hệ thống chưa kết nối.</div>' : ''}<div class="form-grid"><div class="form-field"><label for="name">Họ và tên *</label><input id="name" name="name" autocomplete="name" placeholder="Nguyễn Văn An" maxlength="100" required aria-describedby="name-error"><small class="field-error" id="name-error" data-error-for="name"></small></div><div class="form-field"><label for="phone">Số điện thoại</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="09xx xxx xxx" maxlength="20" aria-describedby="phone-error"><small class="field-error" id="phone-error" data-error-for="phone"></small></div></div><div class="form-field"><label for="email">Địa chỉ email *</label><input id="email" name="email" type="email" autocomplete="email" placeholder="ban@example.com" maxlength="254" required aria-describedby="email-error"><small class="field-error" id="email-error" data-error-for="email"></small></div><div class="form-field"><label for="subject">Bạn cần hỗ trợ về *</label><select id="subject" name="subject" required aria-describedby="subject-error"><option value="">Chọn nội dung cần hỗ trợ</option><option value="product">Tư vấn sản phẩm</option><option value="order">Đơn hàng và giao nhận</option><option value="warranty">Bảo hành và đổi trả</option><option value="other">Nội dung khác</option></select><small class="field-error" id="subject-error" data-error-for="subject"></small></div><div class="form-field"><label for="message">Lời nhắn của bạn *</label><textarea id="message" name="message" rows="5" placeholder="NOVA có thể giúp gì cho bạn?" minlength="10" maxlength="3000" required aria-describedby="message-error"></textarea><small class="field-error" id="message-error" data-error-for="message"></small></div><div class="form-message" role="alert" tabindex="-1" data-form-message hidden></div><button type="submit" class="button button-primary">Gửi lời nhắn ${icon('arrow-right')}</button><p class="input-hint">Thông tin của bạn chỉ phục vụ việc tiếp nhận và phản hồi yêu cầu. <a href="policy.html#privacy">Xem chính sách dữ liệu</a>.</p></form></div></section></div>`;
  const form = root.querySelector('#contact-form');
  bindFieldFeedback(form);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateForm(form, { name: requiredName, phone: value => value && !phoneIsValid(value) ? 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.' : '', email: validEmail, subject: value => !['product', 'order', 'warranty', 'other'].includes(value) ? 'Vui lòng chọn nội dung cần hỗ trợ.' : '', message: value => value.length < 10 ? 'Lời nhắn cần ít nhất 10 ký tự.' : value.length > 3000 ? 'Lời nhắn tối đa 3.000 ký tự.' : '' })) return;
    const payload = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
    setPending(form, true);
    try {
      const result = await api.sendContact(payload);
      if (!result?.id && result?.received !== true) throw new Error('Chưa nhận được xác nhận tiếp nhận lời nhắn. Vui lòng thử lại.');
      form.reset();
      setFormMessage(form, 'Lời nhắn đã được hệ thống tiếp nhận. Cảm ơn bạn đã liên hệ NOVA!', 'success');
      toast('Đã tiếp nhận lời nhắn của bạn.');
    } catch (error) { applyServerErrors(form, error); }
    finally { setPending(form, false, 'Gửi lời nhắn'); }
  });
}

export function initPolicyPage(root = document.querySelector('#main')) {
  document.title = 'Chính sách mua sắm | NOVA Mobile';
  root.innerHTML = `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Chính sách mua sắm' }])}<section class="section policy-layout"><aside class="panel policy-nav"><h2>Nội dung chính</h2><nav aria-label="Chính sách"><a href="#shopping">Mua hàng & thanh toán</a><a href="#shipping">Giao hàng</a><a href="#warranty">Bảo hành</a><a href="#returns">Đổi trả</a><a href="#privacy">Dữ liệu cá nhân</a></nav></aside><article class="panel policy-content"><span class="eyebrow">MUA SẮM AN TÂM</span><h1>Chính sách mua sắm</h1><div class="notice">Nội dung mẫu cho giai đoạn phát triển giao diện. Chính sách chính thức, đơn vị kinh doanh và điều kiện áp dụng phải được chủ cửa hàng xác nhận trước khi mở bán.</div><section id="shopping"><h2>01. Mua hàng & thanh toán</h2><p>Chọn phiên bản sản phẩm, kiểm tra giỏ hàng và cung cấp thông tin giao nhận. Đơn hàng chỉ được ghi nhận khi hệ thống trả về mã xác nhận hợp lệ.</p><p>Giao diện hỗ trợ thanh toán khi nhận hàng (COD). Giá sản phẩm, số lượng còn lại và chi phí giao hàng phải được xác nhận từ hệ thống trước khi đơn hàng được chấp nhận.</p></section><section id="shipping"><h2>02. Giao hàng</h2><p>Phạm vi giao hàng, phí vận chuyển và thời gian dự kiến sẽ được thông báo khi cửa hàng vận hành. Khách hàng cần cung cấp địa chỉ đầy đủ và số điện thoại có thể liên hệ.</p><p>Vui lòng kiểm tra tình trạng kiện hàng khi nhận và liên hệ hỗ trợ nếu thông tin giao nhận cần điều chỉnh.</p></section><section id="warranty"><h2>03. Bảo hành</h2><p>Điều kiện và thời hạn bảo hành phụ thuộc vào sản phẩm, nhà sản xuất và chứng từ mua hàng. Các nội dung bảo hành trên bản trình diễn chỉ mang tính minh họa.</p><p>Trước khi gửi sản phẩm để kiểm tra, khách hàng nên sao lưu dữ liệu và gỡ thông tin cá nhân theo hướng dẫn chính thức của bộ phận hỗ trợ.</p></section><section id="returns"><h2>04. Đổi trả</h2><p>Điều kiện đổi trả, thời hạn tiếp nhận, tình trạng sản phẩm và phương thức hoàn tiền cần được cửa hàng công bố trong chính sách chính thức.</p><p>Không xem nội dung mẫu là cam kết đổi trả. Khi cần hỗ trợ, cung cấp mã đơn hàng và mô tả vấn đề qua <a href="contact.html">trang liên hệ</a>.</p></section><section id="privacy"><h2>05. Dữ liệu cá nhân</h2><p>Biểu mẫu thu thập thông tin cần thiết để tiếp nhận yêu cầu tài khoản, đơn hàng hoặc liên hệ. Bản frontend không lưu mật khẩu hoặc thông tin giao hàng vào localStorage.</p><p>Trình duyệt lưu mã sản phẩm, mã phiên bản và số lượng trong giỏ hàng để duy trì trải nghiệm. Bạn có thể xóa dữ liệu này bằng cách xóa sản phẩm khỏi giỏ hoặc xóa dữ liệu website trong trình duyệt.</p><p>Chính sách chính thức cần quy định mục đích, thời hạn lưu giữ, bên xử lý dữ liệu, quyền của khách hàng và kênh tiếp nhận yêu cầu trước khi hệ thống xử lý dữ liệu thật.</p></section><a class="button button-primary" href="contact.html">Liên hệ hỗ trợ ${icon('arrow-right')}</a></article></section></div>`;
  if (location.hash) requestAnimationFrame(() => {
    const section = document.getElementById(location.hash.slice(1));
    section?.scrollIntoView({ block: 'start' });
  });
}
