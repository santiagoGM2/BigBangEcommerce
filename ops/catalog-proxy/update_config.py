"""Actualiza credenciales sin perder politica de precios ni configuracion futura."""
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile


PATCH_FIELDS = frozenset({
    'host', 'port', 'user', 'password', 'database', 'view', 'allowPlaintext', 'apiKey',
})
MAX_BYTES = 64 * 1024


def validate_config(config):
    if not isinstance(config, dict):
        raise ValueError('La configuracion debe ser un objeto')
    for key in ['host', 'user', 'password', 'database', 'view', 'apiKey']:
        if not isinstance(config.get(key), str) or not config[key].strip():
            raise ValueError('Falta un campo obligatorio de configuracion')
    if len(config['apiKey']) < 24:
        raise ValueError('La API key debe tener al menos 24 caracteres')
    port = config.get('port')
    if isinstance(port, bool) or not re.fullmatch(r'[0-9]+', str(port)) or not 1 <= int(port) <= 65535:
        raise ValueError('Puerto fuera de rango')
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', config['view']):
        raise ValueError('Identificador de vista invalido')
    if config.get('allowPlaintext') is not True:
        raise ValueError('Falta la politica explicita de conexion al ERP')
    if 'pricePolicy' in config:
        policy = config['pricePolicy']
        if not isinstance(policy, dict) or set(policy) != {'public_list', 'fallback_list', 'includes_taxes'}:
            raise ValueError('Politica de precios invalida')
        public, fallback = policy.get('public_list'), policy.get('fallback_list')
        if not all(isinstance(value, str) and re.fullmatch(r'[0-9]{3}', value)
                   for value in [public, fallback]):
            raise ValueError('Listas de precio invalidas')
        if public == fallback or policy.get('includes_taxes') is not True:
            raise ValueError('Politica de precios invalida')


def read_config(path):
    if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode):
        raise ValueError('La configuracion debe ser un archivo regular')
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('Configuracion demasiado grande')
    original = path.read_bytes()
    config = json.loads(original)
    if not isinstance(config, dict):
        raise ValueError('La configuracion existente no es un objeto')
    return config, original


def atomic_write(path, content, mode, owner):
    # El temporal vive en el mismo filesystem: os.replace es atomico.
    descriptor, temporary = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            if owner is not None:
                os.chown(temporary, *owner)
            os.chmod(temporary, mode)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        if hasattr(os, 'O_DIRECTORY'):
            directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def update_config(path, patch, owner=None):
    path = Path(path)
    if not isinstance(patch, dict) or set(patch) != PATCH_FIELDS:
        raise ValueError('Campos inesperados o incompletos en la actualizacion')
    validate_config(patch)
    if path.parent.is_symlink() or not path.parent.is_dir():
        raise ValueError('Directorio de configuracion invalido')
    backup = path.with_name(f'{path.name}.backup')
    if path.is_symlink() or backup.is_symlink():
        raise ValueError('No se admiten enlaces simbolicos')
    lock = path.with_name(f'.{path.name}.lock')
    # Un cierre abrupto conserva el lock: requiere revision, no sobrescritura.
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.close(descriptor)
        current, original = read_config(path) if path.exists() else ({}, None)
        merged = {**current, **patch}
        validate_config(merged)
        if original is not None and merged == current:
            if owner is not None:
                os.chown(path, *owner)
                os.chmod(path, 0o640)
                if backup.exists():
                    os.chown(backup, *owner)
                    os.chmod(backup, 0o600)
            return False
        content = (json.dumps(merged, ensure_ascii=False, indent=2) + '\n').encode('utf8')
        if len(content) > MAX_BYTES:
            raise ValueError('Configuracion demasiado grande')
        # Si falla la copia, la configuracion activa no se toca.
        if original is not None:
            atomic_write(backup, original, 0o600, owner)
        atomic_write(path, content, 0o640, owner)
        return True
    finally:
        lock.unlink()


def main():
    # Solo se ejecuta remotamente con sudo; nunca imprime valores privados.
    import grp
    if os.geteuid() != 0:
        raise PermissionError('Se requiere administracion del servidor')
    payload = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(payload) > MAX_BYTES:
        raise ValueError('Entrada demasiado grande')
    patch = json.loads(payload)
    directory = Path('/etc/bigbang')
    if directory.is_symlink():
        raise ValueError('Directorio de configuracion invalido')
    directory.mkdir(mode=0o750, exist_ok=True)
    owner = (0, grp.getgrnam('bigbang').gr_gid)
    os.chown(directory, *owner)
    os.chmod(directory, 0o750)
    changed = update_config(directory / 'catalog-config.json', patch, owner)
    print('Configuracion actualizada con copia privada.' if changed else 'Configuracion sin cambios.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Un error JSON podria contener valores privados: nunca se imprime.
        print('No se pudo confirmar la actualizacion. Revise permisos, formato y bloqueo.', file=sys.stderr)
        sys.exit(1)
