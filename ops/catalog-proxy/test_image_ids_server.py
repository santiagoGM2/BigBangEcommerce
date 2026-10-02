import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from image_ids_server import make_handler


class ImageIdsServerTests(unittest.TestCase):
    def request(self, loader, key='correct-key', path='/producto-ids'):
        server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler({'apiKey': 'correct-key'}, loader))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            try:
                with urlopen(Request(f'http://127.0.0.1:{server.server_port}{path}',
                    headers={'x-api-key': key}), timeout=3) as response:
                    return response.status, json.load(response)
            except HTTPError as error:
                return error.code, json.load(error)
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def test_unauthorized_does_not_query(self):
        def forbidden(_):
            self.fail('Unauthorized request queried ERP')
        self.assertEqual(self.request(forbidden, key='wrong')[0], 401)

    def test_read_does_not_require_price_policy(self):
        payload = {'ids': ['000480'], 'count': 1, 'complete': True}
        self.assertEqual(self.request(lambda _: payload), (200, payload))

    def test_erp_failure_never_returns_stale_ids_or_error_details(self):
        def failure(_):
            raise ValueError('sensitive details')
        self.assertEqual(self.request(failure), (503, {'error': 'catalog_unavailable'}))

    def test_products_fail_closed_until_policy_confirmed(self):
        self.assertEqual(self.request(lambda _: {}, path='/productos'),
            (503, {'error': 'price_policy_pending'}))


if __name__ == '__main__':
    unittest.main()
