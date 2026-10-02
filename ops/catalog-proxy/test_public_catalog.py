import gzip
import json
import unittest
from public_catalog import CatalogCache


class CacheTests(unittest.TestCase):
    def test_failed_refresh_keeps_previous_complete_catalog(self):
        calls = []
        def load(_):
            calls.append(1)
            if len(calls) > 1:
                raise RuntimeError('ERP offline')
            return [{'id_item': '000002'}]
        cache = CatalogCache({}, load)
        self.assertTrue(cache.refresh())
        previous = cache.snapshot
        self.assertFalse(cache.refresh())
        self.assertIs(cache.snapshot, previous)
        self.assertTrue(cache.status()['last_refresh_failed'])
        self.assertEqual(json.loads(gzip.decompress(previous[1])), [{'id_item': '000002'}])

    def test_concurrent_refresh_does_not_query_twice(self):
        cache = CatalogCache({}, lambda _: self.fail('Unexpected concurrent ERP query'))
        with cache.lock:
            self.assertFalse(cache.refresh())

    def test_empty_initial_catalog_is_unavailable(self):
        cache = CatalogCache({}, lambda _: [])
        self.assertFalse(cache.refresh())
        self.assertFalse(cache.status()['ready'])
