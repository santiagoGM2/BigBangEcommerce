/**
 * Metadata comercial de las 14 familias: nombre visible, orden y copies SEO.
 * Editado a mano y ya verificado contra los limites de Google
 * (title <60 chars, description entre 107 y 134). No reescribir sin razon.
 *
 * El mapa `categoria del ERP -> familia` vive en `familias.ts` y se genera
 * automaticamente desde `_data/categorias-erp.csv` corriendo `pnpm gen:familias`.
 */

export type FamiliaSlug =
  | "juguetes"
  | "decoracion-fiestas"
  | "disfraces-y-halloween"
  | "dulceria-y-snacks"
  | "regalos-y-detalles"
  | "pinateria"
  | "peluches"
  | "escolar"
  | "cosmeticos-y-cuidado-personal"
  | "navidad"
  | "moda-y-accesorios"
  | "hogar-y-variedades"
  | "tecnologia-y-electronica"
  | "bebes";

export interface FamiliaMeta {
  slug: FamiliaSlug;
  nombre: string;
  orden: number;
  seo: {
    title: string;
    description: string;
  };
}

// Orden por cantidad de productos, descendente. Se usa para el indice.
export const FAMILIAS: readonly FamiliaMeta[] = [
  {
    slug: "juguetes",
    nombre: "Juguetes",
    orden: 1,
    seo: {
      title: "Juguetes en Cali | Big Bang",
      description:
        "Muñecos, carros de juguete, juegos didácticos, juegos de mesa, instrumentos musicales, balones, patinetas y triciclos en Cali.",
    },
  },
  {
    slug: "decoracion-fiestas",
    nombre: "Decoración para fiestas",
    orden: 2,
    seo: {
      title: "Artículos para fiestas y decoración en Cali | Big Bang",
      description:
        "Festonería, mantelería, velas de cumpleaños, cristalería, desechables decorados, inflables y todo para decorar tu fiesta en Cali.",
    },
  },
  {
    slug: "disfraces-y-halloween",
    nombre: "Disfraces y Halloween",
    orden: 3,
    seo: {
      title: "Disfraces y accesorios de Halloween en Cali | Big Bang",
      description:
        "Disfraces, máscaras, pelucas, sombreros, maquillaje y accesorios de Halloween para toda ocasión y fiesta temática en Cali.",
    },
  },
  {
    slug: "dulceria-y-snacks",
    nombre: "Dulcería y snacks",
    orden: 4,
    seo: {
      title: "Dulces, chocolates y snacks en Cali | Big Bang",
      description:
        "Chocolates, galletas, dulces ácidos, bombones, papas, mecato, gaseosas y jugos para tu fiesta o piñata en Cali.",
    },
  },
  {
    slug: "regalos-y-detalles",
    nombre: "Regalos y detalles",
    orden: 5,
    seo: {
      title: "Cajas de regalo, tarjetería y detalles en Cali | Big Bang",
      description:
        "Cajas de regalo, bolsas metalizadas, papel de regalo, cintas decorativas, tarjetas de invitación y detalles para toda ocasión en Cali.",
    },
  },
  {
    slug: "pinateria",
    nombre: "Piñatería",
    orden: 6,
    seo: {
      title: "Piñatería en Cali | Big Bang",
      description:
        "Globos, pinturas para globos, piñatas en papel e icopor, moldes y bases decorativas para armar la piñata perfecta en Cali.",
    },
  },
  {
    slug: "peluches",
    nombre: "Peluches",
    orden: 7,
    seo: {
      title: "Peluches en Cali | Big Bang",
      description:
        "Peluches de todos los tamaños y personajes, ideales para regalar, sorprender o premiar en tu fiesta, en Cali.",
    },
  },
  {
    slug: "escolar",
    nombre: "Escolar",
    orden: 8,
    seo: {
      title: "Útiles escolares en Cali | Big Bang",
      description:
        "Colores, marcadores, cuadernos, libretas, cartucheras, morrales, estuches, tijeras y todos los útiles escolares en Cali.",
    },
  },
  {
    slug: "cosmeticos-y-cuidado-personal",
    nombre: "Cosméticos y belleza",
    orden: 9,
    seo: {
      title: "Cosméticos y belleza en Cali | Big Bang",
      description:
        "Maquillaje, cosméticos y productos de aseo y cuidado personal, ideales para regalar o para consentirte, en Cali.",
    },
  },
  {
    slug: "navidad",
    nombre: "Navidad",
    orden: 10,
    seo: {
      title: "Adornos y luces de Navidad en Cali | Big Bang",
      description:
        "Adornos navideños, luces de Navidad, accesorios de pesebre, árboles y todo para decorar esta Navidad en Cali.",
    },
  },
  {
    slug: "moda-y-accesorios",
    nombre: "Moda y accesorios",
    orden: 11,
    seo: {
      title: "Bolsos, relojes y accesorios de moda en Cali | Big Bang",
      description:
        "Bolsos, billeteras, carteras, relojes, gorras, bisutería, llaveros y accesorios de moda para tu estilo en Cali.",
    },
  },
  {
    slug: "hogar-y-variedades",
    nombre: "Hogar y variedades",
    orden: 12,
    seo: {
      title: "Hogar y variedades en Cali | Big Bang",
      description:
        "Lámparas, termos, cantimploras, herramientas, accesorios para mascotas, sombrillas y variedades para el hogar en Cali.",
    },
  },
  {
    slug: "tecnologia-y-electronica",
    nombre: "Tecnología y electrónica",
    orden: 13,
    seo: {
      title: "Tecnología y electrónica en Cali | Big Bang",
      description:
        "Parlantes, audífonos, teclados, walkie talkies y accesorios de sonido y tecnología para toda la familia en Cali.",
    },
  },
  {
    slug: "bebes",
    nombre: "Bebés",
    orden: 14,
    seo: {
      title: "Artículos para bebés en Cali | Big Bang",
      description:
        "Sonajeros, teteros, canguros, chupos, móviles para cuna y todo lo que necesita tu bebé, disponible en Cali.",
    },
  },
] as const;

export const FAMILIA_SLUGS: readonly FamiliaSlug[] = FAMILIAS.map((f) => f.slug);

export const FAMILIAS_BY_SLUG: Readonly<Record<FamiliaSlug, FamiliaMeta>> =
  Object.freeze(
    FAMILIAS.reduce((acc, f) => {
      acc[f.slug] = f;
      return acc;
    }, {} as Record<FamiliaSlug, FamiliaMeta>),
  );

export function isFamiliaSlug(value: string): value is FamiliaSlug {
  return (FAMILIA_SLUGS as readonly string[]).includes(value);
}
