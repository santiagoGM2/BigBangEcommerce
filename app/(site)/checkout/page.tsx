import type { Metadata } from "next";
import { CheckoutCliente } from "@/components/carrito/CheckoutCliente";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutCliente />;
}
