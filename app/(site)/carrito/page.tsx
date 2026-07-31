import type { Metadata } from "next";
import { CarritoCliente } from "@/components/carrito/CarritoCliente";

// El carrito vive completamente en el cliente (localStorage). La resolucion
// contra el catalogo real se hace via server action; aca solo servimos la
// metadata y el componente client.

export const metadata: Metadata = {
  title: "Tu carrito",
  robots: { index: false, follow: false },
};

export default function CarritoPage() {
  return <CarritoCliente />;
}
