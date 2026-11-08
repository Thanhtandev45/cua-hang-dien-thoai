"""Validate demo integrity and compatibility; never certifies manufacturer specs."""
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def main():
    products=json.loads((ROOT/'mock/products.json').read_text(encoding='utf-8'))
    brands=json.loads((ROOT/'mock/brands.json').read_text(encoding='utf-8'))
    baseline=json.loads((ROOT/'tests/fixtures/catalog-original.json').read_text(encoding='utf-8'))
    index=json.loads((ROOT/'mock/catalog/index.json').read_text(encoding='utf-8'))
    errors=[];warnings=[]
    def check(condition,message):
        if not condition: errors.append(message)
    def unique(values,label):
        check(len(values)==len(set(values)),f'Duplicate {label}')
    unique([p['id'] for p in products],'product ID')
    unique([p['slug'] for p in products],'product slug')
    unique([b['id'] for b in brands],'brand ID')
    unique([b['slug'] for b in brands],'brand slug')
    unique([(p['brand']['id'],re.sub(r'[^a-z0-9+]','',p['name'].lower())) for p in products],'model in brand')
    variants=[v for p in products for v in p['variants']]
    unique([v['id'] for v in variants],'variant ID')
    unique([v.get('sku') for v in variants],'SKU')
    check(len(products)>=250,'Expected at least 250 models')
    check(len(brands)>=14,'Expected at least 14 brands')
    check(len(variants)>=1000,'Expected at least 1000 variants')
    brand_map={b['id']:b for b in brands}
    by_id={p['id']:p for p in products}
    for original in baseline['brands']:
        check(brand_map.get(original['id'])==original,f"Legacy brand changed: {original['id']}")
    for original in baseline['products']:
        current=by_id.get(original['id'],{})
        for key,value in original.items():
            if key!='variants': check(current.get(key)==value,f"Legacy product {original['id']} field changed: {key}")
        current_variants={v['id']:v for v in current.get('variants',[])}
        for old in original['variants']:
            for key,value in old.items():
                check(current_variants.get(old['id'],{}).get(key)==value,f"Legacy variant {old['id']} field changed: {key}")
    images=set();new_model_images=set();legacy_duplicates=[]
    for product in products:
        pid=product['id']
        check(product['brand']==brand_map.get(product['brand']['id']),f'Unknown/mismatching brand {pid}')
        check(bool(product.get('name')) and bool(product.get('slug')),f'Missing name/slug {pid}')
        check(product.get('is_demo') is True,f'Missing demo label {pid}')
        check(bool(product['variants']),f'Missing variants {pid}')
        signatures=[(v['storage'],v['color'].casefold()) for v in product['variants']]
        if len(signatures)!=len(set(signatures)):
            if pid<=20: legacy_duplicates.append(pid)
            else: check(False,f'Duplicate colour/storage combinations in new model {pid}')
        if pid>20:
            check(product.get('verification',{}).get('price_stock')=='demo_only',f'Missing provenance {pid}')
            check(product.get('source_url','').startswith('https://'),f'Missing manufacturer reference {pid}')
            check(product.get('segment') in {'budget','midrange','upper-midrange','flagship','gaming','foldable'},f'Invalid segment {pid}')
            new_model_images.add(product['images'][0])
        for variant in product['variants']:
            vid=variant['id']
            check(vid//100==pid,f'Variant {vid} points to wrong parent {pid}')
            check(bool(re.fullmatch(r'NOVA-[0-9]{4}-[0-9]{6}',variant.get('sku',''))),f'Invalid SKU {vid}')
            check(isinstance(variant['price'],int) and variant['price']>=0,f'Invalid price {vid}')
            check(isinstance(variant['original_price'],int) and variant['original_price']>=variant['price'],f'Invalid original price {vid}')
            check(isinstance(variant['stock'],int) and variant['stock']>=0,f'Invalid stock {vid}')
            check(bool(re.fullmatch(r'(32|64|128|256|512)GB|[12]TB',variant['storage'])),f'Invalid capacity {vid}')
            images.add(variant['image'])
        images.update(product['images'])
        detail=json.loads((ROOT/f'mock/catalog/products/{pid}.json').read_text(encoding='utf-8'))
        check(detail==product,f'Outdated generated detail {pid}; rerun builder')
    check(len(new_model_images)==len(products)-20,'New models must have their own illustration')
    digests=[]
    for name in images:
        path=ROOT/name
        check(path.is_file(),f'Missing image {name}')
        if not path.is_file(): continue
        if '/catalog/' in name:
            digests.append(hashlib.sha256(path.read_bytes()).hexdigest())
            check(path.stat().st_size<12000,f'Oversized SVG {name}')
        try:
            tree=ET.fromstring(path.read_text(encoding='utf-8'))
            check(tree.tag.endswith('svg'),f'Invalid SVG root {name}')
            check(any(element.tag.endswith('title') for element in tree.iter()),f'Missing SVG title {name}')
        except ET.ParseError: check(False,f'Malformed SVG {name}')
    check(len(set(digests))>=len(products)-20,'Illustrations should differ across models')
    check([p['id'] for p in index]==[p['id'] for p in products],'Index IDs do not match master')
    for item in index:
        product=by_id[item['id']]
        for key in ('id','slug','name','brand','featured','is_new','created_at'):
            check(item[key]==product[key],f'Index field mismatch {item["id"]}/{key}')
        check(item['variants']==[{key:v[key] for key in ('id','storage','price','original_price','stock')} for v in product['variants']],f'Index variant mismatch {item["id"]}')
    for path in (ROOT/'mock/catalog/home').glob('*.json'):
        shelf=json.loads(path.read_text(encoding='utf-8'))
        check(0<len(shelf)<=4,f'Home shelf must contain 1-4 models: {path.name}')
        for product in shelf: check(product==by_id.get(product['id']),f'Stale shelf product {path.name}/{product["id"]}')
    if legacy_duplicates: warnings.append(f'Preserved duplicate legacy option tuples in IDs {legacy_duplicates}; do not merge IDs referenced by existing carts.')
    report={'models':len(products),'brands':len(brands),'variants':len(variants),
            'stock':sum(v['stock'] for v in variants),'zero_stock_variants':sum(v['stock']==0 for v in variants),
            'models_per_brand':dict(Counter(p['brand']['name'] for p in products)),
            'errors':errors,'warnings':warnings,
            'scope':'Structural/demo integrity only; not manufacturer or regional SKU certification.'}
    (ROOT/'docs/catalog-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))
    return bool(errors)


if __name__=='__main__': sys.exit(main())
