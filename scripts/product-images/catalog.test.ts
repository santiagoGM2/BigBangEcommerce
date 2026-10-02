import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPhotoCatalogIds } from "./catalog";

test("IDs independientes de precios: exige respuesta completa, reciente y sin duplicados", async () => {
  const priorBase = process.env.CATALOGO_API_BASE;
  const priorKey = process.env.CATALOGO_API_KEY;
  process.env.CATALOGO_API_BASE = "https://example.test";
  process.env.CATALOGO_API_KEY = "test-key";
  const valid = { ids: ["000480"], count: 1, complete: true, queried_at: new Date().toISOString() };
  const fetcher = (payload: unknown, status = 200): typeof fetch => async (url, init) => {
    assert.equal(String(url), "https://example.test/producto-ids");
    assert.equal((init?.headers as Record<string, string>)["x-api-key"], "test-key");
    return Response.json(payload, { status });
  };
  try {
    assert.deepEqual([...await fetchPhotoCatalogIds(fetcher(valid))], ["000480"]);
    for (const payload of [
      { ...valid, complete: false }, { ...valid, count: 2 },
      { ...valid, ids: [480] }, { ...valid, ids: [] , count: 0 },
      { ...valid, ids: ["000480", "000480"], count: 2 },
      { ...valid, queried_at: "2020-01-01T00:00:00Z" },
    ]) await assert.rejects(fetchPhotoCatalogIds(fetcher(payload)));
    await assert.rejects(fetchPhotoCatalogIds(fetcher({}, 503)));
    process.env.CATALOGO_API_BASE = "http://example.test";
    await assert.rejects(fetchPhotoCatalogIds(fetcher(valid)));
  } finally {
    if (priorBase === undefined) delete process.env.CATALOGO_API_BASE;
    else process.env.CATALOGO_API_BASE = priorBase;
    if (priorKey === undefined) delete process.env.CATALOGO_API_KEY;
    else process.env.CATALOGO_API_KEY = priorKey;
  }
});
