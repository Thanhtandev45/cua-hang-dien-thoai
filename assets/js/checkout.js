import { api } from './api.js';
import { config } from './config.js';
import { getCart, getCartDetails, getCartIssues, removeItem, updateQuantity } from './cart.js';
import { escapeHTML, money, icon, loading, emptyState, renderError, breadcrumb } from './ui.js';
import { validateForm, bindFieldFeedback, applyServerErrors, setFormMessage, setPending, requiredName, phoneIsValid } from './auth.js';

export async function initCheckoutPage(root = document.querySelector('#main')) {
  document.title = 'Thanh toán | NOVA Mobile';
  root.innerHTML = `<div class="container section">${loading(3)}</div>`;
  try {
    const rows = await getCartDetails();
    const issues = getCartIssues();
    if (!rows.length) {
      root.innerHTML = `<div class="container section">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Thanh toán' }])}${issues.length ? emptyState('Giỏ hàng cần được cập nhật', 'Một số sản phẩm không còn khả dụng. Vui lòng kiểm tra và xóa các mục không hợp lệ trước khi thanh toán.', 'cart.html', 'Kiểm tra giỏ hàng') : emptyState('Giỏ hàng đang trống', 'Hãy chọn chiếc điện thoại phù hợp trước khi thanh toán.', 'products.html', 'Khám phá điện thoại')}</div>`;
      return;
    }
    const initialCart = getCart();
    const cartSignature = JSON.stringify(initialCart);
    const invalid = issues.length > 0 || rows.some(({ variant, quantity }) => !variant || !Number.isInteger(quantity) || quantity < 1 || quantity > variant.stock || !Number.isFinite(variant.price));
    const quantity = rows.reduce((total, row) => total + row.quantity, 0);
    const total = rows.reduce((sum, row) => sum + row.variant.price * row.quantity, 0);
    root.innerHTML = `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: 'Giỏ hàng', href: 'cart.html' }, { label: 'Thanh toán' }])}<section class="section"><div class="page-heading"><span class="eyebrow">CHỈ CÒN MỘT BƯỚC NỮA</span><h1>Thông tin đặt hàng</h1><p class="muted">Kiểm tra sản phẩm và điền thông tin nhận hàng của bạn.</p></div><ol class="checkout-steps" aria-label="Quy trình mua hàng"><li class="completed">${icon('check', 16)} Giỏ hàng</li><li class="active" aria-current="step">2 <span>Thông tin giao hàng</span></li><li>3 <span>Xác nhận</span></li></ol>${config.dataSource === 'mock' ? '<div class="notice checkout-notice">Đây là giao diện trải nghiệm. Bạn có thể kiểm tra biểu mẫu; đơn hàng chưa thể được tạo và giỏ hàng sẽ được giữ nguyên.</div>' : ''}<div class="checkout-layout"><form id="checkout-form" class="panel checkout-form" novalidate><h2>${icon('truck')} Thông tin nhận hàng</h2><div class="form-grid"><div class="form-field"><label for="name">Họ tên người nhận <span aria-hidden="true">*</span></label><input id="name" name="name" autocomplete="shipping name" placeholder="Nguyễn Văn An" maxlength="100" required aria-describedby="name-error"><small class="field-error" id="name-error" data-error-for="name"></small></div><div class="form-field"><label for="phone">Số điện thoại <span aria-hidden="true">*</span></label><input id="phone" name="phone" type="tel" autocomplete="shipping tel" placeholder="09xx xxx xxx" maxlength="20" required aria-describedby="phone-error"><small class="field-error" id="phone-error" data-error-for="phone"></small></div></div><div class="form-field"><label for="address">Địa chỉ nhận hàng <span aria-hidden="true">*</span></label><textarea id="address" name="address" autocomplete="shipping street-address" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố" rows="3" minlength="10" maxlength="500" required aria-describedby="address-error"></textarea><small class="field-error" id="address-error" data-error-for="address"></small></div><div class="form-field"><label for="note">Ghi chú <span class="muted">(không bắt buộc)</span></label><textarea id="note" name="note" placeholder="Ví dụ: gọi trước khi giao hàng…" rows="2" maxlength="1000" aria-describedby="note-error"></textarea><small class="field-error" id="note-error" data-error-for="note"></small></div><h2 class="payment-heading">${icon('credit-card')} Phương thức thanh toán</h2><label class="payment-option"><input type="radio" name="payment_method" value="cod" checked><span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Thanh toán trực tiếp cho đơn vị vận chuyển khi nhận sản phẩm.</small></span>${icon('check', 18)}</label><div class="form-message" role="alert" tabindex="-1" data-form-message hidden></div><button class="button button-primary button-block" type="submit" ${invalid ? 'disabled' : ''}>${config.dataSource === 'mock' ? 'Kiểm tra thông tin đặt hàng' : 'Xác nhận đặt hàng'} ${icon('arrow-right')}</button><p class="secure-caption">${icon('lock', 15)} Thông tin chỉ được gửi khi bạn xác nhận.</p><a class="back-link" href="cart.html">← Quay lại giỏ hàng</a></form><aside class="panel order-summary checkout-summary"><h2>Đơn hàng của bạn <span class="count-pill">${quantity}</span></h2><div class="checkout-items">${rows.map(({ product, variant, quantity: count }) => `<div class="checkout-item"><a href="product.html?id=${encodeURIComponent(product.id)}"><img src="${escapeHTML(variant.image || product.images[0])}" alt="${escapeHTML(product.name)}" width="72" height="80"></a><div><a href="product.html?id=${encodeURIComponent(product.id)}"><strong>${escapeHTML(product.name)}</strong></a><small>${escapeHTML(variant.color)} · ${escapeHTML(variant.storage)} · SL: ${count}</small><b>${money(variant.price * count)}</b></div></div>`).join('')}</div><div class="summary-row"><span>Tạm tính</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Phí vận chuyển</span><span>Chờ xác nhận</span></div><div class="summary-row summary-total"><span>Tổng tạm tính</span><strong>${money(total)}</strong></div><p class="input-hint">Giá, tồn kho và phí giao hàng được hệ thống xác nhận khi tạo đơn.</p>${invalid ? '<div class="form-message error">Một số sản phẩm không còn đủ số lượng. Vui lòng cập nhật giỏ hàng.</div>' : ''}<div class="summary-assurance">${icon('shield')} Kiểm tra thông tin trước khi xác nhận.</div></aside></div></section></div>`;
    const form = root.querySelector('#checkout-form');
    bindFieldFeedback(form);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!validateForm(form, { name: requiredName, phone: value => !phoneIsValid(value) ? 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.' : '', address: value => value.length < 10 ? 'Vui lòng nhập địa chỉ đầy đủ, ít nhất 10 ký tự.' : value.length > 500 ? 'Địa chỉ tối đa 500 ký tự.' : '', note: value => value.length > 1000 ? 'Ghi chú tối đa 1.000 ký tự.' : '' })) return;
      const data = new FormData(form);
      const currentCart = getCart();
      const items = currentCart.map(item => ({ variant_id: item.variant_id, quantity: item.quantity }));
      if (!items.length || invalid || JSON.stringify(currentCart) !== cartSignature) { setFormMessage(form, 'Giỏ hàng đã thay đổi. Vui lòng quay lại giỏ hàng và kiểm tra trước khi đặt hàng.'); return; }
      const payload = { items, shipping: { name: data.get('name').trim(), phone: data.get('phone').trim(), address: data.get('address').trim(), note: data.get('note').trim() }, payment_method: 'cod' };
      setPending(form, true);
      try {
        if (config.dataSource === 'api') {
          const session = await api.session();
          if (!session?.user?.id) throw Object.assign(new Error('Vui lòng đăng nhập trước khi xác nhận đặt hàng. Thông tin và giỏ hàng của bạn vẫn được giữ nguyên.'), { status: 401 });
        }
        const order = await api.createOrder(payload);
        if (!order || !order.id || !order.code) throw new Error('Chưa nhận được mã xác nhận hợp lệ từ hệ thống. Giỏ hàng vẫn được giữ nguyên.');
        // Remove only the submitted quantities; keep items added in another tab while awaiting the server.
        for (const submitted of initialCart) {
          const current = getCart().find(item => String(item.product_id) === String(submitted.product_id) && String(item.variant_id) === String(submitted.variant_id));
          if (!current) continue;
          const remaining = current.quantity - submitted.quantity;
          if (remaining <= 0) removeItem(current.product_id, current.variant_id);
          else updateQuantity(current.product_id, current.variant_id, remaining, 99);
        }
        root.innerHTML = `<div class="container section"><div class="panel confirmation-panel"><span class="success-mark">${icon('check', 36)}</span><span class="eyebrow">CẢM ƠN BẠN ĐÃ CHỌN NOVA</span><h1>Đặt hàng thành công</h1><p>Hệ thống đã xác nhận đơn hàng <strong>${escapeHTML(order.code)}</strong>.</p><p class="muted">Bạn có thể theo dõi trạng thái và thông tin giao hàng trong tài khoản.</p><div class="button-row"><a class="button button-primary" href="order.html?id=${encodeURIComponent(order.id)}">Xem đơn hàng ${icon('arrow-right')}</a><a class="button button-outline" href="products.html">Tiếp tục mua sắm</a></div></div></div>`;
        root.querySelector('h1').setAttribute('tabindex', '-1');
        root.querySelector('h1').focus();
      } catch (error) {
        applyServerErrors(form, error);
        if (error.status === 401) {
          const link = document.createElement('a');
          link.href = 'login.html';
          link.className = 'button button-outline';
          link.textContent = 'Đăng nhập tài khoản';
          form.querySelector('[data-form-message]').append(document.createElement('br'), link);
        }
      }
      finally { if (form.isConnected) setPending(form, false, config.dataSource === 'mock' ? 'Kiểm tra thông tin đặt hàng' : 'Xác nhận đặt hàng'); }
    });
  } catch (error) { renderError(root, error, () => initCheckoutPage(root)); }
}
