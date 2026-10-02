import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import mariadb from "mariadb";

// Diagnostico de solo lectura. Nunca imprime credenciales ni filas del ERP.
dotenv.config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en .env.local`);
  return value;
};

async function main(): Promise<void> {
  const host = required("ERP_DB_HOST");
  const user = required("ERP_DB_USER");
  const password = required("ERP_DB_PASSWORD");
  const database = required("ERP_DB_NAME");
  const view = required("ERP_DB_VIEW");
  const port = Number(required("ERP_DB_PORT"));

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("ERP_DB_PORT debe ser un puerto valido");
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(view)) {
    throw new Error("ERP_DB_VIEW debe ser un identificador SQL simple");
  }

  const caPath = process.env.ERP_DB_CA_PATH?.trim();
  const allowPlaintext = process.env.ERP_DB_ALLOW_PLAINTEXT === "true";
  const ssl = allowPlaintext ? false : caPath
    ? { ca: readFileSync(resolve(caPath), "utf8"), rejectUnauthorized: true }
    : { rejectUnauthorized: true };

  const connection = await mariadb.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl,
    connectTimeout: 5_000,
    socketTimeout: 15_000,
  });

  try {
    const cipher = (await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'")) as Array<{
      Value: string;
    }>;
    if (!allowPlaintext && !cipher[0]?.Value) throw new Error("MariaDB no confirmo una sesion TLS");

    const columns = (await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, view],
    )) as Array<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: string;
      ORDINAL_POSITION: number;
    }>;

    if (columns.length === 0) {
      throw new Error("La vista no existe o sus columnas no son visibles para esta cuenta");
    }

    // Prueba SELECT sin recuperar ni mostrar informacion de ningun producto.
    const rows = (await connection.query(`SELECT 1 AS ok FROM \`${view}\` LIMIT 1`)) as Array<{
      ok: number;
    }>;

    console.log(JSON.stringify({
      tls: cipher[0]?.Value ? "activo" : "sin cifrar (autorizado explicitamente)",
      view,
      selectAllowed: true,
      hasRows: rows.length > 0,
      columns: columns.map(({ COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION }) => ({
        name: COLUMN_NAME,
        type: COLUMN_TYPE,
        nullable: IS_NULLABLE === "YES",
        position: ORDINAL_POSITION,
      })),
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.message.startsWith("Falta ERP_DB_")) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "ERROR";
  // El texto del driver puede contener la direccion del servidor; no se imprime.
  console.error(`No se pudo verificar la vista MariaDB (${code}).`);
  process.exitCode = 1;
});
