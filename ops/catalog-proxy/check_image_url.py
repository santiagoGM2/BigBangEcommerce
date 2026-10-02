"""Comprobacion publica HTTPS de una imagen desde otra red; no usa claves."""
import json
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

url = json.load(sys.stdin)['url']
parsed = urlparse(url)
if parsed.scheme != 'https' or parsed.hostname != 'rzhzuvmrnfuctwyunhiu.supabase.co' or not parsed.path.startswith('/storage/v1/object/public/productos/'):
    raise ValueError('URL outside product bucket')
with urlopen(Request(url, method='HEAD'), timeout=15) as response:
    print(json.dumps({'status': response.status, 'content_type': response.headers.get('Content-Type'),
        'bytes': int(response.headers.get('Content-Length', '0'))}))
