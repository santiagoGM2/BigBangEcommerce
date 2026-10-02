"""Contrato de nueve campos basado en la vista inspeccionada del ERP."""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import re
import logging


@dataclass(frozen=True)
class PricePolicy:
    public_list: str
    fallback_list: str
    includes_taxes: bool

    def validate(self):
        if not all(re.fullmatch(r'\d{3}', value) for value in [self.public_list, self.fallback_list]):
            raise ValueError('Price list identifiers must be three-character strings')
        if self.public_list == self.fallback_list:
            raise ValueError('Public and fallback lists must differ')
        # No se inventa una formula de IVA/consumo si el ERP entrega valores netos.
        if self.includes_taxes is not True:
            raise ValueError('Final tax-inclusive price rule requires confirmation')


def text(row, name, allow_empty=False):
    value = row.get(name)
    if value is None and allow_empty:
        return ''
    if not isinstance(value, str):
        raise ValueError(f'Expected string field: {name}')
    value = value.strip()
    if not value and not allow_empty:
        raise ValueError(f'Empty required field: {name}')
    return value


def price(row):
    # Oscar confirmo PRECIO_MIN_1; PRECIO_SUG_1/2 no se usan actualmente.
    value = row.get('PRECIO_MIN_1')
    if value is None or isinstance(value, (bool, float)):
        raise ValueError('Invalid PRECIO_MIN_1')
    try:
        amount = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError('Invalid PRECIO_MIN_1') from None
    if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value():
        raise ValueError('Price must be a positive integer COP amount')
    if amount > 9007199254740991:
        raise ValueError('Price exceeds JavaScript safe integer range')
    return int(amount)


def transform_catalog(rows, policy):
    if not isinstance(policy, PricePolicy):
        raise ValueError('Explicit confirmed price policy is required')
    policy.validate()
    if not rows:
        raise ValueError('Empty ERP catalog')
    groups = {}
    for row in rows:
        product_id = text(row, 'ID_ITEM')
        if not re.fullmatch(r'\d+', product_id):
            raise ValueError('Invalid ID_ITEM')
        list_id = text(row, 'ID_LIPRE1')
        if list_id not in [policy.public_list, policy.fallback_list]:
            raise ValueError(f'Unconfigured price list: {list_id}')
        group = groups.setdefault(product_id, {})
        if list_id in group:
            # La captura real no tiene duplicados por ID/lista. Si cambia el
            # contrato, se revisa vigencia en vez de elegir una fila al azar.
            raise ValueError('Duplicate product/price list: review validity rule')
        group[list_id] = row

    result = []
    for product_id, group in sorted(groups.items()):
        is_public = policy.public_list in group
        row = group[policy.public_list if is_public else policy.fallback_list]
        if not text(row, 'DESCRIPCION', allow_empty=True):
            logging.warning('Catalog omitted product %s: empty description', product_id)
            continue
        state = text(row, 'ESTADO_LITERAL')
        if state not in ['ACTIVO', 'INACTIVO']:
            raise ValueError('Unrecognized ERP state')
        result.append({
            'id_item': product_id,
            'referencia': text(row, 'ID_REFERENCIA', allow_empty=True),
            'descripcion': text(row, 'DESCRIPCION'),
            'categoria': text(row, 'DESCRIPCION_LINEA2'),
            'codigo_barra': text(row, 'COD_BARRA_PRINCIPAL', allow_empty=True),
            'precio': price(row),
            'precio_fuente': 'publica' if is_public else 'respaldo_mayorista',
            'existencias': None,
            'activo': state == 'ACTIVO',
        })
    return result
