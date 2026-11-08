"""Build additive demo catalog artifacts. Run after editing catalog_models.csv.

The JSON master keeps its original schema and IDs. No database or network is used.
Source links are references, never a claim that every regional SKU is certified.
"""
import argparse
import csv
import hashlib
import html
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRANDS = [
    ('honor', 'HONOR'), ('google', 'Google Pixel'), ('oneplus', 'OnePlus'),
    ('motorola', 'Motorola'), ('nothing', 'Nothing'), ('asus', 'ASUS'),
    ('sony', 'Sony Xperia'), ('tecno', 'TECNO'),
]
SEGMENTS = {'flagship': 'Cao cấp', 'upper-midrange': 'Cận cao cấp',
            'midrange': 'Tầm trung', 'budget': 'Phổ thông',
            'gaming': 'Gaming', 'foldable': 'Màn hình gập'}


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def write_json(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def slug(value):
    value = value.replace('+', ' plus ')
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')


def model_key(value):
    # X vs X 5G is not merged; radio generations are genuinely different models.
    return re.sub(r'[^a-z0-9+]', '', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower())


def source_url(brand, name):
    key = slug(name)
    if brand == 'apple':
        return 'https://support.apple.com/en-gb/108044'
    if brand == 'google':
        return 'https://support.google.com/pixelphone/answer/7158570?hl=en'
    if brand == 'samsung':
        key = slug(name.removeprefix('Samsung '))
        return f'https://www.samsung.com/global/galaxy/{key}/specs/'
    if brand == 'xiaomi':
        key = key.removeprefix('xiaomi-') if 'redmi' in key else key
        return f'https://www.mi.com/global/product/{key}/specs/'
    if brand == 'oppo':
        series = 'find-n' if 'Find N' in name else 'find-x' if 'Find X' in name else 'reno' if 'Reno' in name else 'a'
        key = key.removeprefix('oppo-').removesuffix('-5g')
        return f'https://www.oppo.com/en/smartphones/series-{series}/{key}/specs/'
    if brand == 'vivo':
        key = key.removeprefix('vivo-').removesuffix('-5g').replace('-', '')
        return f'https://www.vivo.com/en/products/param/{key}'
    if brand == 'realme':
        return f'https://www.realme.com/global/{key}/specs'
    if brand == 'honor':
        return f'https://www.honor.com/global/phones/{key}/spec/'
    if brand == 'oneplus':
        key = key.removeprefix('oneplus-')
        return f'https://www.oneplus.com/global/{key}/specs'
    if brand == 'motorola':
        return f'https://www.motorola.com/gb/en/p/phones/{key}/'
    if brand == 'nothing':
        return f'https://checkout.nothing.tech/pages/{key.removeprefix("nothing-")}'
    if brand == 'asus':
        if 'ROG' in name:
            return f'https://rog.asus.com/phones/{key.removeprefix("asus-")}/spec/'
        return f'https://www.asus.com/mobile-handhelds/phones/zenfone/{key.removeprefix("asus-").replace("zenfone-", "zenfone-")}/techspec/'
    if brand == 'sony':
        return f'https://www.sony.co.uk/electronics/support/mobile-phones-tablets-mobile-phones/{key.removeprefix("sony-")}/specifications'
    return f'https://www.tecno-mobile.com/phones/tech-specs/techspecs/{key.removeprefix("tecno-")}/'


def color_hex(color):
    colors = [('black', '#30353c'), ('obsidian', '#30353c'), ('midnight', '#303c51'),
              ('graphite', '#555962'), ('white', '#e8e5dc'), ('porcelain', '#e6dfce'),
              ('silver', '#bdc4cb'), ('grey', '#8e969d'), ('gray', '#8e969d'),
              ('green', '#729183'), ('mint', '#a2c8b6'), ('blue', '#7e9fb9'),
              ('bay', '#87accd'), ('gold', '#c7af84'), ('beige', '#d4c2a0'),
              ('pink', '#d6a5b3'), ('rose', '#d8b4bd'), ('purple', '#a399b7'),
              ('violet', '#aaa0be'), ('lavender', '#beb0cc'), ('red', '#ac4b54'),
              ('yellow', '#d8c779'), ('orange', '#cc9370'), ('coral', '#ce8a7c'),
              ('titanium', '#b4afa5'), ('brown', '#9c8174'), ('cyan', '#8bbdbb')]
    return next((hex_value for key, hex_value in colors if key in color.lower()), '#9aaab1')


def illustration(product, color, design):
    """Original small vector, per-model silhouette/cameras/palette; no brand marks."""
    name = html.escape(product['name'])
    seed = int(hashlib.sha256(product['slug'].encode()).hexdigest()[:6], 16)
    body = color_hex(color)
    tilt = [-9, -7, -5, 5, 7, 9][seed % 6]
    width = 182 if design != 'sony' else 159
    height = 358 if design != 'sony' else 390
    x, y = 105, 108
    camera = ''
    if design == 'round':
        camera = '<circle cx="196" cy="187" r="65" fill="#363c43" stroke="#a6abb0" stroke-width="3"/>'
        lenses = [(170, 166), (221, 166), (170, 212)]
    elif design == 'pixel':
        camera = '<rect x="111" y="142" width="170" height="63" rx="28" fill="#8e979a"/><rect x="126" y="153" width="128" height="40" rx="20" fill="#1a242e"/>'
        lenses = [(148, 173), (185, 173), (223, 173)]
    elif design in ('pixel-square','pixel-single'):
        camera = '<rect x="117" y="121" width="103" height="103" rx="23" fill="#303c47"/><circle cx="196" cy="284" r="17" fill="none" stroke="#63727d" stroke-opacity=".5" stroke-width="2"/>'
        lenses = [(144,151),(190,196)] if design=='pixel-square' else [(144,151)]
    elif design == 'nothing':
        camera = '<path d="M144 140v102h48m-39 46c-45 53 37 99 76 54m-33 20v59M235 152v65" fill="none" stroke="#edece7" stroke-width="8" stroke-linecap="round"/>'
        lenses = [(137, 146), (137, 191)]
    elif design in ('samsung-line', 'samsung-ultra', 'sony', 'oneplus'):
        lenses = [(133, 143), (133, 193), (133, 243)]
        if design == 'samsung-ultra': lenses += [(178, 165), (178, 214)]
    elif design in ('apple-pro', 'apple-dual', 'apple-single'):
        camera = '<rect x="117" y="121" width="106" height="112" rx="26" fill="#c2c1ba" fill-opacity=".4" stroke="#ffffff" stroke-opacity=".35"/>'
        lenses = [(145, 150), (193, 181), (145, 207)] if design == 'apple-pro' else [(145, 150), (193, 199)] if design == 'apple-dual' else [(145, 150)]
    else:
        camera = '<rect x="118" y="122" width="109" height="130" rx="18" fill="#38424c" fill-opacity=".7"/>'
        lenses = [(145, 151), (145, 211), (196, 179)]
    lens_radius = 13 if design == 'pixel' else 18
    for cx, cy in lenses:
        camera += f'<circle cx="{cx}" cy="{cy}" r="{lens_radius+3}" fill="#8e989e"/><circle cx="{cx}" cy="{cy}" r="{lens_radius}" fill="#122130"/><circle cx="{cx}" cy="{cy}" r="{lens_radius-6}" fill="#253c50"/><circle cx="{cx-4}" cy="{cy-5}" r="3" fill="#91b9d5" opacity=".7"/>'
    if design == 'flip':
        camera += '<rect x="115" y="126" width="161" height="132" rx="20" fill="#1b2532"/><circle cx="140" cy="153" r="15" fill="#486079"/><circle cx="180" cy="153" r="15" fill="#486079"/><path d="M107 284h178" stroke="#7b858f" stroke-width="4"/>'
    if design == 'gaming':
        camera += '<path d="m124 308 46-29 30 19 55-28M132 328l20 13 38-9" fill="none" stroke="#add3cf" stroke-width="4" opacity=".8"/>'
    front_width = 187 if design != 'fold' else 255
    wallpaper_y = 205 + seed % 90
    if design.startswith('apple'):
        cutout = f'<rect x="{296+front_width//2-19}" y="159" width="38" height="10" rx="5" fill="#13202a"/>'
    elif design == 'sony':
        cutout = '<path d="M368 155h24" stroke="#13202a" stroke-width="3"/>'
    else:
        hole_x = 319 if design in ('pixel-single','pixel-square','nothing') else 296+front_width//2
        cutout = f'<circle cx="{hole_x}" cy="164" r="4" fill="#13202a"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 620" role="img" aria-labelledby="title">
<title id="title">{name} — minh họa SVG, không phải ảnh chụp chính hãng</title>
<defs><linearGradient id="body" x2="1" y2="1"><stop stop-color="{body}"/><stop offset=".55" stop-color="{body}"/><stop offset="1" stop-color="#65717d"/></linearGradient><linearGradient id="screen" x2=".8" y2="1"><stop stop-color="#182e48"/><stop offset="1" stop-color="{body}"/></linearGradient><filter id="shadow" x="-40%" y="-30%" width="180%" height="180%"><feDropShadow dx="2" dy="9" stdDeviation="9" flood-color="#153a68" flood-opacity=".18"/></filter><clipPath id="clip"><rect x="302" y="151" width="{front_width-12}" height="342" rx="23"/></clipPath></defs>
<ellipse cx="304" cy="511" rx="182" ry="17" fill="#153a68" opacity=".06"/>
<g transform="rotate({tilt} 200 300)" filter="url(#shadow)"><rect x="{x}" y="{y}" width="{width}" height="{height}" rx="28" fill="url(#body)" stroke="#a9afb3" stroke-width="2"/><rect x="109" y="112" width="{width-8}" height="{height-8}" rx="25" fill="none" stroke="#fff" stroke-opacity=".4"/>{camera}<circle cx="245" cy="158" r="6" fill="#ede4cd"/><path d="M285 190v50" stroke="#7a858e" stroke-width="4" stroke-linecap="round"/></g>
<g transform="rotate(9 382 320)" filter="url(#shadow)"><rect x="296" y="144" width="{front_width}" height="356" rx="29" fill="#243243" stroke="#8c959d" stroke-width="2"/><rect x="302" y="151" width="{front_width-12}" height="342" rx="23" fill="url(#screen)"/><g clip-path="url(#clip)"><path d="M275 460Q310 {wallpaper_y} 550 246L566 532H275Z" fill="{body}" opacity=".8"/><path d="M280 506Q355 {wallpaper_y+50} 553 331L570 550Z" fill="#dfe7eb" opacity=".28"/><path d="M292 491Q373 {wallpaper_y+70} 553 408" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/></g>{cutout}{'<path d="M420 151v341" stroke="#96a9b5" opacity=".35"/>' if design=='fold' else ''}</g>
<text x="300" y="562" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#64748b">{name}</text><text x="300" y="585" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" letter-spacing="2" fill="#8d9baa">NOVA · MINH HỌA</text></svg>'''


def allowed_pair(name, storage, color):
    # Known color/capacity restrictions: never blindly cross every listed option.
    if name == 'Google Pixel 8a' and storage == 256: return color == 'Obsidian'
    if name in ('Google Pixel 9 Pro', 'Google Pixel 9 Pro XL'):
        if storage == 1024: return color == 'Obsidian'
        if color == 'Rose Quartz': return storage == 256
    if name in ('Google Pixel 6 Pro', 'Google Pixel 7 Pro') and storage == 512:
        return color in ('Stormy Black', 'Obsidian')
    if name == 'Google Pixel 8 Pro' and color == 'Mint': return storage == 128
    if name == 'Google Pixel 6' and storage == 256: return color == 'Stormy Black'
    if name == 'ASUS Zenfone 10' and storage == 512: return color in ('Midnight Black', 'Starry Blue')
    if name == 'ASUS Zenfone 9' and color in ('Sunset Red', 'Starry Blue'): return storage == 128
    return True


def build():
    products = read_json('mock/products.json')
    brands = read_json('mock/brands.json')
    baseline = read_json('tests/fixtures/catalog-original.json')
    # Refuse to rebuild if any original value was modified or removed.
    for original in baseline['products']:
        current = next((p for p in products if p['id'] == original['id']), None)
        if not current: raise ValueError(f"Missing original product {original['id']}")
        for key, value in original.items():
            if key != 'variants' and current.get(key) != value:
                raise ValueError(f"Original product {original['id']} changed field {key}")
        for variant in original['variants']:
            current_variant = next((v for v in current['variants'] if v['id'] == variant['id']), {})
            if any(current_variant.get(k) != v for k, v in variant.items()):
                raise ValueError(f"Original variant {variant['id']} changed")
    for brand_slug, name in BRANDS:
        if not any(b['slug'] == brand_slug for b in brands):
            brands.append({'id': max(b['id'] for b in brands)+1, 'name': name, 'slug': brand_slug})
    brand_map = {b['slug']: b for b in brands}
    names = {(p['brand']['slug'], model_key(p['name'])) for p in products}
    used_ids = {v['id'] for p in products for v in p['variants']}
    # Add only missing SKU/provenance metadata; preserve all existing legacy fields.
    for product in products:
        product.setdefault('is_demo', True)
        product.setdefault('data_quality', 'legacy_unverified' if product['id'] <= 20 else 'reference_options')
        for variant in product['variants']:
            variant.setdefault('sku', f"NOVA-{product['id']:04d}-{variant['id']:06d}")
    with (ROOT/'tools/catalog_models.csv').open(encoding='utf-8', newline='') as source:
        rows = list(csv.DictReader(source, delimiter='|'))
    for row in rows:
        identity = (row['brand'], model_key(row['name']))
        if identity in names: continue
        pid = max(p['id'] for p in products)+1
        capacities = [int(v) for v in row['storage'].split(',')]
        colors = row['colors'].split(',')
        name = row['name']
        product_slug = slug(name)
        if any(p['slug'] == product_slug for p in products):
            product_slug += f'-model-{pid}'
        product = {
            'id': pid, 'slug': product_slug, 'name': name, 'brand': brand_map[row['brand']],
            'segment': row['segment'], 'summary': f"{name} · {SEGMENTS[row['segment']]} · Giá và tồn kho demo.",
            'description': f"{name} thuộc danh mục tham khảo NOVA Mobile. Ảnh là minh họa vector riêng theo dòng máy, không phải ảnh chụp chính hãng. Giá, khuyến mãi và tồn kho chỉ phục vụ kiểm thử. Cấu hình khu vực và tình trạng kinh doanh cần được xác minh trước khi mở bán.",
            'images': [],
            'specs': {'Màn hình': '', 'Chip': '', 'RAM': '', 'Bộ nhớ': ' / '.join(f'{c}GB' if c < 1024 else '1TB' for c in capacities), 'Pin': '', 'Camera': ''},
            'featured': pid % 3 == 0, 'is_new': pid % 7 == 0,
            'created_at': (datetime(2026, 11, 1, tzinfo=timezone(timedelta(hours=7)))+timedelta(minutes=pid)).isoformat(),
            'is_demo': True, 'status': 'published', 'data_quality': 'reference_options',
            'source_url': source_url(row['brand'], name),
            'verification': {'model': 'curated_real_model', 'options': 'reference_requires_regional_review', 'specs': 'unverified_fields_empty', 'price_stock': 'demo_only'},
            'variants': [],
        }
        for color_index, color in enumerate(colors):
            image_path = f"assets/images/catalog/{product['slug']}-{color_index+1}.svg"
            image_file = ROOT/image_path
            image_file.parent.mkdir(parents=True, exist_ok=True)
            if not image_file.exists(): image_file.write_text(illustration(product, color, row['design']), encoding='utf-8')
            product['images'].append(image_path)
            for capacity_index, capacity in enumerate(capacities):
                if not allowed_pair(name, capacity, color): continue
                vid = pid*100+len(product['variants'])+1
                if vid in used_ids: raise ValueError(f'Variant ID collision {vid}')
                used_ids.add(vid)
                base_price = int(row['demo_price'])
                price = base_price + capacity_index*1000000 + color_index*50000
                stock = 0 if (vid+pid) % 13 == 0 else 1+(vid*7+pid*3) % 24
                product['variants'].append({
                    'id': vid, 'sku': f'NOVA-{pid:04d}-{vid:06d}',
                    'color': color, 'color_hex': color_hex(color),
                    'storage': f'{capacity}GB' if capacity < 1024 else '1TB',
                    'price': price, 'original_price': price+(500000 if pid % 4 else 0),
                    'stock': stock, 'image': image_path,
                })
        products.append(product)
        names.add(identity)
    if len(products) != len({p['id'] for p in products}): raise ValueError('Duplicate product IDs')
    if len(products) != len({p['slug'] for p in products}):
        duplicates=[(p['id'],p['name'],p['slug']) for p in products if sum(other['slug']==p['slug'] for other in products)>1]
        raise ValueError(f'Duplicate product slugs: {duplicates}')
    skus = [v['sku'] for p in products for v in p['variants']]
    if len(skus) != len(set(skus)): raise ValueError('Duplicate SKU')
    write_home(products, brands)
    write_json('mock/brands.json', brands)
    write_json('mock/products.json', products)
    # Small index: no descriptions, galleries or spec/provenance payloads.
    index = []
    for product in products:
        item = {key: product[key] for key in ('id', 'slug', 'name', 'brand', 'featured', 'is_new', 'created_at')}
        item['variants'] = [{key: v[key] for key in ('id','storage','price','original_price','stock')} for v in product['variants']]
        index.append(item)
        write_json(f"mock/catalog/products/{product['id']}.json", product)
    # Compact JSON cuts the mock index transfer significantly.
    index_path = ROOT/'mock/catalog/index.json'
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
    report = {
        'demo_only': True, 'models_before': len(baseline['products']), 'models': len(products),
        'brands_before': len(baseline['brands']), 'brands': len(brands),
        'variants_before': sum(len(p['variants']) for p in baseline['products']),
        'variants': len(skus), 'stock_before': sum(v['stock'] for p in baseline['products'] for v in p['variants']),
        'stock': sum(v['stock'] for p in products for v in p['variants']),
        'out_of_stock_variants': sum(v['stock']==0 for p in products for v in p['variants']),
        'models_per_brand': dict(Counter(p['brand']['name'] for p in products)),
        'index_bytes': index_path.stat().st_size,
        'legacy_unverified_models': [p['id'] for p in products if p.get('data_quality')=='legacy_unverified'],
        'note': 'Structural integrity is separate from manufacturer/regional verification; original demo options remain unchanged.'
    }
    write_json('docs/catalog-report.json', report)
    print(json.dumps(report, ensure_ascii=True, indent=2))


def write_home(products, brands):
    """Dedicated four-item shelves: homepage never requests the master/index."""
    def available(product): return any(v['stock']>0 for v in product['variants'])
    fresh = sorted([p for p in products if p['id']>20 and available(p)], key=lambda p:p['id'])
    featured = []
    shelves = {}
    for brand in brands:
        choices = [p for p in fresh if p['brand']['id']==brand['id']][:4]
        if not choices: choices=[p for p in products if p['brand']['id']==brand['id'] and available(p)][:4]
        for product in choices: product['featured']=True
        shelves[f"featured-{brand['slug']}"] = choices
        if choices: featured.append(choices[0])
    shelves['featured-all'] = featured[:4]
    used = {p['id'] for p in featured[:4]}
    new = [p for p in featured[4:] if p['id'] not in used][:4]
    for product in new: product['is_new']=True
    used.update(p['id'] for p in new)
    shelves['new'] = new
    sale = []
    for brand in brands[8:]+brands[:8]:
        candidates=[p for p in fresh if p['brand']['id']==brand['id'] and p['id'] not in used and any(v['stock']>0 and v['original_price']>v['price'] for v in p['variants'])]
        if candidates: sale.append(candidates[0]);used.add(candidates[0]['id'])
        if len(sale)==4: break
    sale.sort(key=lambda p:min(v['price'] for v in p['variants'] if v['stock']>0 and v['original_price']>v['price']))
    shelves['sale'] = sale
    # Serialize after all flags are final; a model may appear on more than one shelf.
    for section, items in shelves.items():
        write_json(f'mock/catalog/home/{section}.json', items)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    build()
