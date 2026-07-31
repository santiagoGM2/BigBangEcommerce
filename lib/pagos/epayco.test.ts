import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeEpaycoSignature,
  mapEpaycoStateToOrderState,
} from "./epayco";

describe("computeEpaycoSignature", () => {
  // ---------------------------------------------------------------------------
  // Vector fijo. Los seis inputs y el hash esperado se escriben como literales,
  // calculados FUERA de la funcion bajo prueba (con el comando node one-liner
  // documentado abajo). El proposito de este test es que si alguien cambia
  // el algoritmo (sha256 -> md5, sha256 -> sha512), el orden o el separador,
  // el hash literal deja de coincidir y el test falla.
  //
  // Reproducir el hash desde una terminal (fuera de esta funcion):
  //
  //   node -e "console.log(require('crypto').createHash('sha256')
  //     .update('509884^af2405f5c17f0c94b0d5a2b06ffcedaef6a13c9c^162232^25000018^1000.00^COP','utf8')
  //     .digest('hex'))"
  //   -> bed16c2effa0d8940262668cb86789f3c72b1ef767778dd006a1371980fc6825
  // ---------------------------------------------------------------------------
  const VECTOR = {
    custId: "509884",
    privateKey: "af2405f5c17f0c94b0d5a2b06ffcedaef6a13c9c",
    refPayco: "162232",
    transactionId: "25000018",
    amount: "1000.00",
    currencyCode: "COP",
  } as const;
  const EXPECTED_SHA256 =
    "bed16c2effa0d8940262668cb86789f3c72b1ef767778dd006a1371980fc6825";

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
    // MD5 del mismo raw. Si esto llegara a coincidir con la salida de la
    // funcion, es que alguien volvio a MD5. Literal, calculado externamente:
    //
    //   node -e "console.log(require('crypto').createHash('md5')
    //     .update('509884^af2405f5c17f0c94b0d5a2b06ffcedaef6a13c9c^162232^25000018^1000.00^COP','utf8')
    //     .digest('hex'))"
    //   -> 49998164026d23bb9da819db3d524085
    const MD5_HASH = "49998164026d23bb9da819db3d524085";
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
});
