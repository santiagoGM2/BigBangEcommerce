import {
  IconChat,
  IconDollar,
  IconHeart,
  IconShield,
  IconStar,
  IconTruck,
} from "./icons";

interface PorQueElegirnosProps {
  totalProductos: number;
}

export function PorQueElegirnos({ totalProductos }: PorQueElegirnosProps) {
  // Mismo redondeo que en el hero, por coherencia visual.
  const magnitud = Math.max(500, Math.floor(totalProductos / 1000) * 1000);

  return (
    <div className="bb-why-root" id="por-que">
      <div className="bb-why-inner">
        <div className="bb-why-header">
          <div>
            <div className="bb-why-label">¿Por qué Big Bang?</div>
            <h2 className="bb-why-title">
              No somos una tienda más.
              <br />
              Somos tu aliado para <span>celebrar</span>
            </h2>
          </div>
          <div>
            <p className="bb-why-right-text">
              Llevamos años haciendo que las fiestas de las familias caleñas
              sean inolvidables. Cada producto que vendemos está pensado para
              que tú solo te preocupes por disfrutar.
            </p>
          </div>
        </div>

        <div className="bb-why-grid">
          <div
            className="bb-why-card"
            style={
              {
                ["--card-color" as string]: "#E91E8C",
                ["--card-bg" as string]: "rgba(233,30,140,0.07)",
              } as React.CSSProperties
            }
          >
            <div className="bb-why-num">01</div>
            <div className="bb-why-icon">
              <IconHeart width={24} height={24} stroke="#E91E8C" strokeWidth="2.2" />
            </div>
            <div className="bb-why-card-title">Variedad que sorprende</div>
            <p className="bb-why-card-text">
              Miles de productos en juguetes, piñatería, peluches y decoración.
              Siempre encontrarás lo que buscas — y lo que no sabías que
              necesitabas.
            </p>
          </div>

          <div
            className="bb-why-card"
            style={
              {
                ["--card-color" as string]: "#7DC720",
                ["--card-bg" as string]: "rgba(125,199,32,0.08)",
              } as React.CSSProperties
            }
          >
            <div className="bb-why-num">02</div>
            <div className="bb-why-icon">
              <IconDollar width={24} height={24} stroke="#7DC720" strokeWidth="2.2" />
            </div>
            <div className="bb-why-card-title">Precios para todos los bolsillos</div>
            <p className="bb-why-card-text">
              Vendemos al detal y al por mayor. Si buscas surtir tu negocio o
              comprar para una sola fiesta, tenemos el precio que te conviene.
            </p>
          </div>

          <div
            className="bb-why-card"
            style={
              {
                ["--card-color" as string]: "#3D1A6E",
                ["--card-bg" as string]: "rgba(61,26,110,0.07)",
              } as React.CSSProperties
            }
          >
            <div className="bb-why-num">03</div>
            <div className="bb-why-icon">
              <IconTruck width={24} height={24} stroke="#3D1A6E" strokeWidth="2.2" />
            </div>
            <div className="bb-why-card-title">Envíos a toda Colombia</div>
            <p className="bb-why-card-text">
              Despachamos a cualquier ciudad del país de forma rápida y segura.
              En Cali también hacemos entregas programadas sin costo adicional.
            </p>
          </div>

          <div
            className="bb-why-card"
            style={
              {
                ["--card-color" as string]: "#E91E8C",
                ["--card-bg" as string]: "rgba(233,30,140,0.07)",
              } as React.CSSProperties
            }
          >
            <div className="bb-why-num">04</div>
            <div className="bb-why-icon">
              <IconShield width={24} height={24} stroke="#E91E8C" strokeWidth="2.2" />
            </div>
            <div className="bb-why-card-title">Compra 100% segura</div>
            {/* Reemplazo intencional: el fragmento decia "Pagos protegidos con
                PayU". La pasarela real elegida es ePayco (cuenta pendiente).
                Copy neutro mientras se activa. */}
            <p className="bb-why-card-text">
              Pago seguro en línea con la mejor tecnología de pasarelas. Aceptamos
              tarjetas débito, crédito, PSE y efectivo. Tu dinero y tus datos
              siempre están protegidos.
            </p>
          </div>

          <div
            className="bb-why-card"
            style={
              {
                ["--card-color" as string]: "#7DC720",
                ["--card-bg" as string]: "rgba(125,199,32,0.08)",
              } as React.CSSProperties
            }
          >
            <div className="bb-why-num">05</div>
            <div className="bb-why-icon">
              <IconChat width={24} height={24} stroke="#7DC720" strokeWidth="2.2" />
            </div>
            <div className="bb-why-card-title">Atención que de verdad ayuda</div>
            <p className="bb-why-card-text">
              Nuestro equipo responde por WhatsApp de lunes a sábado. Sin bots,
              sin esperas eternas. Una persona real que te orienta y resuelve.
            </p>
          </div>

          <div
            className="bb-why-card"
            style={
              {
                ["--card-color" as string]: "#3D1A6E",
                ["--card-bg" as string]: "rgba(61,26,110,0.07)",
              } as React.CSSProperties
            }
          >
            <div className="bb-why-num">06</div>
            <div className="bb-why-icon">
              <IconStar width={24} height={24} stroke="#3D1A6E" strokeWidth="2.2" fill="none" />
            </div>
            <div className="bb-why-card-title">Siempre hay algo nuevo</div>
            <p className="bb-why-card-text">
              Renovamos nuestro catálogo constantemente con las últimas
              tendencias en juguetes y decoración. Cada visita trae una sorpresa
              nueva.
            </p>
          </div>
        </div>

        <div className="bb-why-stats">
          <div className="bb-why-stat">
            <div className="bb-why-stat-num">
              +<span>{magnitud.toLocaleString("es-CO")}</span>
            </div>
            <div className="bb-why-stat-label">Productos</div>
          </div>
          <div className="bb-why-stat">
            <div className="bb-why-stat-num">
              <span>4.5</span>★
            </div>
            <div className="bb-why-stat-label">Calificación Google</div>
          </div>
          {/* TODO(cliente): confirmar antiguedad real (aca dice "+10 años"). */}
          <div className="bb-why-stat">
            <div className="bb-why-stat-num">
              +<span>10</span>
            </div>
            <div className="bb-why-stat-label">Años en el mercado</div>
          </div>
          <div className="bb-why-stat">
            <div className="bb-why-stat-num">
              <span>100</span>%
            </div>
            <div className="bb-why-stat-label">Pago seguro</div>
          </div>
        </div>
      </div>
    </div>
  );
}
