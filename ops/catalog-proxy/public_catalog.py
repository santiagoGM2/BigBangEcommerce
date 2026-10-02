"""Catalogo compacto en memoria; refresco atomico sin interrumpir lecturas."""
import gzip
import json
import logging
import re
import threading
import time
from datetime import datetime, timezone

import pymysql
from catalog import PricePolicy, transform_catalog


def read_products(cfg):
    view = cfg['view']
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', view):
        raise ValueError('Invalid view')
    if cfg.get('allowPlaintext') is not True:
        raise ValueError('Explicit ERP connection policy required')
    policy = PricePolicy(**cfg['pricePolicy'])
    policy.validate()
    connection = pymysql.connect(host=cfg['host'], port=int(cfg['port']),
        user=cfg['user'], password=cfg['password'], database=cfg['database'],
        connect_timeout=5, read_timeout=60, write_timeout=15, autocommit=False,
        cursorclass=pymysql.cursors.DictCursor)
    try:
        with connection.cursor() as cursor:
            cursor.execute('START TRANSACTION READ ONLY')
            cursor.execute('SELECT ID_ITEM, ID_LIPRE1, PRECIO_MIN_1, ID_REFERENCIA, '
                'DESCRIPCION, DESCRIPCION_LINEA2, COD_BARRA_PRINCIPAL, ESTADO_LITERAL '
                f'FROM `{view}`')
            return transform_catalog(cursor.fetchall(), policy)
    finally:
        connection.rollback()
        connection.close()


class CatalogCache:
    def __init__(self, cfg, loader=read_products, ttl=21600):
        self.cfg, self.loader, self.ttl = cfg, loader, ttl
        self.lock = threading.Lock()
        self.snapshot = None
        self.last_error = False

    def refresh(self):
        if not self.lock.acquire(blocking=False):
            return False
        try:
            products = self.loader(self.cfg)
            if not products:
                raise ValueError('Empty catalog')
            body = json.dumps(products, ensure_ascii=False, separators=(',', ':')).encode()
            compressed = gzip.compress(body, compresslevel=5)
            # Una sola asignacion publica un snapshot completo, nunca parcial.
            self.snapshot = (body, compressed, len(products), time.monotonic(),
                datetime.now(timezone.utc).isoformat())
            self.last_error = False
            logging.info('Catalog refreshed: %s products', len(products))
            return True
        except Exception as error:
            self.last_error = True
            logging.error('Catalog refresh failed: %s', type(error).__name__)
            return False
        finally:
            self.lock.release()

    def start(self):
        def work():
            while True:
                self.refresh()
                # Reintento breve ante fallos; conserva el ultimo snapshot valido.
                time.sleep(60 if self.last_error else self.ttl)
        threading.Thread(target=work, daemon=True).start()

    def status(self):
        snapshot = self.snapshot
        return {'ready': snapshot is not None, 'count': snapshot[2] if snapshot else 0,
            'updated_at': snapshot[4] if snapshot else None,
            'age_seconds': int(time.monotonic() - snapshot[3]) if snapshot else None,
            'refreshing': self.lock.locked(), 'last_refresh_failed': self.last_error}
