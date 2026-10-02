import unittest
from catalog import PricePolicy, transform_catalog


def row(product_id='000002', list_id='001', amount='4000.0000'):
    return {'ID_ITEM': product_id, 'ID_LIPRE1': list_id, 'PRECIO_MIN_1': amount,
        'PRECIO_SUG_1': '999999.0000', 'PRECIO_SUG_2': '888888.0000',
        'ID_REFERENCIA': '000002', 'DESCRIPCION': 'GLOBO', 'DESCRIPCION_LINEA2': 'PINATERIA',
        'COD_BARRA_PRINCIPAL': '02', 'ESTADO_LITERAL': 'ACTIVO'}


class CatalogTests(unittest.TestCase):
    def setUp(self):
        # Politica de prueba: no representa confirmacion de precios en produccion.
        self.policy = PricePolicy('001', '002', True)

    def test_requires_confirmed_policy(self):
        for policy in [None, PricePolicy('001', '002', False), PricePolicy('001', '001', True)]:
            with self.assertRaises(ValueError):
                transform_catalog([row()], policy)

    def test_exact_contract_preserves_ids_and_uses_minimum_field(self):
        products = transform_catalog([row(list_id='002', amount='3500.0000'), row()], self.policy)
        self.assertEqual(len(products), 1)
        self.assertEqual(set(products[0]), {'id_item', 'referencia', 'descripcion', 'categoria',
            'codigo_barra', 'precio', 'precio_fuente', 'existencias', 'activo'})
        self.assertEqual(products[0]['id_item'], '000002')
        self.assertEqual(products[0]['precio'], 4000)
        self.assertEqual(products[0]['precio_fuente'], 'publica')
        self.assertIsNone(products[0]['existencias'])

    def test_fallback_does_not_change_product_id(self):
        product = transform_catalog([row(list_id='002', amount='3500.0000')], self.policy)[0]
        self.assertEqual(product['precio'], 3500)
        self.assertEqual(product['precio_fuente'], 'respaldo_mayorista')
        self.assertEqual(product['id_item'], '000002')

    def test_numeric_ids_are_rejected(self):
        with self.assertRaises(ValueError):
            transform_catalog([row(product_id=2)], self.policy)

    def test_empty_description_does_not_block_other_products(self):
        invalid = row(product_id='026529')
        invalid['DESCRIPCION'] = ''
        products = transform_catalog([row(), invalid], self.policy)
        self.assertEqual([item['id_item'] for item in products], ['000002'])

    def test_invalid_prices_are_not_published_as_zero(self):
        for amount in ['0', '-1', 'NaN', 'Infinity', '12.50', None, 123.5]:
            with self.assertRaises(ValueError):
                transform_catalog([row(amount=amount)], self.policy)

    def test_duplicate_and_unknown_lists_require_review(self):
        for rows in [[row(), row()], [row(list_id='003')], []]:
            with self.assertRaises(ValueError):
                transform_catalog(rows, self.policy)

    def test_inactive_product_is_preserved(self):
        item = row()
        item['ESTADO_LITERAL'] = 'INACTIVO'
        products = transform_catalog([item], self.policy)
        self.assertEqual(len(products), 1)
        self.assertFalse(products[0]['activo'])


if __name__ == '__main__':
    unittest.main()
