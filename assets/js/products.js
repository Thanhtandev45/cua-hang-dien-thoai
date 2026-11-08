import { api } from './api.js';
import { addItem } from './cart.js';
import { breadcrumb, emptyState, escapeHTML, icon, imageUrl, loading, money, productCard, renderError, toast } from './ui.js';

const storageOptions=['32GB','64GB','128GB','256GB','512GB','1TB'];
const positiveInteger=(value,fallback=1)=>Math.max(1,parseInt(value,10)||fallback);

export async function initProductsPage(root) {
 const params=new URLSearchParams(location.search);
 const storageChoices=[...new Set([...storageOptions,params.get('storage')].filter(value=>value&&value.length<=20))];
 root.innerHTML=`<div class="container">${breadcrumb([{label:'Điện thoại'}])}<div class="catalog-banner"><div><span class="eyebrow">Tìm chiếc điện thoại dành cho bạn</span><h1>Tất cả điện thoại</h1><p>Từ thiết kế yêu thích đến hiệu năng bạn cần.</p></div>${icon('smartphone',74)}</div><button type="button" class="button button-outline mobile-filter-toggle" aria-controls="catalog-filters" aria-expanded="false">${icon('filter',17)} Bộ lọc sản phẩm</button><div class="catalog-layout section"><aside class="filter-panel" id="catalog-filters" aria-label="Bộ lọc sản phẩm"><div class="filter-heading"><h2>${icon('filter',18)} Bộ lọc</h2><button type="button" id="clear-filters">Đặt lại</button></div><form id="filter-form"><div class="form-field filter-search"><label for="catalog-search">Tìm theo tên</label><input id="catalog-search" type="search" name="q" maxlength="120" placeholder="Tên điện thoại…" value="${escapeHTML(params.get('q')||'')}"></div><fieldset class="filter-group"><legend>Thương hiệu</legend><div id="brand-filters"></div></fieldset><fieldset class="filter-group"><legend>Khoảng giá</legend><label for="price-range" class="sr-only">Khoảng giá</label><select id="price-range" name="price_range"><option value="">Tất cả mức giá</option><option value="0-5000000">Dưới 5 triệu</option><option value="5000000-10000000">5 – 10 triệu</option><option value="10000000-20000000">10 – 20 triệu</option><option value="20000000-">Trên 20 triệu</option></select></fieldset><fieldset class="filter-group"><legend>Dung lượng</legend><label><input type="radio" name="storage" value="" checked> Tất cả dung lượng</label>${storageChoices.map(storage=>`<label><input type="radio" name="storage" value="${escapeHTML(storage)}" ${params.get('storage')===storage?'checked':''}> ${escapeHTML(storage)}</label>`).join('')}</fieldset><fieldset class="filter-group"><legend>Lựa chọn khác</legend><label><input type="checkbox" name="in_stock" value="1" ${params.get('in_stock')==='1'?'checked':''}> Chỉ sản phẩm còn hàng</label><label><input type="checkbox" name="on_sale" value="1" ${params.get('on_sale')==='1'?'checked':''}> Đang có ưu đãi</label><label><input type="checkbox" name="is_new" value="1" ${params.get('is_new')==='1'?'checked':''}> Điện thoại mới</label></fieldset><button class="button button-primary button-block button-small" type="submit">Áp dụng bộ lọc</button></form></aside><div class="catalog-products"><div class="catalog-toolbar"><p id="result-count" aria-live="polite">Đang tìm sản phẩm…</p><label for="sort-products">Sắp xếp theo <select id="sort-products"><option value="newest">Mới nhất</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option><option value="name_asc">Tên A–Z</option></select></label></div><div class="active-filters" id="active-filters"></div><div id="catalog-results">${loading(6)}</div><nav class="pagination" id="catalog-pagination" aria-label="Phân trang sản phẩm"></nav></div></div></div>`;
 const form=root.querySelector('#filter-form');
 const sort=root.querySelector('#sort-products');
 sort.value=['newest','price_asc','price_desc','name_asc'].includes(params.get('sort'))?params.get('sort'):'newest';
 const rangeValue=`${params.get('min_price')||'0'}-${params.get('max_price')||''}`;
 const range=root.querySelector('#price-range');
 if([...range.options].some(option=>option.value===rangeValue))range.value=rangeValue;
 else if(params.has('min_price')||params.has('max_price')) {
   const min=Math.max(0,Number(params.get('min_price'))||0);
   const max=Math.max(0,Number(params.get('max_price'))||0);
   const value=`${min}-${max||''}`;
   const label=max ? `${min ? `${money(min)} – ` : 'Dưới '}${money(max)}` : `Từ ${money(min)}`;
   range.add(new Option(label,value));range.value=value;
 }
 let brands=[];
 try { brands=await api.getBrands(); } catch(error) { toast('Chưa tải được danh sách thương hiệu. Bạn vẫn có thể tìm theo tên.','error'); }
 root.querySelector('#brand-filters').innerHTML=[{slug:'',name:'Tất cả thương hiệu'},...brands].map(brand=>`<label><input type="radio" name="brand" value="${escapeHTML(brand.slug)}" ${brand.slug===(params.get('brand')||'')?'checked':''}> ${escapeHTML(brand.name)}</label>`).join('');
 if(!form.querySelector('[name="brand"]:checked'))form.querySelector('[name="brand"]').checked=true;
 const filterToggle=root.querySelector('.mobile-filter-toggle'); filterToggle.addEventListener('click',()=>{const open=filterToggle.getAttribute('aria-expanded')!=='true';filterToggle.setAttribute('aria-expanded',String(open));root.querySelector('#catalog-filters').classList.toggle('is-open',open);});
 let page=positiveInteger(params.get('page')); let requestId=0; let debounce;
 const readFilters=()=>{
   const data=new FormData(form); const query={page,per_page:9,sort:sort.value};
   for(const key of ['q','brand','storage','in_stock','on_sale','is_new']){const value=String(data.get(key)||'').trim();if(value)query[key]=value;}
   const [min,max]=String(data.get('price_range')||'').split('-');if(min&&Number(min)>0)query.min_price=Number(min);if(max)query.max_price=Number(max);return query;
 };
 const load=async()=>{
   const current=++requestId; const query=readFilters();const region=root.querySelector('#catalog-results');region.innerHTML=loading(6);root.querySelector('#catalog-pagination').innerHTML='';
   const search=new URLSearchParams(Object.entries(query).filter(([key])=>key!=='per_page'));history.replaceState(null,'',`products.html?${search}`);
   const chips=[query.q?`Tìm: ${query.q}`:'',brands.find(brand=>brand.slug===query.brand)?.name,query.storage,query.in_stock?'Còn hàng':'',query.on_sale?'Có ưu đãi':'',query.is_new?'Mới lên kệ':'',query.min_price?`Từ ${money(query.min_price)}`:'',query.max_price?`Đến ${money(query.max_price)}`:''].filter(Boolean);
   root.querySelector('#active-filters').innerHTML=chips.map(chip=>`<span class="filter-chip">${escapeHTML(chip)}</span>`).join('');
   try {
     const {items,pagination}=await api.getProducts(query);if(current!==requestId)return;
     const total=Number(pagination.total)||0;const totalPages=Number(pagination.total_pages)||1;
     if(page>totalPages){page=totalPages;return load();}
     root.querySelector('#result-count').innerHTML=`Tìm thấy <strong>${total}</strong> sản phẩm${query.q?` cho “${escapeHTML(query.q)}”`:''}`;
     region.innerHTML=items.length?`<div class="product-grid">${items.map(product=>productCard(product,query)).join('')}</div>`:emptyState('Chưa tìm thấy điện thoại phù hợp','Thử một từ khóa khác hoặc đặt lại bộ lọc để xem thêm lựa chọn.');
     if(totalPages>1){
       const nav=root.querySelector('#catalog-pagination');
       const pages=[...new Set([1,page-1,page,page+1,totalPages].filter(number=>number>=1&&number<=totalPages))].sort((a,b)=>a-b);
       nav.innerHTML=`<button type="button" data-page="${page-1}" ${page<=1?'disabled':''} aria-label="Trang trước">${icon('arrow-left',16)}</button>${pages.map((number,index)=>`${index>0&&number-pages[index-1]>1?'<span aria-hidden="true">…</span>':''}<button type="button" data-page="${number}" ${number===page?'aria-current="page"':''} aria-label="Trang ${number}">${number}</button>`).join('')}<button type="button" data-page="${page+1}" ${page>=totalPages?'disabled':''} aria-label="Trang sau">${icon('arrow-right',16)}</button>`;
     }
   } catch(error) { if(current===requestId){root.querySelector('#result-count').textContent='Không thể tải sản phẩm';renderError(region,error,load);} }
 };
 const apply=()=>{page=1;load();};
 form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(debounce);apply();});
 form.addEventListener('change',event=>{if(event.target.type!=='search')apply();});
 root.querySelector('#catalog-search').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(apply,350);});
 sort.addEventListener('change',apply);
 root.querySelector('#clear-filters').addEventListener('click',()=>{form.reset();form.querySelectorAll('[type="checkbox"]').forEach(input=>input.checked=false);form.querySelector('[name="q"]').value='';form.querySelector('[name="brand"]').checked=true;form.querySelector('[name="storage"]').checked=true;range.value='';sort.value='newest';apply();});
 root.querySelector('#catalog-pagination').addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button&&!button.disabled){page=positiveInteger(button.dataset.page);load();root.querySelector('.catalog-toolbar').scrollIntoView({block:'start',behavior:'smooth'});}});
 await load();
}

export async function initProductPage(root) {
 const id=new URLSearchParams(location.search).get('id');
 if(!id){root.innerHTML=`<div class="container">${breadcrumb([{label:'Điện thoại',href:'products.html'},{label:'Chi tiết'}])}${emptyState('Bạn chưa chọn sản phẩm','Khám phá danh sách để chọn chiếc điện thoại yêu thích.','products.html')}</div>`;return;}
 root.innerHTML=`<div class="container section">${loading(2)}</div>`;
 let product;
 try{product=await api.getProduct(id);}catch(error){root.innerHTML=`<div class="container section">${emptyState('Không tìm thấy sản phẩm',error.message,'products.html','Xem tất cả điện thoại')}</div>`;return;}
 const variants=Array.isArray(product.variants)?product.variants:[];
 if(!variants.length){root.innerHTML=`<div class="container section">${emptyState('Sản phẩm chưa có phiên bản','Vui lòng chọn một sản phẩm khác.','products.html')}</div>`;return;}
 document.title=`${product.name} | NOVA Mobile`;
 const requestedVariant=new URLSearchParams(location.search).get('variant');
 let selected=variants.find(variant=>String(variant.id)===requestedVariant)||variants.find(variant=>Number(variant.stock)>0)||variants[0];let quantity=1;
 const storages=[...new Set(variants.map(variant=>variant.storage))];const colors=[...new Set(variants.map(variant=>variant.color))];
 root.innerHTML=`<div class="container">${breadcrumb([{label:'Điện thoại',href:'products.html'},{label:product.name}])}<section class="product-detail"><div class="gallery"><div class="gallery-main"><img id="main-product-image" src="${imageUrl(selected.image||product.images?.[0])}" alt="${escapeHTML(product.name)}" width="600" height="620"></div><div class="gallery-thumbnails" id="gallery-thumbnails" aria-label="Ảnh sản phẩm"></div></div><div class="detail-info"><a class="eyebrow" href="products.html?brand=${encodeURIComponent(product.brand?.slug||'')}">${escapeHTML(product.brand?.name)}</a><h1>${escapeHTML(product.name)}</h1><p class="detail-summary">${escapeHTML(product.summary)}</p><div class="detail-price-panel" id="detail-price" aria-live="polite"></div><fieldset class="variant-group"><legend>Dung lượng lưu trữ</legend><div class="variant-options" id="storage-options">${storages.map(storage=>`<button type="button" class="variant-option" data-storage="${escapeHTML(storage)}">${escapeHTML(storage)}</button>`).join('')}</div></fieldset><fieldset class="variant-group"><legend>Màu sắc: <span id="selected-color"></span></legend><div class="variant-options" id="color-options">${colors.map(color=>`<button type="button" class="variant-option" data-color="${escapeHTML(color)}">${escapeHTML(color)}</button>`).join('')}</div></fieldset><div class="detail-stock" id="detail-stock" aria-live="polite"></div><div class="detail-quantity"><label for="detail-quantity">Số lượng</label><div class="quantity-control"><button type="button" id="quantity-minus" aria-label="Giảm số lượng">${icon('minus',16)}</button><input type="number" id="detail-quantity" min="1" max="99" value="1" inputmode="numeric"><button type="button" id="quantity-plus" aria-label="Tăng số lượng">${icon('plus',16)}</button></div></div><div class="detail-actions"><button type="button" class="button button-primary" id="buy-now">Mua ngay ${icon('arrow-right',18)}</button><button type="button" class="button button-outline" id="add-to-cart">${icon('bag',18)} Thêm vào giỏ</button></div><div class="detail-benefits"><span>${icon('shield',18)} Thông tin phiên bản và giá được hiển thị rõ ràng</span><span>${icon('truck',18)} Hỗ trợ giao hàng toàn quốc · Thanh toán COD</span><a href="policy.html#warranty">${icon('refresh',18)} Tìm hiểu chính sách bảo hành & đổi trả</a></div></div></section><div class="detail-bottom"><section class="panel"><h2>Một trải nghiệm dành cho bạn</h2><p>${escapeHTML(product.description)}</p><p>Khám phá thiết kế, chọn dung lượng và màu sắc phù hợp với nhu cầu của bạn. Thông tin và ảnh trong bản trải nghiệm này là dữ liệu minh họa.</p><h3>An tâm khi lựa chọn</h3><p>Tham khảo <a class="button-link" href="policy.html#warranty">chính sách bảo hành</a> hoặc <a class="button-link" href="contact.html">liên hệ tư vấn</a> trước khi mua.</p></section><section class="panel"><h2>Thông số tham khảo</h2><table class="spec-table"><caption class="sr-only">Thông số kỹ thuật mẫu của ${escapeHTML(product.name)}</caption><tbody>${Object.entries(product.specs||{}).map(([label,value])=>`<tr><th scope="row">${escapeHTML(label)}</th><td>${escapeHTML(value || 'Chưa xác minh')}</td></tr>`).join('')}</tbody></table></section></div><section class="section"><div class="section-heading"><div><h2>Có thể bạn cũng thích</h2><p>Thêm lựa chọn từ ${escapeHTML(product.brand?.name)}.</p></div><a class="button-link" href="products.html?brand=${encodeURIComponent(product.brand?.slug||'')}">Xem thêm ${icon('arrow-right',16)}</a></div><div id="related-products">${loading(4)}</div></section></div>`;
 const quantityInput=root.querySelector('#detail-quantity');
 const updateQuantity=value=>{quantity=Math.max(1,Math.min(positiveInteger(value),Math.max(1,Math.min(Number(selected.stock),99))));quantityInput.value=String(quantity);root.querySelector('#quantity-minus').disabled=quantity<=1;root.querySelector('#quantity-plus').disabled=quantity>=Math.min(Number(selected.stock),99);};
 const render=()=>{
   root.querySelector('#selected-color').textContent=selected.color;
   root.querySelectorAll('[data-storage]').forEach(button=>{const active=button.dataset.storage===selected.storage;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
   root.querySelectorAll('[data-color]').forEach(button=>{const active=button.dataset.color===selected.color;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.disabled=!variants.some(variant=>variant.storage===selected.storage&&variant.color===button.dataset.color);});
   root.querySelector('#detail-price').innerHTML=`<span class="product-price">${money(selected.price)}</span>${Number(selected.original_price)>Number(selected.price)?`<span class="original-price">${money(selected.original_price)}</span><span class="badge badge-sale">Tiết kiệm ${money(selected.original_price-selected.price)}</span>`:''}`;
   const stock=Number(selected.stock)||0;root.querySelector('#detail-stock').innerHTML=`<span class="stock-status ${stock?'':'unavailable'}">${icon(stock?'check-circle':'clock',17)} ${stock?`Còn hàng · ${stock} sản phẩm`:'Phiên bản này tạm hết hàng'}</span>`;
   quantityInput.max=String(Math.max(1,Math.min(stock,99)));quantityInput.disabled=!stock;updateQuantity(quantity);
   root.querySelector('#add-to-cart').disabled=!stock;root.querySelector('#buy-now').disabled=!stock;
   root.querySelector('#main-product-image').src=new URL(selected.image||product.images?.[0]||'assets/images/fallback.svg',document.baseURI).href;
   const images=[...new Set([selected.image,...(product.images||[])].filter(Boolean))].slice(0,4);
   root.querySelector('#gallery-thumbnails').innerHTML=images.map((image,index)=>`<button type="button" class="${index===0?'active':''}" data-image-index="${index}" aria-label="Xem ảnh ${index+1} của ${escapeHTML(product.name)}" aria-pressed="${index===0}"><img src="${imageUrl(image)}" alt="" width="70" height="70"></button>`).join('');
   root.querySelector('#gallery-thumbnails').onclick=event=>{const button=event.target.closest('[data-image-index]');if(!button)return;root.querySelector('#main-product-image').src=new URL(images[Number(button.dataset.imageIndex)],document.baseURI).href;root.querySelectorAll('[data-image-index]').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});};
 };
 root.querySelector('#storage-options').addEventListener('click',event=>{const button=event.target.closest('[data-storage]');if(!button)return;selected=variants.find(variant=>variant.storage===button.dataset.storage&&variant.color===selected.color)||variants.find(variant=>variant.storage===button.dataset.storage);render();});
 root.querySelector('#color-options').addEventListener('click',event=>{const button=event.target.closest('[data-color]');if(!button||button.disabled)return;selected=variants.find(variant=>variant.storage===selected.storage&&variant.color===button.dataset.color)||selected;render();});
 quantityInput.addEventListener('change',()=>updateQuantity(quantityInput.value));
 root.querySelector('#quantity-minus').addEventListener('click',()=>updateQuantity(quantity-1));root.querySelector('#quantity-plus').addEventListener('click',()=>updateQuantity(quantity+1));
 const add=async buy=>{try{updateQuantity(quantityInput.value);await addItem(product,selected.id,quantity);if(buy)location.href='checkout.html';else toast(`Đã thêm ${product.name} vào giỏ hàng`);}catch(error){toast(error.message,'error');}};
 root.querySelector('#add-to-cart').addEventListener('click',()=>add(false));root.querySelector('#buy-now').addEventListener('click',()=>add(true));render();
 const related=root.querySelector('#related-products');try{const result=await api.getProducts({brand:product.brand?.slug,per_page:5});const items=result.items.filter(item=>String(item.id)!==String(product.id)).slice(0,4);related.innerHTML=items.length?`<div class="product-grid">${items.map(productCard).join('')}</div>`:emptyState('Khám phá thêm lựa chọn','Xem các thương hiệu khác trong danh sách điện thoại.','products.html');}catch(error){renderError(related,error);}
}
