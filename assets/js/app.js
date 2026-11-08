import { config } from './config.js';
import { api } from './api.js';
import { icon, toast, renderError } from './ui.js';
import { getCartCount, addItem } from './cart.js';

const page = document.body.dataset.page || 'home';
const brand = `<a class="brand" href="index.html" aria-label="NOVA Mobile — Trang chủ"><span class="brand-symbol">${icon('smartphone',29)}</span><span><span class="brand-name">NOVA<span class="sr-only"> Mobile</span></span><span class="brand-tagline">Technology for you</span></span></a>`;
const navLinks = [
 ['products.html','grid','Tất cả điện thoại',['products','product']],
 ['products.html?brand=apple','','iPhone',[]],
 ['products.html?brand=samsung','','Samsung',[]],
 ['products.html?on_sale=1','sparkles','Ưu đãi hôm nay',[]],
 ['news.html','','Góc công nghệ',['news','article']],
 ['contact.html','','Liên hệ',['contact']],
];

document.querySelector('#site-header').innerHTML = `<div class="announcement"><div class="container"><span>Công nghệ trong tầm tay · Trải nghiệm theo cách bạn</span><div class="announcement-benefits"><span>${icon('shield',13)} An tâm mua sắm</span><span>${icon('truck',14)} Giao hàng toàn quốc</span><span>${icon('headphones',14)} Luôn sẵn sàng hỗ trợ</span></div></div></div>
<header class="site-header"><div class="container header-main">${brand}<form class="header-search" action="products.html" role="search"><label class="sr-only" for="global-search">Tìm điện thoại</label>${icon('search',18)}<input id="global-search" name="q" type="search" placeholder="Bạn đang tìm điện thoại nào?" maxlength="120"><button type="submit" aria-label="Tìm kiếm">${icon('arrow-right',17)}</button></form><div class="header-actions"><a class="header-action header-hotline" href="contact.html">${icon('headphones',23)}<span><small>Cần tư vấn?</small><strong>Liên hệ NOVA</strong></span></a><a class="header-action" href="account.html" aria-label="T?i kho?n">${icon('user',23)}<span><small>Xin chào, bạn</small><strong>Tài khoản</strong></span></a><a class="header-action" href="cart.html" aria-label="Giỏ hàng"><span class="cart-icon-wrap">${icon('bag',24)}<span class="cart-count" data-cart-count>0</span></span><span><small>Mua sắm</small><strong>Giỏ hàng</strong></span></a><button type="button" class="icon-button mobile-menu-button" aria-label="Mở menu" aria-expanded="false" aria-controls="primary-navigation">${icon('menu',23)}</button></div></div></header>
<div class="nav-wrap" id="primary-navigation"><nav class="navigation container" aria-label="Điều hướng chính">${navLinks.map(([href,name,label,pages],index)=>`<a href="${href}" class="${index === 0 ? 'nav-category ' : ''}${pages.includes(page) ? 'active' : ''}" ${pages.includes(page) ? 'aria-current="page"' : ''}>${name ? icon(name,17) : ''}${label}${index === 0 ? icon('chevron-down',14) : ''}</a>`).join('')}<a class="nav-last" href="orders.html">${icon('package',16)} Tra cứu đơn hàng</a></nav></div>${config.dataSource === 'mock' ? '<div class="demo-strip"><span>BẢN TRẢI NGHIỆM</span> Sản phẩm, giá và hình ảnh là dữ liệu minh họa. Chưa tiếp nhận đơn hàng.</div>' : ''}`;

document.querySelector('#site-footer').innerHTML = `<div class="service-border"><div class="container service-strip">${[
 ['shield','An tâm về chất lượng','Thông tin sản phẩm minh bạch'],['truck','Giao hàng thuận tiện','Theo dõi đơn hàng dễ dàng'],['refresh','Hỗ trợ sau mua','Đồng hành cùng thiết bị của bạn'],['headphones','Tư vấn tận tâm','Chọn đúng chiếc điện thoại bạn cần'],
].map(([name,title,text])=>`<div class="service-item">${icon(name,29)}<div><strong>${title}</strong><p>${text}</p></div></div>`).join('')}</div></div><footer class="site-footer"><div class="container footer-main"><div class="footer-about">${brand}<p>Kết nối bạn với những trải nghiệm công nghệ mới. Chọn điện thoại phù hợp, mua sắm dễ dàng cùng NOVA Mobile.</p><span class="text-small">Website mẫu phục vụ phát triển dự án nhóm.</span></div><div><h3>Khám phá NOVA</h3><div class="footer-links"><a href="products.html">Tất cả điện thoại</a><a href="products.html?is_new=1">Điện thoại mới</a><a href="products.html?on_sale=1">Sản phẩm ưu đãi</a><a href="news.html">Góc công nghệ</a></div></div><div><h3>Hỗ trợ khách hàng</h3><div class="footer-links"><a href="orders.html">Lịch sử đơn hàng</a><a href="policy.html#shipping">Giao nhận & thanh toán</a><a href="policy.html#warranty">Bảo hành & đổi trả</a><a href="policy.html#privacy">Chính sách bảo mật</a></div></div><div><h3>Kết nối với chúng tôi</h3><div class="footer-links"><a class="footer-contact" href="contact.html">${icon('headphones',17)} Tư vấn & hỗ trợ mua hàng</a><a class="footer-contact" href="contact.html">${icon('mail',17)} Gửi lời nhắn cho NOVA</a><a class="footer-contact" href="contact.html">${icon('map-pin',17)} Thông tin cửa hàng</a></div></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} NOVA Mobile. Giao diện trình diễn · Không phải cửa hàng đang hoạt động.</span><div class="payment-labels"><span>COD</span><span>THANH TOÁN KHI NHẬN HÀNG</span></div></div></footer>`;

function updateBadge() { document.querySelectorAll('[data-cart-count]').forEach(element=>element.textContent=String(getCartCount())); }
updateBadge(); window.addEventListener('cart:updated',updateBadge); window.addEventListener('storage',updateBadge);
document.querySelector('.mobile-menu-button').addEventListener('click',event=>{
 const button=event.currentTarget; const open=button.getAttribute('aria-expanded') !== 'true';
 button.setAttribute('aria-expanded',String(open)); button.setAttribute('aria-label',open ? 'Đóng menu' : 'Mở menu'); document.querySelector('.nav-wrap').classList.toggle('is-open',open);
});
document.addEventListener('keydown',event=>{ if(event.key === 'Escape') {
 const nav=document.querySelector('.nav-wrap');const button=document.querySelector('.mobile-menu-button');
 if(nav.classList.contains('is-open')) {nav.classList.remove('is-open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Mở menu');button.focus();}
} });
document.addEventListener('error',event=>{ if(event.target instanceof HTMLImageElement && !event.target.src.endsWith('/fallback.svg')) event.target.src='assets/images/fallback.svg'; },true);
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-quick-add]'); if(!button || button.disabled) return;
 button.disabled=true;
 try { const product=await api.getProduct(button.dataset.quickAdd); await addItem(product,button.dataset.variantId,1); toast(`Đã thêm ${product.name} vào giỏ hàng`); } catch(error) { toast(error.message,'error'); } finally { button.disabled=false; }
});

const root=document.querySelector('#main');
const routes={
 home:()=>import('./home.js').then(module=>module.initHomePage(root)),
 products:()=>import('./products.js').then(module=>module.initProductsPage(root)),
 product:()=>import('./products.js').then(module=>module.initProductPage(root)),
 cart:()=>import('./cart.js').then(module=>module.initCartPage(root)),
 checkout:()=>import('./checkout.js').then(module=>module.initCheckoutPage(root)),
 login:()=>import('./auth.js').then(module=>module.initAuthPage('login',root)),
 register:()=>import('./auth.js').then(module=>module.initAuthPage('register',root)),
 account:()=>import('./customer.js').then(module=>module.initAccountPage(root)),
 orders:()=>import('./customer.js').then(module=>module.initOrdersPage(root)),
 order:()=>import('./customer.js').then(module=>module.initOrderPage(root)),
 contact:()=>import('./customer.js').then(module=>module.initContactPage(root)),
 policy:()=>import('./customer.js').then(module=>module.initPolicyPage(root)),
 news:()=>import('./news.js').then(module=>module.initNewsPage(root)),
 article:()=>import('./news.js').then(module=>module.initArticlePage(root)),
};
try { await (routes[page] || routes.home)(); } catch(error) { renderError(root,error,()=>location.reload()); }
