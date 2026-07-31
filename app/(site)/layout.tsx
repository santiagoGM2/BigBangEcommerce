import "@/components/landing/landing.css";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

// Layout compartido por todas las paginas publicas: landing, catalogo,
// producto. Aporta navbar y footer para que las paginas hijas solo se
// preocupen de su contenido central. Rutas fuera del grupo (site) —como
// /debug o el futuro (checkout)— NO reciben este layout.

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
