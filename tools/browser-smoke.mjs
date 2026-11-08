// Optional development QA. Uses an already-running Chrome with --remote-debugging-port=9222.
// Start a static server separately; neither Node nor Chrome is a production dependency.
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.NOVA_TEST_URL || 'http://127.0.0.1:8080';
const debugUrl = process.env.NOVA_CHROME_DEBUG || 'http://127.0.0.1:9222';
const report = { generated_at: new Date().toISOString(), base_url: baseUrl, results: [], errors: [], screenshots: [] };
const requests=[];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const target = await fetch(`${debugUrl}/json/new?about:blank`, { method: 'PUT' }).then(response => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
const listeners = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timeout);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  } else {
    for (const callback of listeners.get(message.method) || []) callback(message.params);
  }
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const callId = ++id;
    const timeout = setTimeout(() => { pending.delete(callId); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(callId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
}
function on(method, callback) {
  if (!listeners.has(method)) listeners.set(method, new Set());
  listeners.get(method).add(callback);
  return () => listeners.get(method).delete(callback);
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expression)) return;
    await pause(80);
  }
  throw new Error(`Condition timed out: ${expression}`);
}
async function check(name, callback) {
  if (process.env.NOVA_TEST_FILTER && !name.includes(process.env.NOVA_TEST_FILTER)) return;
  try { const detail = await callback(); report.results.push({ name, passed: true, detail }); }
  catch (error) {
    const diagnostics = await evaluate(`({path:location.pathname,invalid:[...document.querySelectorAll('[aria-invalid="true"]')].map(el=>el.name),fieldErrors:[...document.querySelectorAll('.field-error')].map(el=>el.textContent).filter(Boolean),message:document.querySelector('[data-form-message]')?.textContent})`).catch(() => null);
    report.results.push({ name, passed: false, error: error.message, diagnostics });
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
let currentRoute = '';
on('Runtime.exceptionThrown', event => report.errors.push({ route: currentRoute, type: 'exception', message: event.exceptionDetails.exception?.description || event.exceptionDetails.text }));
on('Runtime.consoleAPICalled', event => { if (event.type === 'error') report.errors.push({ route: currentRoute, type: 'console', message: event.args.map(arg => arg.value || arg.description || '').join(' ') }); });
on('Network.responseReceived', event => { if (event.response.status >= 400 && event.response.url.startsWith(baseUrl)) report.errors.push({ route: currentRoute, type: 'http', status: event.response.status, url: event.response.url }); });
on('Network.requestWillBeSent',event=>requests.push(event.request.url));
await command('Page.enable');
await command('Runtime.enable');
await command('Network.enable');
async function viewport(width) { await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); }
async function navigate(route) {
  currentRoute = route;
  const loaded = new Promise(resolve => { const stop = on('Page.loadEventFired', () => { stop(); resolve(); }); });
  await command('Page.navigate', { url: `${baseUrl}/${route}` });
  await Promise.race([loaded, pause(6000)]);
  await waitFor(`document.readyState === 'complete' && document.querySelector('#main') && !document.querySelector('#main .skeleton') && !document.querySelector('#main').textContent.includes('Đang chuẩn bị')`);
  await pause(70);
}
async function screenshot(name, fullPage = true) {
  // Full-page screenshots do not scroll lazy images into view. Load them for QA only.
  await evaluate(`(async()=>{const images=[...document.images];images.forEach(image=>image.loading='eager');await Promise.all(images.map(image=>image.decode().catch(()=>{})));})()`);
  const metrics = await command('Page.getLayoutMetrics');
  const size = metrics.cssContentSize;
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage, ...(fullPage ? { clip: { x: 0, y: 0, width: Math.min(size.width, 1600), height: Math.min(size.height, 12000), scale: 1 } } : {}) });
  await writeFile(`.qa/${name}.png`, Buffer.from(result.data, 'base64'));
  report.screenshots.push(`.qa/${name}.png`);
}
async function fill(values) {
  await evaluate(`(() => { const values=${JSON.stringify(values)}; for(const [name,value] of Object.entries(values)){ const input=document.querySelector('#main [name="'+name+'"]'); input.value=value; input.dispatchEvent(new Event('input',{bubbles:true})); } })()`);
}
try {
  await mkdir('.qa', { recursive: true });
  await viewport(1440);
  await navigate('index.html');
  await evaluate('localStorage.clear()');
  const routes = ['index.html', 'products.html', 'product.html?id=1', 'cart.html', 'checkout.html', 'login.html', 'register.html', 'account.html', 'orders.html', 'order.html?id=1', 'news.html', 'article.html?id=1', 'contact.html', 'policy.html'];
  for (const width of [1440, 360, 768, 1024]) {
    await viewport(width);
    for (const route of routes) {
      await check(`${width}px ${route}`, async () => {
        await navigate(route);
        const state = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,actual:document.documentElement.scrollWidth,broken:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).map(img=>img.src),heading:document.querySelector('#main h1,#main h2')?.textContent.trim()})`);
        assert(!state.overflow, `Horizontal overflow ${state.actual}/${state.width}`);
        assert(!state.broken.length, `Broken images: ${state.broken.join(', ')}`);
        assert(Boolean(state.heading), 'Main page lacks a heading');
        return state.heading;
      });
    }
    if (width === 1440 || width === 360) { await navigate('index.html'); await screenshot(width === 1440 ? 'home-desktop' : 'home-mobile'); }
  }
  await viewport(1440);
  await check('Catalog search, filters, sort and pagination', async () => {
    await navigate('products.html');
    assert(await evaluate(`document.querySelector('#price-range').options[0].value===''&&document.querySelector('#price-range').options[0].textContent==='Tất cả mức giá'`), 'Price dropdown must include a valid first all-prices option');
    assert(await evaluate('document.querySelectorAll(".product-card").length') === 9, 'Expected first 9 of 250 products');
    await evaluate(`document.querySelector('#catalog-pagination [data-page="2"]').click()`);
    await waitFor(`location.search.includes('page=2') && !document.querySelector('#catalog-results .skeleton')`);
    assert(await evaluate('document.querySelectorAll(".product-card").length') === 9, 'Second page should contain 9 products');
    await evaluate(`document.querySelector('#clear-filters').click(); document.querySelector('#catalog-search').value='iPhone'; document.querySelector('#filter-form').requestSubmit()`);
    await waitFor(`document.querySelector('#result-count').textContent.includes('iPhone') && !document.querySelector('#catalog-results .skeleton')`);
    assert(await evaluate(`[...document.querySelectorAll('.product-title')].every(el=>el.textContent.includes('iPhone'))`), 'Search returned unrelated products');
    await evaluate(`document.querySelector('#clear-filters').click(); document.querySelector('[name="brand"][value="samsung"]').checked=true; document.querySelector('#filter-form').requestSubmit()`);
    await waitFor(`location.search.includes('samsung') && !document.querySelector('#catalog-results .skeleton')`);
    assert(await evaluate(`[...document.querySelectorAll('.product-brand')].every(el=>el.textContent==='Samsung')`), 'Brand filter returned unrelated products');
    await evaluate(`document.querySelector('#clear-filters').click(); document.querySelector('#sort-products').value='price_asc'; document.querySelector('#sort-products').dispatchEvent(new Event('change',{bubbles:true}))`);
    await waitFor(`location.search.includes('price_asc') && !document.querySelector('#catalog-results .skeleton')`);
    assert(await evaluate(`(()=>{const prices=[...document.querySelectorAll('.product-price')].map(el=>Number(el.textContent.replace(/[^0-9]/g,'')));return prices.every((p,i)=>!i||p>=prices[i-1])})()`), 'Displayed prices are not ascending');
    await evaluate(`document.querySelector('[name="storage"][value="256GB"]').checked=true;document.querySelector('#filter-form').requestSubmit()`);
    for (const direction of ['price_asc', 'price_desc']) {
      await evaluate(`document.querySelector('#sort-products').value='${direction}';document.querySelector('#sort-products').dispatchEvent(new Event('change',{bubbles:true}))`);
      await waitFor(`location.search.includes('${direction}') && !document.querySelector('#catalog-results .skeleton')`);
      assert(await evaluate(`[...document.querySelectorAll('.product-meta')].every(el=>el.textContent.includes('256GB'))`), 'Storage-filtered cards must display the matching variant');
      const ascending = direction === 'price_asc';
      assert(await evaluate(`(()=>{const prices=[...document.querySelectorAll('.product-price')].map(el=>Number(el.textContent.replace(/[^0-9]/g,'')));return prices.every((p,i)=>!i||(${ascending} ? p>=prices[i-1] : p<=prices[i-1]))})()`), `Storage-filtered prices must match ${direction} order`);
    }
    await screenshot('catalog-desktop');
    await evaluate(`document.querySelector('#catalog-search').value='no-such-phone-xyz'; document.querySelector('#filter-form').requestSubmit()`);
    await waitFor(`document.querySelector('#catalog-results .empty-state')`);
  });
  await check('Variant selection, price, stock and gallery', async () => {
    await navigate('product.html?id=1');
    const original = await evaluate(`document.querySelector('#detail-price .product-price').textContent`);
    await evaluate(`document.querySelectorAll('[data-storage]')[1].click()`);
    const changed = await evaluate(`document.querySelector('#detail-price .product-price').textContent`);
    assert(original !== changed, 'Storage variant did not change price');
    await evaluate(`document.querySelectorAll('[data-color]')[0].click();document.querySelectorAll('[data-storage]')[0].click();document.querySelectorAll('[data-image-index]')[1].click()`);
    assert(await evaluate(`document.querySelectorAll('[data-image-index]')[1].getAttribute('aria-pressed')==='true'`), 'Gallery selection did not update');
    await screenshot('product-desktop');
    await navigate('product.html?id=5');
    await evaluate(`document.querySelectorAll('[data-storage]')[1].click()`);
    assert(await evaluate(`document.querySelector('#add-to-cart').disabled`), 'Out-of-stock variant must disable purchase');
  });
  await check('Custom price URL and 64GB storage hydration', async () => {
    await navigate('products.html?min_price=7000000&max_price=15000000');
    assert(await evaluate(`document.querySelector('#price-range').value==='7000000-15000000'`), 'Custom price URL must hydrate dropdown without changing range');
    assert(await evaluate(`(()=>{const prices=[...document.querySelectorAll('.product-price')].map(el=>Number(el.textContent.replace(/[^0-9]/g,'')));return prices.length>0&&prices.every(price=>price>=7000000&&price<=15000000)})()`), 'Custom price range must display matching variant prices');
    await navigate('products.html?storage=64GB');
    assert(await evaluate(`document.querySelector('[name="storage"][value="64GB"]').checked`), '64GB query must hydrate storage control');
    assert(await evaluate(`[...document.querySelectorAll('.product-meta')].every(el=>el.textContent.includes('64GB'))&&document.querySelectorAll('.product-card').length>0`), '64GB filter must display 64GB variants');
  });
  await check('Cart add, persistence, quantity and total', async () => {
    await navigate('product.html?id=1');
    await evaluate(`document.querySelector('#quantity-plus').click(); document.querySelector('#add-to-cart').click()`);
    await waitFor(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]')[0]?.quantity===2`);
    await navigate('cart.html');
    assert(await evaluate(`Number(document.querySelector('.quantity-control input').value)===2`), 'Cart did not persist quantity');
    await evaluate(`document.querySelector('[data-quantity="1"]').click()`);
    await waitFor(`document.querySelector('.quantity-control input')?.value==='3'`);
    const totals = await evaluate(`(()=>{const item=document.querySelector('.cart-item-price strong').textContent;const total=document.querySelector('.summary-total strong').textContent;return {item,total}})()`);
    assert(totals.item === totals.total, 'Cart total differs from line total');
    await screenshot('cart-desktop');
  });
  await check('Checkout validation and honest pending state preserves cart', async () => {
    await navigate('checkout.html');
    await evaluate(`document.querySelector('#checkout-form').requestSubmit()`);
    assert(await evaluate(`document.querySelectorAll('[aria-invalid="true"]').length>=3`), 'Required checkout fields were not validated');
    await fill({ name: 'Nguyễn Văn An', phone: '0901234567', address: '123 Đường Mẫu, Phường Mẫu, Thành phố Hồ Chí Minh' });
    await evaluate(`document.querySelector('#checkout-form').requestSubmit()`);
    await waitFor(`!document.querySelector('[data-form-message]').hidden`);
    const result = await evaluate(`({message:document.querySelector('[data-form-message]').textContent,cart:JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]'),success:document.querySelector('.confirmation-panel')!==null})`);
    assert(result.cart.length && !result.success && result.message.includes('chưa'), 'Mock checkout must retain cart and report pending integration');
    await screenshot('checkout-desktop');
  });
  await check('Populated cart and checkout at 360px', async () => {
    await viewport(360);
    for (const [route, name] of [['cart.html','cart-mobile'],['checkout.html','checkout-mobile']]) {
      await navigate(route);
      assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`), `Populated ${route} overflows mobile viewport`);
      assert(await evaluate(`document.querySelectorAll('.cart-item,.checkout-item').length>0`), `${route} should show a cart item`);
      await screenshot(name);
    }
    await viewport(1440);
  });
  await check('Login validation, password visibility and mock error', async () => {
    await navigate('login.html');
    await evaluate(`document.querySelector('#auth-form').requestSubmit()`);
    assert(await evaluate(`document.querySelectorAll('[aria-invalid="true"]').length===2`), 'Login required fields not validated');
    await fill({ email: 'an@example.com', password: 'Secret123!' });
    await evaluate(`document.querySelector('[data-toggle-password]').click()`);
    assert(await evaluate(`document.querySelector('#password').type==='text'`), 'Password visibility toggle failed');
    await evaluate(`document.querySelector('#auth-form').requestSubmit()`);
    await waitFor(`!document.querySelector('[data-form-message]').hidden`);
    assert(await evaluate(`document.querySelector('[data-form-message]').textContent.includes('chưa')`), 'Mock login must show integration pending');
  });
  await check('Registration checks confirmation and terms', async () => {
    await navigate('register.html');
    await fill({ name: 'Nguyễn Văn An', phone: '0901234567', email: 'an@example.com', password: ' Secret123! ', password_confirmation: 'different' });
    await evaluate(`document.querySelector('#auth-form').requestSubmit()`);
    assert(await evaluate(`document.querySelector('#password_confirmation').getAttribute('aria-invalid')==='true' && document.querySelector('[name="terms"]').getAttribute('aria-invalid')==='true'`), 'Registration must validate confirmation and terms');
    await fill({ password_confirmation: ' Secret123! ' });
    await evaluate(`document.querySelector('[name="terms"]').checked=true;document.querySelector('#auth-form').requestSubmit()`);
    await waitFor(`!document.querySelector('[data-form-message]').hidden`);
    assert(await evaluate(`document.querySelector('#password_confirmation').getAttribute('aria-invalid')==='false'`), 'Identical passwords with spaces should validate consistently');
  });
  await check('News search and contact validation', async () => {
    await navigate('news.html');
    await fill({ q: 'camera' });
    await evaluate(`document.querySelector('.news-search').requestSubmit()`);
    await waitFor(`location.search.includes('q=camera')&&!document.querySelector('#news-results .skeleton')`);
    assert(await evaluate(`document.querySelectorAll('#news-results .news-card').length>0&&document.querySelector('#news-results h2').textContent.toLowerCase().includes('camera')`), 'News keyword search should find camera article');
    await navigate('contact.html');
    await evaluate(`document.querySelector('#contact-form').requestSubmit()`);
    assert(await evaluate(`document.querySelectorAll('[aria-invalid="true"]').length>=4`), 'Contact form required fields not validated');
    await fill({ name:'Nguyễn An', email:'an@example.com', subject:'product', message:'Tôi cần tư vấn dung lượng bộ nhớ.' });
    await evaluate(`document.querySelector('#contact-form').requestSubmit()`);
    await waitFor(`!document.querySelector('[data-form-message]').hidden`);
    assert(await evaluate(`document.querySelector('[data-form-message]').textContent.includes('chưa')`), 'Mock contact must not fake sending');
  });
  await check('Mobile navigation and keyboard dismissal', async () => {
    await viewport(360); await navigate('index.html');
    await evaluate(`document.querySelector('.mobile-menu-button').click()`);
    assert(await evaluate(`document.querySelector('.mobile-menu-button').getAttribute('aria-expanded')==='true'`), 'Mobile menu did not open');
    await command('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    assert(await evaluate(`document.querySelector('.mobile-menu-button').getAttribute('aria-expanded')==='false'`), 'Escape did not dismiss mobile menu');
    await navigate(`products.html?q=${'a'.repeat(120)}`);
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`), 'Long search keyword must wrap without horizontal overflow');
  });
  await check('Cart removal and empty state', async () => {
    await navigate('cart.html');
    await evaluate(`document.querySelector('[data-remove]').click()`);
    await waitFor(`document.querySelector('#cart-content .empty-state')`);
    assert(await evaluate(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]').length===0`), 'Removing last item did not empty persisted cart');
  });
  await check('Clear-cart modal cancellation, Escape and confirmation', async () => {
    await navigate('product.html?id=1');
    await evaluate(`document.querySelector('#add-to-cart').click()`);
    await waitFor(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]').length===1`);
    await navigate('cart.html');
    await evaluate(`document.querySelector('[data-clear-cart]').click()`);
    await waitFor(`document.querySelector('dialog[open]')`);
    await evaluate(`document.querySelector('dialog [value="cancel"]').click()`);
    await waitFor(`!document.querySelector('dialog')`);
    assert(await evaluate(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]').length===1`), 'Cancel must preserve cart');
    await evaluate(`document.querySelector('[data-clear-cart]').click()`);
    await waitFor(`document.querySelector('dialog[open]')`);
    await command('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await command('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await waitFor(`!document.querySelector('dialog')`);
    assert(await evaluate(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]').length===1`), 'Escape must preserve cart');
    await evaluate(`document.querySelector('[data-clear-cart]').click()`);
    await waitFor(`document.querySelector('dialog[open]')`);
    await evaluate(`document.querySelector('dialog [value="confirm"]').click()`);
    await waitFor(`document.querySelector('#cart-content .empty-state')`);
    assert(await evaluate(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]').length===0`), 'Confirmation must clear persisted cart');
  });
  await check('Homepage loads small shelves without the full catalog', async()=>{
    const start=requests.length;
    await viewport(1440);await navigate('index.html');
    assert(await evaluate(`document.querySelectorAll('.brand-tile').length===14`),'Expected fourteen home brands');
    assert(await evaluate(`document.querySelectorAll('#home-products .product-card,#home-new .product-card,#home-sale .product-card').length===12`),'Homepage should render twelve products');
    const loaded=requests.slice(start).filter(url=>url.includes('/mock/'));
    assert(!loaded.some(url=>url.endsWith('/mock/products.json')||url.endsWith('/catalog/index.json')),'Homepage must not fetch the master or catalog index');
    assert(loaded.some(url=>url.includes('/catalog/home/')),'Expected small generated home shelves');
    await evaluate(`document.querySelector('#home-tabs [data-brand="nothing"]').click()`);
    await waitFor(`!document.querySelector('#home-products .skeleton')`);
    assert(await evaluate(`[...document.querySelectorAll('#home-products .product-brand')].every(item=>item.textContent==='Nothing')`),'New home tab should filter Nothing');
  });
  await check('Expanded catalog totals, last page and new brand detail pages', async()=>{
    await navigate('products.html?page=28');
    assert(await evaluate(`document.querySelector('#result-count strong').textContent==='250'&&document.querySelectorAll('.product-card').length===7`),'Last catalog page must contain seven of250 models');
    for(const brand of ['honor','google','oneplus','motorola','nothing','asus','sony','tecno']) {
      await navigate(`products.html?brand=${brand}`);
      assert(await evaluate(`document.querySelector('[name="brand"][value="${brand}"]').checked&&document.querySelectorAll('.product-card').length>0`),'New brand filter must be selected and populated');
      const href=await evaluate(`document.querySelector('.product-title a').getAttribute('href')`);
      await navigate(href);
      assert(await evaluate(`document.querySelector('#main-product-image').complete&&document.querySelector('#main-product-image').naturalWidth>0`),'New model image must load');
      assert(await evaluate(`document.querySelector('#main h1').textContent.length>0&&document.querySelectorAll('[data-color]').length>0&&document.querySelectorAll('[data-storage]').length>0`),'New model should render variants');
    }
    await viewport(360);await navigate('products.html?brand=google');
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),'New brand grid should fit mobile');
    await screenshot('catalog-expanded-mobile');
    await viewport(1440);
  });
  await check('New-brand variant cart, quantity, total and frontend checkout', async()=>{
    await navigate('products.html?brand=oneplus');
    await evaluate(`localStorage.removeItem('nova-mobile.cart.v1');document.querySelector('[data-quick-add]:not([disabled])').click()`);
    await waitFor(`JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]').length===1`);
    await navigate('cart.html');
    assert(await evaluate(`document.querySelector('.cart-item h2').textContent.includes('OnePlus')`),'Cart must show the added new model');
    await evaluate(`document.querySelector('[data-quantity="1"]').click()`);
    await waitFor(`document.querySelector('.quantity-control input')?.value==='2'`);
    assert(await evaluate(`document.querySelector('.cart-item-price strong').textContent===document.querySelector('.summary-total strong').textContent`),'New cart item and total must agree');
    await navigate('checkout.html');
    await fill({name:'Nguyễn An',phone:'0901234567',address:'123 Đường Mẫu, phường Mẫu, TP Hồ Chí Minh'});
    await evaluate(`document.querySelector('#checkout-form').requestSubmit()`);
    await waitFor(`!document.querySelector('[data-form-message]').hidden`);
    assert(await evaluate(`!document.querySelector('.confirmation-panel')&&JSON.parse(localStorage.getItem('nova-mobile.cart.v1')||'[]')[0].quantity===2`),'Demo checkout must retain new variant and never simulate success');
    await evaluate(`localStorage.removeItem('nova-mobile.cart.v1')`);
  });
  await check('No runtime errors, broken assets or failed HTTP requests', () => assert(!report.errors.length, JSON.stringify(report.errors)));
} finally {
  report.passed = report.results.filter(result => result.passed).length;
  report.failed = report.results.filter(result => !result.passed).length;
  await mkdir('.qa', { recursive: true });
  await writeFile('.qa/browser-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed:report.passed, failed:report.failed, errors:report.errors, failures:report.results.filter(result=>!result.passed), report:'.qa/browser-report.json', screenshots:report.screenshots }, null, 2));
  socket.close();
  await fetch(`${debugUrl}/json/close/${target.id}`).catch(() => {});
}
process.exitCode = report.failed ? 1 : 0;
