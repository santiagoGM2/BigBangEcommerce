/**
 * Datos reales del negocio. Fuente unica para footer, mapa, JSON-LD y metadata.
 * No duplicar en componentes: importar desde aca.
 */

export const SITE = {
  nombre: "Piñatas y Regalos Big Bang",
  nombreCorto: "Tiendas Big Bang",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://tiendasbigbang.com",
  direccion: {
    calle: "Cl. 9 #30-44",
    barrio: "La Alameda",
    ciudad: "Cali",
    departamento: "Valle del Cauca",
    pais: "Colombia",
    codigoPais: "CO",
  },
  telefono: "+57 321 558 1600",
  whatsapp: "https://api.whatsapp.com/send?phone=573215581600",
  redes: {
    instagram: "https://www.instagram.com/tiendas_big_bang/",
    facebook: "https://www.facebook.com/TiendasBigBang/",
    tiktok: "https://www.tiktok.com/@tiendasbigbang",
  },
  // Horario verificado en la ficha oficial de Google del negocio.
  horario: {
    lunSab: "8:30 am – 6:30 pm",
    dom: "9:00 am – 6:30 pm",
  },
} as const;
