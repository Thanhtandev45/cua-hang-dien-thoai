import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Node is a test tool only. The storefront remains buildless HTML/CSS/JS.
// Source modules receive small browser/network adapters; no PHP/MySQL success is simulated as integration.
const apiSource = await readFile(new URL('../assets/js/api.js', import.meta.url), 'utf8');
const cartSource = await readFile(new URL('../assets/js/cart.js', import.meta.url), 'utf8');
const modelSource = await readFile(new URL('../assets/js/catalog-model.js', import.meta.url), 'utf8');
const masterCatalog = JSON.parse(await readFile(new URL('../mock/products.json', import.meta.url), 'utf8'));
let moduleSequence = 0;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${++moduleSequence}`;
const modelUrl = moduleUrl(modelSource);
const { representativeVariant } = await import(modelUrl);
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const success = data => jsonResponse({ success: true, data });

async function environment(run) {
  const names = ['document', 'window', 'localStorage', 'fetch', '__cartTestNotices'];
  const savedGlobals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const storage = new Map();
  globalThis.document = { baseURI: 'https://nova.test/shop/index.html' };
  globalThis.window = new EventTarget();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  globalThis.__cartTestNotices = [];
  try { await run({ storage }); }
  finally {
    for (const [name, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

function apiModule(dataSource = 'mock', timeoutMs = 1000) {
  const config = { dataSource, timeoutMs, apiBaseUrl: './api/', mockBaseUrl: './mock/' };
  return moduleUrl(apiSource
    .replace("import { config } from './config.js';", `const config = ${JSON.stringify(config)};`)
    .replace("'./catalog-model.js'", JSON.stringify(modelUrl)));
}

function fixtureFetch() {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const pathname = new URL(url).pathname;
    assert.match(pathname, /^\/shop\/mock\/(?:posts|brands|catalog\/(?:index|products\/[1-9][0-9]*|home\/[a-z0-9-]+))\.json$/);
    calls.push({ url: String(url), options });
    const filename = pathname.slice('/shop/mock/'.length);
    try { return new Response(await readFile(new URL(`../mock/${filename}`, import.meta.url), 'utf8'), { headers: { 'content-type': 'application/json' } }); } catch(error) { if(error.code==='ENOENT') return jsonResponse({success:false,error:{code:'NOT_FOUND',message:'Missing demo model'}},404); throw error; }
  };
  return calls;
}

async function cartHarness() {
  fixtureFetch();
  const apiUrl = apiModule();
  const { api } = await import(apiUrl);
  const uiUrl = moduleUrl(`
    export const escapeHTML = String, money = String;
    export const icon = () => '', emptyState = () => '', loading = () => '', renderError = () => {}, breadcrumb = () => '';
    export const toast = (...args) => globalThis.__cartTestNotices.push(args);
    export const confirmDialog = async () => true;
  `);
  const source = cartSource.replace("'./api.js'", JSON.stringify(apiUrl)).replace("'./ui.js'", JSON.stringify(uiUrl));
  return { api, cart: await import(moduleUrl(source)) };
}

test('mock catalog filters and paginates fixtures, with Vietnamese search and stable sorting', async () => environment(async () => {
  const calls = fixtureFetch();
  const { api } = await import(apiModule());
  const all = await api.getProducts({ per_page: 50 });
  assert.equal(all.items.length, 50);
  assert.equal(all.pagination.total, 250);
  assert.equal((await api.getBrands()).length, 14);
  assert.equal((await api.getProducts({ brand: 'apple' })).pagination.total, 30);
  assert.equal((await api.getProducts({ brand: 'apple,samsung' })).pagination.total, 69);
  assert.equal((await api.getProducts({ q: '  SAMSUNG galaxy  ' })).pagination.total, 39);
  assert.equal((await api.getProducts({ q: 'no-such-phone' })).pagination.total, 0);
  const page = await api.getProducts({ page: 2, per_page: 9 });
  assert.deepEqual(page.pagination, { page: 2, per_page: 9, total: 250, total_pages: 28 });
  assert.equal(page.items.length, 9);
  assert.equal((await api.getProducts({ page: 28, per_page: 9 })).items.length, 7);
  const displayPrice = product => representativeVariant(product).price;
  for (const [sort, direction] of [['price_asc', 1], ['price_desc', -1]]) {
    const sorted = (await api.getProducts({ sort, per_page: 50 })).items;
    assert(sorted.every((product, index) => !index || (displayPrice(product) - displayPrice(sorted[index - 1])) * direction >= 0));
  }
  const names = (await api.getProducts({ sort: 'name_asc', per_page: 50 })).items.map(product => product.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'vi')));
  const newest = (await api.getProducts({ sort: 'newest', per_page: 50 })).items;
  assert(newest.every((product, index) => !index || product.created_at <= newest[index - 1].created_at));
  assert.equal(calls.filter(call => call.url.endsWith('catalog/index.json')).length, 1, 'fixture reads are cached without caching submitted data');
}));

test('combined storage/price/stock filters require the same variant to satisfy every condition', async () => environment(async () => {
  fixtureFetch();
  const { api } = await import(apiModule());
  const result = await api.getProducts({ storage: '256GB', min_price: 5000000, max_price: 12000000, in_stock: '1', per_page: 50 });
  assert(result.items.length > 0);
  assert(result.items.every(product => product.variants.some(variant => variant.storage === '256GB' && variant.price >= 5000000 && variant.price <= 12000000 && variant.stock > 0)));
  assert.equal((await api.getProducts({ in_stock: '1', per_page: 50 })).pagination.total, masterCatalog.filter(product=>product.variants.some(variant=>variant.stock>0)).length);
  const posts = await api.getPosts({ category: (await api.getPost(1)).category, per_page: 1, page: 2 });
  assert.equal(posts.pagination.total, 2);
  assert.equal(posts.items.length, 1);
  assert.equal((await api.getPosts({ q: 'khong-co-bai-viet-nay' })).pagination.total, 0);
  assert.equal((await api.getPosts({ q: 'chon dien thoai phu hop' })).pagination.total, 1, 'unaccented search matches Vietnamese article titles');
  assert.equal((await api.getProduct('iphone-16-pro-max')).id, 1);
  await assert.rejects(() => api.getProduct(999), error => error.code === 'NOT_FOUND' && error.status === 404);
  await assert.rejects(() => api.getPost(999), error => error.code === 'NOT_FOUND' && error.status === 404);
}));

test('representative variant prefers the cheapest matching stock, supports all storage formats and map callbacks', () => {
  const product = { variants: [
    { id: 1, storage: '128GB', price: 1, original_price: 2, stock: 3 },
    { id: 2, storage: '256GB', price: 3, original_price: 4, stock: 0 },
    { id: 3, storage: '256GB', price: 7, original_price: 9, stock: 2 },
    { id: 4, storage: '256GB', price: 5, original_price: 5, stock: 2 },
    { id: 5, storage: '512GB', price: 10, original_price: 10, stock: 1 },
  ] };
  const originalOrder = product.variants.map(variant => variant.id);
  assert.equal(representativeVariant(product, { storage: '256GB' }).id, 4, 'a cheaper sold-out option must not replace the in-stock displayed variant');
  assert.equal(representativeVariant(product, { storage: '256GB', on_sale: '1' }).id, 3);
  assert.equal(representativeVariant(product, { storage: '256GB', on_sale: true, max_price: 6 }).id, 2, 'OOS fallback is allowed only when no matching in-stock variant exists');
  assert.equal(representativeVariant(product, { storage: '256GB', on_sale: 1, max_price: 6, in_stock: 'true' }), null, 'sale, price, storage and stock must all match one variant');
  assert.equal(representativeVariant(product, { storage: '128GB,512GB', min_price: 2 }).id, 5);
  assert.equal(representativeVariant(product, { storage: ['128GB', '512GB'], min_price: 2 }).id, 5);
  assert.equal(representativeVariant(product, { min_price: 0, max_price: 0 }), null);
  assert.deepEqual([product, product].map(representativeVariant).map(variant => variant.id), [1, 1]);
  assert.deepEqual(product.variants.map(variant => variant.id), originalOrder, 'selection must not mutate API variant order');
});

test('filtered price sorting follows displayed 256GB prices across page boundaries (A55 versus realme regression)', async () => environment(async () => {
  fixtureFetch();
  const { api } = await import(apiModule());
  for (const [sort, direction] of [['price_asc', 1], ['price_desc', -1]]) {
    const filters = { storage: '256GB', sort, per_page: 9 };
    const first = await api.getProducts(filters);
    const products = [...first.items];
    for (let page = 2; page <= first.pagination.total_pages; page++) products.push(...(await api.getProducts({ ...filters, page })).items);
    const prices = products.map(product => representativeVariant(product, filters).price);
    assert(prices.every((price, index) => !index || (price - prices[index - 1]) * direction >= 0), `${sort} must sort the variant price shown by the filtered card`);
    const a55 = products.findIndex(product => product.name === 'Samsung Galaxy A55 5G');
    const realme = products.findIndex(product => product.name === 'realme 12 Pro+ 5G');
    assert.equal(representativeVariant(products[a55], filters).price, 10490000);
    assert.equal(representativeVariant(products[realme], filters).price, 9490000);
    assert(sort === 'price_asc' ? realme < a55 : a55 < realme);
  }
}));

test('mock API applies on_sale and stock to the displayed variant instead of unrelated capacities', async () => environment(async () => {
  const products = [
    { id: 1, name: 'Sale only on 128GB', created_at: '2026-10-01', variants: [
      { id: 11, storage: '128GB', price: 100, original_price: 200, stock: 3 },
      { id: 12, storage: '256GB', price: 300, original_price: 300, stock: 3 },
    ] },
    { id: 2, name: 'Matching sale', created_at: '2026-10-02', variants: [
      { id: 21, storage: '256GB', price: 200, original_price: 250, stock: 4 },
    ] },
    { id: 3, name: 'OOS sale and stocked regular', created_at: '2026-10-03', variants: [
      { id: 31, storage: '256GB', price: 150, original_price: 200, stock: 0 },
      { id: 32, storage: '256GB', price: 250, original_price: 250, stock: 5 },
    ] },
  ];
  globalThis.fetch = async url => { const match=String(url).match(/catalog\/products\/(\d+)\.json/); return jsonResponse(match ? products.find(product=>product.id===Number(match[1])) : products); };
  const { api } = await import(apiModule());
  assert.deepEqual((await api.getProducts({ storage: '256GB', on_sale: 1, in_stock: 1 })).items.map(product => product.id), [2]);
  assert.deepEqual((await api.getProducts({ storage: '256GB', on_sale: 1, sort: 'price_asc' })).items.map(product => product.id), [3, 2]);
  assert.deepEqual((await api.getProducts({ storage: '256GB', sort: 'price_asc' })).items.map(product => product.id), [2, 3, 1], 'stock preference must affect both displayed variant and sort price');
}));

test('every catalog model, brand and old public slug remains accessible across all pages', async () => environment(async () => {
  fixtureFetch();
  const { api } = await import(apiModule());
  const first = await api.getProducts({per_page:50});
  const actual = [...first.items];
  for(let page=2;page<=first.pagination.total_pages;page++) actual.push(...(await api.getProducts({per_page:50,page})).items);
  assert.equal(actual.length,250);
  assert.equal(new Set(actual.map(product=>product.id)).size,250);
  for(const product of actual) assert.deepEqual(await api.getProduct(product.id),masterCatalog.find(item=>item.id===product.id));
  for(const brand of await api.getBrands()) {
    const result=await api.getProducts({brand:brand.slug,per_page:50});
    assert.equal(result.pagination.total,masterCatalog.filter(product=>product.brand.id===brand.id).length);
    assert(result.items.every(product=>product.brand.id===brand.id));
  }
  const baseline=JSON.parse(await readFile(new URL('./fixtures/catalog-original.json',import.meta.url),'utf8'));
  for(const original of baseline.products) assert.equal((await api.getProduct(original.slug)).id,original.id,'keep existing public slug semantics');
}));

test('home shelves fetch only four-model files, with diverse groups and new brands', async () => environment(async () => {
  const calls=fixtureFetch();
  const { api }=await import(apiModule());
  const ids=[];
  for(const homeSection of ['featured','new','sale']) {
    const result=await api.getProducts({per_page:4},{homeSection});
    assert.equal(result.items.length,4);
    ids.push(...result.items.map(product=>product.id));
  }
  assert.equal(new Set(ids).size,12,'three homepage shelves should not repeat models');
  for(const brand of ['honor','google','oneplus','motorola','nothing','asus','sony','tecno']) {
    const result=await api.getProducts({brand,per_page:4},{homeSection:'featured'});
    assert(result.items.length>0&&result.items.length<=4);
    assert(result.items.every(product=>product.brand.slug===brand));
  }
  assert(calls.every(call=>call.url.includes('/catalog/home/')),'homepage must not download all models or the catalog index');
}));

test('catalog list hydrates only the requested page and does not fetch the master JSON', async () => environment(async () => {
  const calls=fixtureFetch();
  const { api }=await import(apiModule());
  const result=await api.getProducts({per_page:9,page:28});
  assert.equal(result.items.length,7);
  assert.equal(calls.filter(call=>call.url.includes('/catalog/products/')).length,7);
  assert.equal(calls.filter(call=>call.url.endsWith('/catalog/index.json')).length,1);
  assert(calls.every(call=>!call.url.endsWith('/mock/products.json')));
  await api.getProducts({per_page:9,page:28});
  assert.equal(calls.length,8,'repeat page should use only nonpersonal fixture cache');
}));

test('new and legacy cart variants coexist, retain their SKUs and calculate correct totals', async () => environment(async () => {
  const {api,cart}=await cartHarness();
  const legacy=await api.getProduct(1);
  const added=masterCatalog.find(product=>product.brand.slug==='oneplus');
  const variant=added.variants.find(item=>item.stock>=2);
  cart.addItem(legacy,101,1);
  cart.addItem(added,variant.id,2);
  const details=await cart.getCartDetails();
  assert.equal(details.length,2);
  assert.equal(details.find(row=>row.product.id===added.id).variant.sku,variant.sku);
  assert.equal(details.reduce((total,row)=>total+row.variant.price*row.quantity,0),legacy.variants[0].price+variant.price*2);
  cart.updateQuantity(added.id,variant.id,1);
  assert.equal(cart.getCart().find(row=>row.product_id===added.id).quantity,1);
  cart.removeItem(added.id,variant.id);
  assert.deepEqual(cart.getCart(),[{product_id:1,variant_id:101,quantity:1}]);
}));

test('mock refuses every authentication, order and contact operation without making a request', async () => environment(async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Must not send mock personal data'); };
  const { api } = await import(apiModule());
  for (const method of ['login', 'register', 'session', 'logout', 'createOrder', 'getOrders', 'getOrder', 'sendContact']) {
    await assert.rejects(() => api[method]({}), error => error.code === 'API_NOT_CONFIGURED' && error.status === 503);
  }
  assert.equal(requests, 0);
}));

test('cart persists only product/variant IDs and quantities, merges duplicates, emits updates and respects stock', async () => environment(async ({ storage }) => {
  const { api, cart } = await cartHarness();
  const product = await api.getProduct(1);
  let updates = 0;
  window.addEventListener('cart:updated', () => updates++);
  cart.addItem(product, 101, 2);
  cart.addItem(product, '101', 1);
  assert.equal(cart.getCartCount(), 3);
  assert.equal(cart.getCart().length, 1);
  assert.deepEqual(Object.keys(JSON.parse(storage.get('nova-mobile.cart.v1'))[0]).sort(), ['product_id', 'quantity', 'variant_id']);
  cart.updateQuantity('1', '101', 4);
  assert.equal(cart.getCartCount(), 4);
  assert.equal((await cart.getCartDetails()).length, 1);
  assert.deepEqual(cart.getCartIssues(), []);
  for (const quantity of [0, -1, 1.5, '2', 100]) assert.throws(() => cart.addItem(product, 101, quantity));
  assert.throws(() => cart.addItem(product, 'missing-variant', 1));
  assert.throws(() => cart.addItem(product, 101, product.variants[0].stock));
  assert.throws(() => cart.updateQuantity(1, 101, product.variants[0].stock + 1));
  cart.removeItem('1', '101');
  assert.equal(cart.getCartCount(), 0);
  cart.addItem(product, 101);
  cart.clearCart();
  assert.equal(cart.getCartCount(), 0);
  assert(updates >= 6);
}));

test('tampered storage cannot inject invalid IDs, noninteger quantities or hidden product fields', async () => environment(async ({ storage }) => {
  const { cart } = await cartHarness();
  storage.set('nova-mobile.cart.v1', 'not-json');
  assert.deepEqual(cart.getCart(), []);
  storage.set('nova-mobile.cart.v1', JSON.stringify({ product_id: 1, quantity: 1 }));
  assert.deepEqual(cart.getCart(), []);
  storage.set('nova-mobile.cart.v1', JSON.stringify([
    { product_id: '<script>', variant_id: 101, quantity: 1 },
    { product_id: 1, variant_id: 101, quantity: -1 },
    { product_id: 1, variant_id: 101, quantity: 0 },
    { product_id: 1, variant_id: 101, quantity: 1.5 },
    { product_id: 1, variant_id: 101, quantity: '2' },
    { product_id: 1, variant_id: 101, quantity: 100 },
    { product_id: 1, variant_id: 101, quantity: 2, price: 1, is_admin: true },
    { product_id: '1', variant_id: '101', quantity: 3 },
  ]));
  assert.deepEqual(cart.getCart(), [{ product_id: 1, variant_id: 101, quantity: 5 }]);
}));

test('stale product IDs, stale variants, changed stock and zero stock remain visible issues without clearing cart', async () => environment(async ({ storage }) => {
  const { api, cart } = await cartHarness();
  const product = await api.getProduct(1);
  const raw = [
    { product_id: 999, variant_id: 99901, quantity: 1 },
    { product_id: 1, variant_id: 19999, quantity: 1 },
    { product_id: 1, variant_id: 101, quantity: product.variants[0].stock + 1 },
    { product_id: 20, variant_id: 2001, quantity: 1 },
  ];
  storage.set('nova-mobile.cart.v1', JSON.stringify(raw));
  const rows = await cart.getCartDetails();
  assert.equal(rows.length, 2);
  assert.equal(cart.getCartIssues().length, 4);
  assert.equal(cart.getCartIssues().filter(issue => issue.type === 'missing').length, 2);
  assert.equal(cart.getCartIssues().filter(issue => issue.type === 'stock').length, 2);
  assert.deepEqual(cart.getCart(), raw, 'hydration must preserve unavailable entries for explicit customer action');
  assert.throws(() => cart.updateQuantity(20, 2001, 1));
  cart.updateQuantity(1, 101, product.variants[0].stock);
  assert.equal(cart.getCart().find(item => item.variant_id === 101).quantity, product.variants[0].stock);
}));

test('blocked localStorage keeps a usable in-tab cart and warns instead of failing or losing the item', async () => environment(async () => {
  const { api, cart } = await cartHarness();
  const product = await api.getProduct(1);
  globalThis.localStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  cart.addItem(product, 101, 2);
  assert.equal(cart.getCartCount(), 2);
  cart.updateQuantity(1, 101, 3);
  assert.equal(cart.getCartCount(), 3);
  assert.equal(globalThis.__cartTestNotices.length, 1);
  assert.equal((await cart.getCartDetails()).length, 1);
  cart.clearCart();
  assert.equal(cart.getCartCount(), 0);
}));

test('live adapter resolves subdirectory URLs, forwards filters and bootstraps/rotates session CSRF', async () => environment(async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('session.php')) return success({ user: null, csrf_token: 'anonymous-csrf' });
    if (String(url).includes('login.php')) return success({ user: { id: 42 }, csrf_token: 'signed-in-csrf' });
    if (String(url).includes('logout.php')) return success({ message: 'Logged out' });
    return success({ items: [], pagination: { page: 2, per_page: 9, total: 0, total_pages: 1 } });
  };
  const { api } = await import(apiModule('api'));
  assert.deepEqual((await api.login({ email: 'an@example.test', password: 'not-a-real-password' })).user, { id: 42 });
  assert.equal(requests[0].url, 'https://nova.test/shop/api/auth/session.php');
  assert.equal(requests[1].options.headers['X-CSRF-Token'], 'anonymous-csrf');
  assert.equal(requests[1].options.credentials, 'same-origin');
  assert.equal(requests[1].options.headers['Content-Type'], 'application/json');
  await api.getProducts({ brand: 'apple', storage: '256GB', in_stock: 1, page: 2, per_page: 9 });
  const query = new URL(requests.at(-1).url);
  assert.equal(query.pathname, '/shop/api/products.php');
  assert.equal(query.searchParams.get('storage'), '256GB');
  assert.equal(query.searchParams.get('page'), '2');
  await api.sendContact({ message: 'Test adapter only' });
  assert.equal(requests.at(-1).options.headers['X-CSRF-Token'], 'signed-in-csrf');
  await api.logout();
  const before = requests.length;
  await api.sendContact({ message: 'New anonymous request' });
  assert.equal(requests.length, before + 2, 'logout clears the in-memory CSRF token');
}));

test('live adapter rejects invalid JSON/envelopes and preserves structured server validation errors', async () => environment(async () => {
  let response;
  globalThis.fetch = async () => response.clone();
  const { api } = await import(apiModule('api'));
  response = jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query', fields: { page: 'Invalid page' } } }, 422);
  await assert.rejects(() => api.getProducts(), error => error.status === 422 && error.code === 'VALIDATION_ERROR' && error.errors.page === 'Invalid page');
  response = new Response('<html>Not JSON</html>', { status: 500, headers: { 'content-type': 'text/html' } });
  await assert.rejects(() => api.getBrands(), error => error.code === 'INVALID_RESPONSE');
  response = new Response('{bad-json', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(() => api.getBrands(), error => error.code === 'INVALID_RESPONSE');
  response = jsonResponse({ data: [] });
  await assert.rejects(() => api.getBrands(), error => error.code === 'INVALID_RESPONSE');
  response = jsonResponse({ success: true });
  await assert.rejects(() => api.getBrands(), error => error.code === 'INVALID_RESPONSE');
}));

test('missing CSRF prevents POST, network failure never falls back to fixtures, timeout aborts the request', async () => environment(async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push(options.method); return success({ user: null }); };
  const { api } = await import(apiModule('api', 25));
  await assert.rejects(() => api.createOrder({}), error => error.code === 'CSRF_UNAVAILABLE');
  assert.deepEqual(requests, ['GET']);
  globalThis.fetch = async url => { assert(!String(url).includes('/mock/')); throw new Error('Offline'); };
  await assert.rejects(() => api.getBrands(), error => error.code === 'NETWORK_ERROR');
  let aborted = false;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  await assert.rejects(() => api.getProducts(), error => error.code === 'TIMEOUT');
  assert.equal(aborted, true);
}));
