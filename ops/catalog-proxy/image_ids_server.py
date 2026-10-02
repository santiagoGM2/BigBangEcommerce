#!/usr/bin/env python3
"""IDs reales para las fotos, independientes de las reglas de precios."""
import hmac
import json
import re
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pymysql


def read_ids(cfg):
    view = cfg['view']
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', view):
        raise ValueError('Invalid view')
    if cfg.get('allowPlaintext') is not True:
        raise ValueError('Explicit ERP connection policy required')
    connection = pymysql.connect(host=cfg['host'], port=int(cfg['port']),
        user=cfg['user'], password=cfg['password'], database=cfg['database'],
        connect_timeout=5, read_timeout=60, write_timeout=15, autocommit=False)
    try:
        with connection.cursor() as cursor:
            cursor.execute('START TRANSACTION READ ONLY')
            cursor.execute(f'SELECT DISTINCT ID_ITEM FROM `{view}` ORDER BY ID_ITEM')
            ids = [row[0] for row in cursor.fetchall()]
            if not ids or any(not isinstance(value, str) or not re.fullmatch(r'\d+', value) for value in ids):
                raise ValueError('Invalid catalog identifiers')
            return {'ids': ids, 'count': len(ids), 'complete': True,
                'queried_at': datetime.now(timezone.utc).isoformat()}
    finally:
        connection.rollback()
        connection.close()


def make_handler(cfg, loader=read_ids):
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, payload):
            data = json.dumps(payload, separators=(',', ':')).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not hmac.compare_digest(self.headers.get('x-api-key', ''), cfg['apiKey']):
                self.respond(401, {'error': 'unauthorized'})
                return
            if self.path != '/producto-ids':
                self.respond(503 if self.path == '/productos' else 404,
                    {'error': 'price_policy_pending' if self.path == '/productos' else 'not_found'})
                return
            # Cada lote obtiene una consulta real; no devuelve una copia antigua
            # cuando falla el ERP. Limita consultas concurrentes en el droplet.
            if not lock.acquire(blocking=False):
                self.respond(503, {'error': 'catalog_busy'})
                return
            try:
                self.respond(200, loader(cfg))
            except Exception:
                self.respond(503, {'error': 'catalog_unavailable'})
            finally:
                lock.release()

        def log_message(self, fmt, *args):
            # No registra headers, credenciales ni datos del ERP.
            pass

    return Handler


if __name__ == '__main__':
    with open('/etc/bigbang/catalog-config.json', encoding='utf8') as handle:
        config = json.load(handle)
    if not isinstance(config.get('apiKey'), str) or len(config['apiKey']) < 24:
        raise ValueError('API key missing or too short')
    ThreadingHTTPServer(('127.0.0.1', 8080), make_handler(config)).serve_forever()
