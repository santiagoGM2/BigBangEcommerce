import { getConteoPorFamilia, getProductos } from "@/lib/catalogo";
import { Categorias } from "@/components/landing/Categorias";
import { CtaMayorista } from "@/components/landing/CtaMayorista";
import { Encuentranos } from "@/components/landing/Encuentranos";
import { Hero } from "@/components/landing/Hero";
import { PorQueElegirnos } from "@/components/landing/PorQueElegirnos";
import { Testimonios } from "@/components/landing/Testimonios";

// Landing real de Big Bang. Todo lo dinamico (conteo total y conteo por
// familia) sale del catalogo en vivo y se cachea segun la politica de
// lib/catalogo (SWR, 6h). Navbar y Footer vienen del layout del grupo (site).
// La pagina de diagnostico Fase 1 vive ahora en /debug (no indexable).

export default async function Home() {
  const [productos, conteo] = await Promise.all([
    getProductos(),
    getConteoPorFamilia(),
  ]);

  return (
    <>
      <Hero totalProductos={productos.length} />
      <Categorias conteo={conteo} />
      <CtaMayorista />
      <PorQueElegirnos totalProductos={productos.length} />
      <Testimonios />
      <Encuentranos />
    </>
  );
}
