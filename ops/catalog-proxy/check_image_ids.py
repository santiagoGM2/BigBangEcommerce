"""Comprobacion HTTPS real sin imprimir la API key ni el catalogo completo."""
import json
from urllib.request import Request, urlopen

with open('/etc/bigbang/catalog-config.json', encoding='utf8') as handle:
    cfg = json.load(handle)
with urlopen(Request('https://api.tiendasbigbang.com/producto-ids',
    headers={'x-api-key': cfg['apiKey']}), timeout=75) as response:
    payload = json.load(response)
print(json.dumps({key: payload[key] for key in ['count', 'complete', 'queried_at']}))
