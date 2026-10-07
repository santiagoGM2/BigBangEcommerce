import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeJsonLd } from "./serialize-json-ld";

test("preserva los datos del ERP sin permitir cerrar el script JSON-LD", () => {
  const data = { name: '</script><script>alert("prueba")</script>', sku: "000002", price: 4000 };
  const serialized = serializeJsonLd(data);
  assert.equal(serialized.includes("<"), false);
  assert.deepEqual(JSON.parse(serialized), data);
});
