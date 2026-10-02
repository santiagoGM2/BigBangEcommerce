"""Comprueba la respuesta inicial de MariaDB sin enviar credenciales."""

import socket
import sys


def main() -> None:
    host, port_text = sys.argv[1:3]
    with socket.create_connection((host, int(port_text)), timeout=8) as connection:
        packet = connection.recv(512)

    if len(packet) < 5:
        raise RuntimeError("MariaDB no devolvió un paquete completo")

    payload = packet[4:]
    if payload[0] == 0xFF:
        code = int.from_bytes(payload[1:3], "little")
        message = payload[3:].decode("utf-8", errors="replace")
        print(f"MariaDB error {code}: {message}")
        return

    version_end = payload.find(b"\x00", 1)
    if version_end < 0 or len(payload) < version_end + 16:
        raise RuntimeError("MariaDB devolvió un saludo incompleto")
    version = payload[1:version_end].decode("ascii", errors="replace")
    # El bit CLIENT_SSL (0x0800) indica si el servidor acepta negociar TLS.
    capability_offset = version_end + 1 + 4 + 8 + 1
    capabilities = int.from_bytes(payload[capability_offset:capability_offset + 2], "little")
    print(f"MariaDB respondió con handshake: {version}")
    print(f"MariaDB anuncia TLS: {'sí' if capabilities & 0x0800 else 'no'}")


if __name__ == "__main__":
    main()
