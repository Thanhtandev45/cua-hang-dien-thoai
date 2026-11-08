"""Optional read-only HTTPS research of manufacturer references.

Stores factual match diagnostics, not downloaded images or manufacturer prose.
Matches do not certify regional colour/storage combinations or current availability.
"""
import concurrent.futures
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = ('apple.com','samsung.com','mi.com','oppo.com','vivo.com','realme.com',
           'honor.com','google.com','oneplus.com','motorola.com','nothing.tech',
           'asus.com','sony.co.uk','tecno-mobile.com')


class Text(HTMLParser):
    def __init__(self): super().__init__(); self.text=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
    def handle_data(self, data):
        if not self.skip: self.text.append(data)


def norm(value): return re.sub(r'[^a-z0-9]', '', value.casefold())


def fetch(url):
    host=urllib.parse.urlparse(url).hostname or ''
    if not any(host==domain or host.endswith('.'+domain) for domain in ALLOWED):
        return {'status':'blocked_domain','url':url}, ''
    try:
        request=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (compatible; CatalogReferenceCheck/1.0)'})
        with urllib.request.urlopen(request,timeout=15) as response:
            body=response.read(3_000_000)
            parser=Text();parser.feed(body.decode('utf-8',errors='replace'))
            text=' '.join(' '.join(parser.text).split())
            return {'status':'fetched','url':url,'final_url':response.url,'http_status':response.status,
                    'content_sha256':hashlib.sha256(body).hexdigest()}, text
    except Exception as error:
        return {'status':'unavailable','url':url,'reason':type(error).__name__+': '+str(error)[:180]}, ''


def main():
    products=json.loads((ROOT/'mock/products.json').read_text(encoding='utf-8'))
    references={p['source_url'] for p in products if p.get('source_url')}
    fetched={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        jobs={pool.submit(fetch,url):url for url in sorted(references)}
        for index, future in enumerate(concurrent.futures.as_completed(jobs),1):
            url=jobs[future];fetched[url]=future.result()
            if index%25==0: print(f'Checked {index}/{len(jobs)} references',flush=True)
    results=[]
    for product in products:
        url=product.get('source_url')
        if not url: continue
        status,text=fetched[url]
        # Large shared pages need manual section review; do not call raw matches verification.
        capacities=sorted({v['storage'] for v in product['variants']})
        colors=sorted({v['color'] for v in product['variants']})
        normalized=norm(text)
        model=norm(product['name'])
        for prefix in ('samsung','xiaomi','google','asus','sony','tecno','nothing','motorola'):
            if model.startswith(prefix): model=model[len(prefix):];break
        missing_storage=[value for value in capacities if norm(value) not in normalized]
        missing_colors=[value for value in colors if norm(value) not in normalized]
        results.append({'product_id':product['id'],'name':product['name'],**status,
                        'model_mentioned':bool(model and model in normalized),
                        'storage_not_found':missing_storage,'colors_not_found':missing_colors,
                        'review':'manual_regional_review_required'})
    report={'checked_at':datetime.now(timezone.utc).isoformat(),'products':results,
            'fetched_models':sum(r['status']=='fetched' for r in results),
            'model_mentions':sum(r['model_mentioned'] for r in results),
            'unavailable_models':sum(r['status']!='fetched' for r in results),
            'note':'Automated string-presence diagnostics only; not certification of exact regional SKUs, current stock or pricing.'}
    (ROOT/'docs/catalog-source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key!='products'},ensure_ascii=True,indent=2))


if __name__=='__main__': main()
