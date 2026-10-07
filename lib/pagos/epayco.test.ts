import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeEpaycoSignature,
  mapEpaycoStateToOrderState,
} from "./epayco";

describe("computeEpaycoSignature", () => {
  // Vector sintetico: ninguna credencial corresponde a una cuenta real.
  // Hashes precalculados fuera de computeEpaycoSignature para detectar
  // cambios involuntarios de algoritmo, orden y separador.
  const VECTOR = {
    custId: "test-customer",
    privateKey: "synthetic-epayco-key-for-tests-only",
    refPayco: "test-reference",
    transactionId: "test-transaction",
    amount: "1000.00",
    currencyCode: "COP",
  } as const;
  const EXPECTED_SHA256 =
    "fca182a4eabf387fcaf12788f62b1a0acc6b70c5d4def7a3562bcf9781e268f8";

  it("hashea el vector fijo con SHA256 al valor esperado (literal)", () => {
    const got = computeEpaycoSignature(VECTOR);
    assert.equal(
      got,
      EXPECTED_SHA256,
      "El hash real difiere del literal esperado: es probable que se haya " +
        "cambiado el algoritmo (SHA256), el orden de campos o el separador '^'.",
    );
  });

  it("no coincide con el equivalente MD5 (proteccion contra regresion al bug historico)", () => {
    const MD5_HASH = "4d0785a6500d27906861f5d152f607d7";
    const got = computeEpaycoSignature(VECTOR);
    assert.notEqual(got, MD5_HASH, "La funcion regresiono a MD5.");
  });

  it("es sensible al orden: intercambiar campos produce un hash distinto", () => {
    // Si el orden cambiara (por ejemplo, privateKey antes que custId), el
    // hash saldria distinto. Este test blindaria el orden aun sin conocer
    // el hash "malo" a priori.
    const swapped = computeEpaycoSignature({
      ...VECTOR,
      custId: VECTOR.privateKey,
      privateKey: VECTOR.custId,
    });
    assert.notEqual(swapped, EXPECTED_SHA256);
  });

  it("es sensible al separador: cambiar un caracter del input cambia el hash", () => {
    // Cambiar un digito del amount deberia cambiar completamente el hash
    // (propiedad de avalancha). Verificamos que no colisiona accidentalmente.
    const distinto = computeEpaycoSignature({ ...VECTOR, amount: "1000.01" });
    assert.notEqual(distinto, EXPECTED_SHA256);
  });
});

describe("mapEpaycoStateToOrderState", () => {
  // Mapeo definitivo segun la doc de ePayco. Ver lib/pagos/epayco.ts.
  const casos: Array<[number, ReturnType<typeof mapEpaycoStateToOrderState>]> = [
    [1, "pagado"],
    [2, "rechazado"],
    [3, "pendiente"],
    [4, "fallido"],
    [6, "fallido"],
    [7, "pendiente"],
    [8, "pendiente"],
    [10, "fallido"],
    [11, "rechazado"],
    [12, "rechazado"],
    [99, null], // codigo desconocido
  ];
  for (const [code, expected] of casos) {
    it(`codigo ${code} -> ${expected}`, () => {
      assert.equal(mapEpaycoStateToOrderState(code), expected);
      // Acepta tambien string, como llega en el webhook.
      assert.equal(mapEpaycoStateToOrderState(String(code)), expected);
    });
  }

  it("ignora codigos malformados aunque comiencen por un numero valido", () => {
    for (const code of ["1junk", "1.5", "1e0", "", " 1"]) {
      assert.equal(mapEpaycoStateToOrderState(code), null);
    }
  });
});
