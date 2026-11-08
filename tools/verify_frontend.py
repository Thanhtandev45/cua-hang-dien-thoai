#!/usr/bin/env python3
"""Read-only structural checks for the buildless NOVA Mobile frontend.

Run: python tools/verify_frontend.py
No dependencies are required. Node.js is optional for JavaScript syntax checks.
This does not run a browser, PHP, MySQL or perform a security audit.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_PAGES = (
    'index', 'products', 'product', 'cart', 'checkout', 'login', 'register',
    'account', 'orders', 'order', 'news', 'article', 'contact', 'policy',
)
SKIP_DIRS = {'.git', '.agents', '.codex', 'node_modules', '__pycache__', '.venv', 'venv'}
STATIC_IMPORT = re.compile(
    r'''(?:\bimport\s+(?:[\w*{},\s]+\s+from\s+)?|\bexport\s+(?:\*|\{[^}]+\})\s+from\s+)["']([^"']+)["']'''
)
DYNAMIC_IMPORT = re.compile(r'''\bimport\s*\(\s*["']([^"']+)["']\s*\)''')
TEMPLATE_ASSET = re.compile(r'''\b(?:href|src|action)\s*=\s*["']([^"']+)["']''')
CSS_REFERENCE = re.compile(r'''url\(\s*["']?([^)'"\s]+)["']?\s*\)|@import\s+["']([^"']+)["']''')
failures: list[str] = []
warnings: list[str] = []
checks = 0


def display(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def check(condition: bool, message: str) -> bool:
    global checks
    checks += 1
    if not condition:
        failures.append(message)
    return bool(condition)


def local_reference(value: str, owner: Path, base: Path | None = None) -> Path | None:
    """Resolve URLs without HTTP requests or exposing file contents."""
    value = value.strip()
    if not value or value.startswith('#') or '${' in value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return None
    pathname = unquote(parsed.path)
    if not pathname:
        return None
    start = ROOT if pathname.startswith('/') else (base or owner.parent)
    target = (start / pathname.lstrip('/')).resolve()
    if not check(target.is_relative_to(ROOT), f'{display(owner)}: path escapes repository: {value}'):
        return None
    check(target.is_file(), f'{display(owner)}: missing local reference: {value}')
    return target


class PageParser(HTMLParser):
    def __init__(self, owner: Path):
        super().__init__(convert_charrefs=True)
        self.owner = owner
        self.has_lang = False
        self.has_viewport = False
        self.has_charset = False
        self.has_main = False
        self.module_count = 0

    def handle_starttag(self, tag: str, attributes: list[tuple[str, str | None]]) -> None:
        attrs = dict(attributes)
        if tag == 'html':
            self.has_lang = (attrs.get('lang') or '').lower().startswith('vi')
        if tag == 'meta':
            self.has_viewport |= attrs.get('name') == 'viewport'
            self.has_charset |= (attrs.get('charset') or '').lower() == 'utf-8'
        if tag == 'main':
            self.has_main |= attrs.get('id') == 'main'
        for attr in ('href', 'src', 'action', 'poster'):
            if attrs.get(attr):
                local_reference(attrs[attr], self.owner)
        if tag == 'script' and attrs.get('src'):
            check(attrs.get('type') == 'module', f'{display(self.owner)}: script should use type="module"')
            self.module_count += attrs.get('type') == 'module'
        if attrs.get('srcset'):
            for candidate in attrs['srcset'].split(','):
                local_reference(candidate.strip().split()[0], self.owner)

    handle_startendtag = handle_starttag


def verify_pages() -> None:
    for page in EXPECTED_PAGES:
        check((ROOT / f'{page}.html').is_file(), f'Missing required page: {page}.html')
    for path in sorted(ROOT.glob('*.html')):
        parser = PageParser(path)
        parser.feed(path.read_text(encoding='utf-8-sig'))
        check(parser.has_lang, f'{path.name}: missing Vietnamese document language')
        check(parser.has_viewport, f'{path.name}: missing viewport metadata')
        check(parser.has_charset, f'{path.name}: missing UTF-8 metadata')
        check(parser.has_main, f'{path.name}: missing main#main mount')
        check(parser.module_count > 0, f'{path.name}: no module script entry')


def verify_javascript() -> None:
    node = shutil.which('node')
    if not node:
        warnings.append('Node.js unavailable: JavaScript syntax compilation was skipped.')
    for path in sorted((ROOT / 'assets/js').rglob('*.js')):
        source = path.read_text(encoding='utf-8-sig')
        imports = STATIC_IMPORT.findall(source) + DYNAMIC_IMPORT.findall(source)
        for module in imports:
            if check(module.startswith(('./', '../')), f'{display(path)}: buildless module must use a local relative import: {module}'):
                local_reference(module, path)
        # HTML templates are resolved by the browser against the document root.
        for value in TEMPLATE_ASSET.findall(source):
            local_reference(value, path, ROOT)
        if node:
            result = subprocess.run(
                [node, '--input-type=module', '--check'], input=source,
                capture_output=True, text=True, encoding='utf-8', timeout=20,
            )
            error = '\n'.join(result.stderr.strip().splitlines()[:5])
            check(result.returncode == 0, f'{display(path)}: JavaScript syntax error\n{error}')


def verify_css() -> None:
    for path in sorted((ROOT / 'assets/css').rglob('*.css')):
        for url, imported in CSS_REFERENCE.findall(path.read_text(encoding='utf-8-sig')):
            local_reference(url or imported, path)


def fixture(name: str) -> list[dict]:
    path = ROOT / 'mock' / f'{name}.json'
    check(path.is_file(), f'Missing fixture: {display(path)}')
    if not path.is_file():
        return []
    try:
        items = json.loads(path.read_text(encoding='utf-8-sig'))
    except (ValueError, OSError) as error:
        check(False, f'{display(path)}: invalid JSON: {error}')
        return []
    if not check(isinstance(items, list) and all(isinstance(item, dict) for item in items), f'{display(path)}: fixture must contain an array of objects'):
        return []
    ids = [str(item.get('id', '')) for item in items]
    slugs = [item.get('slug', '') for item in items]
    check(all(ids) and len(ids) == len(set(ids)), f'{display(path)}: IDs must be present and unique')
    check(all(isinstance(slug, str) and slug for slug in slugs) and len(slugs) == len(set(slugs)), f'{display(path)}: slugs must be present and unique')
    return items


def positive_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def verify_fixtures() -> None:
    brands = fixture('brands')
    products = fixture('products')
    posts = fixture('posts')
    brand_ids = {str(brand.get('id')) for brand in brands}
    check(len(brands) >= 14, 'Expected at least fourteen demo brands')
    check(len(products) >= 250, 'Expected at least 250 demo phones')
    variant_ids: set[str] = set()
    stock_values: list[int] = []
    for product in products:
        label = f'Product {product.get("id")}'
        check(bool(product.get('name')), f'{label}: missing product name')
        brand = product.get('brand', {})
        check(isinstance(brand, dict) and str(brand.get('id')) in brand_ids, f'{label}: unknown brand')
        images = product.get('images', [])
        check(isinstance(images, list) and len(images) > 0, f'{label}: no image gallery')
        for image in images if isinstance(images, list) else []:
            local_reference(str(image), ROOT / 'mock/products.json', ROOT)
        variants = product.get('variants', [])
        check(isinstance(variants, list) and len(variants) > 0, f'{label}: no variants')
        for variant in variants if isinstance(variants, list) else []:
            if not check(isinstance(variant, dict), f'{label}: invalid variant object'):
                continue
            variant_id = str(variant.get('id', ''))
            check(bool(variant_id) and variant_id not in variant_ids, f'{label}: variant ID missing or duplicated: {variant_id}')
            variant_ids.add(variant_id)
            price = variant.get('price')
            original = variant.get('original_price')
            check(positive_number(price), f'{label}/{variant_id}: price must be positive and finite')
            check(original is None or (positive_number(original) and positive_number(price) and original >= price), f'{label}/{variant_id}: original price must be null or at least sale price')
            stock = variant.get('stock')
            valid_stock = isinstance(stock, int) and not isinstance(stock, bool) and stock >= 0
            check(valid_stock, f'{label}/{variant_id}: stock must be a nonnegative integer')
            if valid_stock:
                stock_values.append(stock)
            check(bool(variant.get('color')) and bool(variant.get('storage')), f'{label}/{variant_id}: missing color or storage')
            check(bool(re.fullmatch(r'#[0-9a-fA-F]{6}', str(variant.get('color_hex', '')))), f'{label}/{variant_id}: invalid color hex')
            check(bool(variant.get('image')), f'{label}/{variant_id}: missing image')
            if variant.get('image'):
                local_reference(str(variant['image']), ROOT / 'mock/products.json', ROOT)
    check(0 in stock_values and any(stock > 0 for stock in stock_values), 'Fixtures should include available and unavailable variants')
    check(len(posts) > 0, 'Expected demo news posts')
    for post in posts:
        label = f'Post {post.get("id")}'
        check(bool(post.get('title')) and bool(post.get('excerpt')), f'{label}: missing editorial text')
        content = post.get('content', [])
        check(isinstance(content, list) and len(content) > 0 and all(isinstance(paragraph, str) for paragraph in content), f'{label}: content should be paragraph strings')
        check(bool(post.get('image')), f'{label}: missing image')
        if post.get('image'):
            local_reference(str(post['image']), ROOT / 'mock/posts.json', ROOT)


def verify_svg() -> None:
    for path in sorted((ROOT / 'assets/images').rglob('*.svg')):
        try:
            tree = ET.fromstring(path.read_text(encoding='utf-8-sig'))
        except (ET.ParseError, OSError) as error:
            check(False, f'{display(path)}: SVG XML error: {error}')
            continue
        check(tree.tag.rsplit('}', 1)[-1] == 'svg', f'{display(path)}: root should be svg')
        check(any(element.tag.rsplit('}', 1)[-1] == 'title' for element in tree.iter()), f'{display(path)}: missing accessible title')
        for element in tree.iter():
            tag = element.tag.rsplit('}', 1)[-1].lower()
            check(tag not in {'script', 'foreignobject', 'image'}, f'{display(path)}: unsupported embedded element: {tag}')
            for name, value in element.attrib.items():
                attr = name.rsplit('}', 1)[-1].lower()
                check(not attr.startswith('on'), f'{display(path)}: event handlers are not allowed')
                if attr == 'href':
                    check(value.startswith('#'), f'{display(path)}: nonlocal href is not allowed')
                for reference in re.findall(r'url\(([^)]+)\)', value):
                    check(reference.strip(' \"\'').startswith('#'), f'{display(path)}: external URL is not allowed')


def verify_sensitive_filenames() -> None:
    sensitive_names = {'credentials.json', 'service-account.json', 'id_rsa', 'id_ed25519'}
    sensitive_extensions = {'.pem', '.key', '.p12', '.pfx'}
    for path in ROOT.rglob('*'):
        relative = path.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in relative.parts) or not path.is_file():
            continue
        name = path.name.lower()
        is_env = name == '.env' or (name.startswith('.env.') and name not in {'.env.example', '.env.sample', '.env.template'})
        check(not (is_env or name in sensitive_names or path.suffix.lower() in sensitive_extensions), f'Potential secret file in project/public tree: {relative.as_posix()}')


def main() -> int:
    for operation in (verify_pages, verify_javascript, verify_css, verify_fixtures, verify_svg, verify_sensitive_filenames):
        try:
            operation()
        except Exception as error:
            check(False, f'{operation.__name__}: unexpected validation error: {error}')
    for warning in warnings:
        print(f'WARN: {warning}')
    for failure in failures:
        print(f'FAIL: {failure}')
    print(f'{"FAIL" if failures else "PASS"}: {checks} checks; {len(failures)} errors; {len(warnings)} warnings.')
    print('Scope: static files only; browser/PHP/MySQL behavior and secret contents were not audited.')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
