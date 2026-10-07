"""Pruebas locales: nunca consultan ni modifican el servidor real."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from update_config import update_config


class UpdateConfigTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'catalog-config.json'
        self.patch = {
            'host': 'erp.example.invalid', 'port': '3306', 'user': 'test_reader',
            'password': 'test-password-not-a-real-credential', 'database': 'catalog_fixture',
            'view': 'test_view', 'apiKey': 'test-api-key-not-a-real-credential', 'allowPlaintext': True,
        }
        self.current = {
            **self.patch, 'password': 'old-test-password-not-a-real-credential',
            'pricePolicy': {'public_list': '001', 'fallback_list': '002', 'includes_taxes': True},
            'futureSetting': {'enabled': True},
        }
        self.original = json.dumps(self.current).encode()
        self.path.write_bytes(self.original)

    def test_preserves_price_policy_unknown_fields_and_exact_backup(self):
        self.assertTrue(update_config(self.path, self.patch))
        result = json.loads(self.path.read_bytes())
        self.assertEqual(result['password'], self.patch['password'])
        self.assertEqual(result['pricePolicy'], self.current['pricePolicy'])
        self.assertEqual(result['futureSetting'], self.current['futureSetting'])
        self.assertEqual(self.path.with_suffix('.json.backup').read_bytes(), self.original)

    def test_identical_retry_preserves_previous_backup_and_skips_writes(self):
        update_config(self.path, self.patch)
        with patch('update_config.atomic_write') as writer:
            self.assertFalse(update_config(self.path, self.patch))
        writer.assert_not_called()
        self.assertEqual(self.path.with_suffix('.json.backup').read_bytes(), self.original)

    def test_rejects_changes_to_price_policy(self):
        with self.assertRaises(ValueError):
            update_config(self.path, {**self.patch, 'pricePolicy': {}})
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_malformed_existing_config_remains_untouched(self):
        broken = b'{"password": "not-valid-json'
        self.path.write_bytes(broken)
        with self.assertRaises(ValueError):
            update_config(self.path, self.patch)
        self.assertEqual(self.path.read_bytes(), broken)

    def test_bad_patch_or_policy_is_rejected_before_replacement(self):
        for fields in [{'port': 65536}, {'port': True}, {'allowPlaintext': False}, {'view': 'bad;sql'}, {'apiKey': 'short'}]:
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                update_config(self.path, {**self.patch, **fields})
        self.current['pricePolicy']['includes_taxes'] = False
        self.path.write_text(json.dumps(self.current), encoding='utf8')
        with self.assertRaises(ValueError):
            update_config(self.path, self.patch)
        self.assertEqual(json.loads(self.path.read_bytes()), self.current)

    def test_failed_backup_keeps_current_config(self):
        with patch('update_config.atomic_write', side_effect=OSError('simulated disk failure')):
            with self.assertRaises(OSError):
                update_config(self.path, self.patch)
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_failed_atomic_replace_keeps_current_and_recoverable_backup(self):
        real_replace = os.replace

        def fail_current(source, destination):
            if Path(destination) == self.path:
                raise OSError('simulated replacement failure')
            return real_replace(source, destination)

        with patch('update_config.os.replace', side_effect=fail_current), self.assertRaises(OSError):
            update_config(self.path, self.patch)
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertEqual(self.path.with_suffix('.json.backup').read_bytes(), self.original)
        self.assertFalse(list(self.path.parent.glob('.catalog-config.json.*')))

    def test_active_or_stale_lock_blocks_update(self):
        lock = self.path.with_name('.catalog-config.json.lock')
        lock.write_text('locked', encoding='utf8')
        with self.assertRaises(FileExistsError):
            update_config(self.path, self.patch)
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertTrue(lock.exists())

    def test_new_config_supports_explicit_ids_only_bootstrap(self):
        self.path.unlink()
        self.assertTrue(update_config(self.path, self.patch))
        self.assertEqual(json.loads(self.path.read_bytes()), self.patch)
        self.assertFalse(self.path.with_suffix('.json.backup').exists())

    @unittest.skipUnless(os.name == 'posix', 'Permisos POSIX del servidor Linux')
    def test_config_and_backup_permissions(self):
        update_config(self.path, self.patch)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o640)
        self.assertEqual(self.path.with_suffix('.json.backup').stat().st_mode & 0o777, 0o600)

    @unittest.skipUnless(os.name == 'posix', 'Enlaces POSIX del servidor Linux')
    def test_symbolic_links_are_rejected(self):
        other = self.path.with_name('other.json')
        other.write_bytes(self.original)
        self.path.unlink()
        self.path.symlink_to(other)
        with self.assertRaises(ValueError):
            update_config(self.path, self.patch)
        self.assertEqual(other.read_bytes(), self.original)


if __name__ == '__main__':
    unittest.main()
