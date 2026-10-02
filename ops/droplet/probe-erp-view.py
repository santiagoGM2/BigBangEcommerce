#!/usr/bin/env python3
"""Diagnostico de solo lectura; credenciales recibidas por stdin sobre SSH."""
import json
import re
import sys
import pymysql

try:
    cfg = json.load(sys.stdin)
    if cfg.get('allowPlaintext') is not True:
        raise ValueError('Plaintext connection not explicitly enabled')
    view = cfg['view']
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', view):
        raise ValueError('Invalid view')
    connection = pymysql.connect(host=cfg['host'], port=int(cfg['port']),
        user=cfg['user'], password=cfg['password'], database=cfg['database'],
        connect_timeout=5, read_timeout=60, write_timeout=15,
        autocommit=False, cursorclass=pymysql.cursors.DictCursor)
    try:
        with connection.cursor() as cursor:
            cursor.execute('START TRANSACTION READ ONLY')
            if cfg.get('export'):
                cursor.execute(f'SELECT * FROM `{view}`')
                print(json.dumps(cursor.fetchall(), default=str))
                sys.exit(0)
            cursor.execute('SHOW SESSION STATUS LIKE %s', ('Ssl_cipher',))
            tls = bool(cursor.fetchone()['Value'])
            cursor.execute('SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION '
                'FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s '
                'ORDER BY ORDINAL_POSITION', (cfg['database'], view))
            columns = cursor.fetchall()
            if not columns:
                raise ValueError('View not visible')
            cursor.execute(f'SELECT 1 AS ok FROM `{view}` LIMIT 1')
            has_rows = bool(cursor.fetchone())
            cursor.execute(f'SELECT COUNT(*) AS rows_count, COUNT(DISTINCT ID_ITEM) AS product_count FROM `{view}`')
            counts = cursor.fetchone()
            names = {col['COLUMN_NAME'] for col in columns}
            dimensions = {}
            for name in ['ID_LIPRE1', 'ESTADO_LITERAL', 'DESCRIPCION_TASA_IMPUESTO']:
                if name in names:
                    cursor.execute(f'SELECT `{name}` AS value, COUNT(*) AS n FROM `{view}` GROUP BY `{name}` LIMIT 20')
                    dimensions[name] = cursor.fetchall()
            cursor.execute(f'SELECT ID_ITEM, ID_LIPRE1, PRECIO_SUG_1, VLRIVA_UNI_1, '
                f'IMPOCONSUMO1_1, IMPOCONSUMO2_1, DESCRIPCION_LINEA2, DESCRIPCION_CRITERIO1, '
                f'DESCRIPCION_CRITERIO2, ESTADO_LITERAL FROM `{view}` LIMIT 12')
            sample = cursor.fetchall()
            print(json.dumps({'tls': tls, 'selectAllowed': True, 'hasRows': has_rows,
                'view': view, 'counts': counts, 'columns': columns, 'dimensions': dimensions, 'sample': sample}, default=str))
    finally:
        connection.rollback()
        connection.close()
except Exception as exc:
    code = exc.args[0] if isinstance(exc, pymysql.MySQLError) and exc.args else type(exc).__name__
    print(json.dumps({'errorCode': str(code)}))
    sys.exit(1)
