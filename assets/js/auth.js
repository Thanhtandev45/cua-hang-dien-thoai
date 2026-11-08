import { api } from './api.js';
import { config } from './config.js';
import { icon, breadcrumb } from './ui.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phoneIsValid = value => /^(?:0|\+84)[0-9]{9}$/.test(String(value).replace(/[\s().-]/g, ''));

export function setFormMessage(form, message, type = 'error') {
  const target = form.querySelector('[data-form-message]');
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${type}`;
  target.hidden = !message;
  if (message) target.focus();
}

export function validateForm(form, rules) {
  let firstInvalid;
  for (const [name, validate] of Object.entries(rules)) {
    const input = form.elements.namedItem(name);
    const error = validate(String(input?.value || '').trim());
    const feedback = form.querySelector(`[data-error-for="${name}"]`);
    if (feedback) feedback.textContent = error || '';
    input?.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (error && !firstInvalid) firstInvalid = input;
  }
  if (firstInvalid) { firstInvalid.focus(); return false; }
  return true;
}

export function bindFieldFeedback(form) {
  form.addEventListener('input', event => {
    const input = event.target;
    input.setAttribute('aria-invalid', 'false');
    const feedback = [...form.querySelectorAll('[data-error-for]')].find(item => item.dataset.errorFor === input.name);
    if (feedback) feedback.textContent = '';
    const message = form.querySelector('[data-form-message]');
    if (message) message.hidden = true;
  });
}

export function applyServerErrors(form, error) {
  const fields = error.fields || error.errors || {};
  for (const input of [...form.elements]) {
    if (!input.name || !fields[input.name]) continue;
    const feedback = [...form.querySelectorAll('[data-error-for]')].find(item => item.dataset.errorFor === input.name);
    if (feedback) feedback.textContent = Array.isArray(fields[input.name]) ? fields[input.name][0] : String(fields[input.name]);
    input.setAttribute('aria-invalid', 'true');
  }
  setFormMessage(form, error.message || 'Chưa thể gửi yêu cầu. Vui lòng thử lại.');
}

export function setPending(form, pending, text) {
  const button = form.querySelector('[type="submit"]');
  form.setAttribute('aria-busy', String(pending));
  if (pending) button.dataset.originalText = button.textContent;
  button.disabled = pending;
  button.textContent = pending ? 'Đang xử lý…' : text || button.dataset.originalText;
}

export const requiredName = value => value.length < 2 ? 'Vui lòng nhập họ tên từ 2 ký tự.' : value.length > 100 ? 'Họ tên tối đa 100 ký tự.' : '';
export const validEmail = value => !emailPattern.test(value) ? 'Vui lòng nhập địa chỉ email hợp lệ.' : '';

function passwordField(name, label, autocomplete) {
  return `<div class="form-field"><label for="${name}">${label}</label><div class="password-input"><input id="${name}" name="${name}" type="password" autocomplete="${autocomplete}" minlength="8" maxlength="128" required aria-describedby="${name}-error"><button class="password-toggle" type="button" data-toggle-password="${name}" aria-label="Hiện ${label.toLowerCase()}" aria-pressed="false">${icon('eye')}</button></div><small class="field-error" id="${name}-error" data-error-for="${name}"></small></div>`;
}

export function initAuthPage(mode = 'login', root = document.querySelector('#main')) {
  const register = mode === 'register';
  document.title = `${register ? 'Đăng ký' : 'Đăng nhập'} | NOVA Mobile`;
  root.innerHTML = `<div class="container">${breadcrumb([{ label: 'Trang chủ', href: 'index.html' }, { label: register ? 'Đăng ký' : 'Đăng nhập' }])}<section class="auth-layout section"><div class="auth-story"><span class="eyebrow">NOVA MEMBERS</span><h2>Công nghệ mới.<br>Trải nghiệm của bạn.</h2><p>Một tài khoản để quản lý thông tin cá nhân và theo dõi hành trình mua sắm.</p><img src="assets/images/hero-phones.svg" alt="Minh họa điện thoại NOVA" width="440" height="350"><div class="auth-story-note">${icon('shield')} Thông tin tài khoản được xử lý qua phiên bảo mật của hệ thống.</div></div><div class="panel auth-form-panel"><a class="auth-back" href="index.html">← Quay lại cửa hàng</a><span class="eyebrow">CHÀO MỪNG ĐẾN NOVA</span><h1>${register ? 'Tạo tài khoản mới' : 'Rất vui được gặp lại bạn'}</h1><p class="muted">${register ? 'Bắt đầu hành trình công nghệ của riêng bạn.' : 'Đăng nhập để theo dõi đơn hàng và quản lý tài khoản.'}</p>${config.dataSource === 'mock' ? '<div class="notice">Giao diện trải nghiệm: tính năng tài khoản đang chờ kết nối hệ thống. Chưa thể đăng ký hoặc đăng nhập.</div>' : ''}<form id="auth-form" novalidate>${register ? '<div class="form-field"><label for="name">Họ và tên</label><input id="name" name="name" autocomplete="name" placeholder="Nguyễn Văn An" maxlength="100" required aria-describedby="name-error"><small class="field-error" id="name-error" data-error-for="name"></small></div><div class="form-field"><label for="phone">Số điện thoại</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="09xx xxx xxx" maxlength="20" required aria-describedby="phone-error"><small class="field-error" id="phone-error" data-error-for="phone"></small></div>' : ''}<div class="form-field"><label for="email">Địa chỉ email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="ban@example.com" maxlength="254" required aria-describedby="email-error"><small class="field-error" id="email-error" data-error-for="email"></small></div>${passwordField('password', 'Mật khẩu', register ? 'new-password' : 'current-password')}${register ? `<p class="input-hint">Sử dụng ít nhất 8 ký tự. Không dùng lại mật khẩu của tài khoản khác.</p>${passwordField('password_confirmation', 'Nhập lại mật khẩu', 'new-password')}<label class="checkbox-label"><input type="checkbox" name="terms" required aria-describedby="terms-error"> Tôi đã đọc <a href="policy.html">điều khoản và chính sách</a>.</label><small class="field-error" id="terms-error" data-error-for="terms"></small>` : ''}<div class="form-message" role="alert" tabindex="-1" data-form-message hidden></div><button class="button button-primary button-block" type="submit">${register ? 'Tạo tài khoản' : 'Đăng nhập'} ${icon('arrow-right')}</button></form><p class="auth-switch">${register ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'} <a href="${register ? 'login.html' : 'register.html'}">${register ? 'Đăng nhập' : 'Đăng ký ngay'}</a></p><div class="secure-caption">${icon('lock', 15)} Không lưu mật khẩu trên trình duyệt</div></div></section></div>`;
  const form = root.querySelector('#auth-form');
  bindFieldFeedback(form);
  form.querySelectorAll('[data-toggle-password]').forEach(button => button.addEventListener('click', () => {
    const input = form.elements.namedItem(button.dataset.togglePassword);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', `${visible ? 'Ẩn' : 'Hiện'} mật khẩu`);
    button.innerHTML = icon(visible ? 'eye-off' : 'eye');
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const rules = { email: validEmail, password: () => form.elements.password.value.length < (register ? 8 : 1) ? register ? 'Mật khẩu cần ít nhất 8 ký tự.' : 'Vui lòng nhập mật khẩu.' : form.elements.password.value.length > 128 ? 'Mật khẩu tối đa 128 ký tự.' : '' };
    if (register) Object.assign(rules, { name: requiredName, phone: value => !phoneIsValid(value) ? 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.' : '', password_confirmation: () => form.elements.password_confirmation.value !== form.elements.password.value ? 'Mật khẩu nhập lại chưa khớp.' : '', terms: () => !form.elements.terms.checked ? 'Bạn cần đồng ý với điều khoản để tiếp tục.' : '' });
    if (!validateForm(form, rules)) return;
    const payload = Object.fromEntries(new FormData(form));
    delete payload.terms;
    setPending(form, true);
    try {
      const result = await (register ? api.register(payload) : api.login(payload));
      if (!result?.user?.id) throw new Error('Phản hồi tài khoản chưa hợp lệ. Vui lòng thử đăng nhập lại.');
      window.location.assign('account.html');
    } catch (error) { applyServerErrors(form, error); }
    finally { setPending(form, false, register ? 'Tạo tài khoản' : 'Đăng nhập'); }
  });
}
