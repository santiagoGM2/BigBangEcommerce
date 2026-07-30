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
  // TODO(cliente): confirmar horario real. Los fragmentos originales traen dos
  // versiones distintas (Lun-Sab 8am-6pm vs Lun-Sab 9am-7pm + Dom 10am-5pm).
  horario: null as string | null,
} as const;
