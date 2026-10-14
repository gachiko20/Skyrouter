import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

const formateadorFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

/** 'YYYY-MM-DD' -> Date en hora LOCAL (no `new Date(str)`, que lo interpreta como UTC). */
function deIsoLocal(iso) {
  if (!iso) return undefined;
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Date -> 'YYYY-MM-DD' en hora LOCAL. */
function aIsoLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Día con vuelos: fondo verde suave, número en negrita y un punto debajo.
// Se aplica a la celda (`td`) y se propaga al botón interno con `[&>button]`.
const CLASES_DIA_CON_VUELOS =
  'relative [&>button]:bg-emerald-50 [&>button]:font-bold [&>button]:text-emerald-700 ' +
  'after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 ' +
  'after:-translate-x-1/2 after:rounded-full after:bg-emerald-500';

/**
 * Selector de fecha con calendario desplegable (`react-day-picker`) que
 * resalta los días que tienen vuelos (`fechasConVuelos`, 'YYYY-MM-DD').
 * Reemplaza al `<input type="date">` nativo, que no permite marcar días.
 *
 * Controlado: recibe `value` ('YYYY-MM-DD' o '') y notifica `onChange` con
 * el mismo formato. Los días pasados quedan deshabilitados; los días sin
 * vuelos siguen siendo seleccionables (la búsqueda dirá que no hay vuelos),
 * el resaltado es una guía, no una restricción.
 */
function CalendarioVuelos({
  id,
  value,
  onChange,
  fechasConVuelos = [],
  cargando = false,
  rutaCompleta = false,
  alinear = 'izquierda',
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  const hoy = useMemo(() => {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }, []);

  const diasConVuelos = useMemo(() => fechasConVuelos.map(deIsoLocal), [fechasConVuelos]);
  const seleccionada = deIsoLocal(value);

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return undefined;

    function manejarClickFuera(evento) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target)) {
        setAbierto(false);
      }
    }
    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.stopPropagation(); // no cerrar también el modal que lo contenga
        setAbierto(false);
      }
    }

    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarTecla, true);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarTecla, true);
    };
  }, [abierto]);

  function manejarSeleccion(fecha) {
    if (!fecha) return; // clic sobre el día ya seleccionado: se conserva
    onChange(aIsoLocal(fecha));
    setAbierto(false);
  }

  // Mes inicial: el de la fecha elegida, o el primer día con vuelos, o hoy.
  const mesInicial = seleccionada || diasConVuelos.find((dia) => dia >= hoy) || hoy;

  let ayuda = null;
  if (cargando) ayuda = 'Consultando disponibilidad...';
  else if (!rutaCompleta) ayuda = 'Ingresa origen y destino para ver los días con vuelos.';
  else if (diasConVuelos.length === 0) ayuda = 'No hay vuelos próximos para esta ruta.';

  return (
    <div ref={contenedorRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setAbierto((previo) => !previo)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        <span className={seleccionada ? 'text-slate-800' : 'text-slate-400'}>
          {seleccionada ? formateadorFecha.format(seleccionada) : 'Selecciona una fecha'}
        </span>
        {cargando ? (
          <svg className="h-4 w-4 animate-spin text-sky-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Calendario de vuelos"
          className={`absolute top-full z-30 mt-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200 ${
            alinear === 'derecha' ? 'right-0' : 'left-0'
          }`}
          style={{
            // Variables de react-day-picker alineadas con el acento sky-600 del proyecto.
            '--rdp-accent-color': '#0284c7',
            '--rdp-accent-background-color': '#e0f2fe',
            '--rdp-day-height': '2.5rem',
            '--rdp-day-width': '2.5rem',
            '--rdp-day_button-height': '2.25rem',
            '--rdp-day_button-width': '2.25rem',
          }}
        >
          <DayPicker
            mode="single"
            locale={es}
            selected={seleccionada}
            onSelect={manejarSeleccion}
            defaultMonth={mesInicial}
            startMonth={hoy}
            disabled={{ before: hoy }}
            modifiers={{ conVuelos: diasConVuelos }}
            modifiersClassNames={{ conVuelos: CLASES_DIA_CON_VUELOS }}
            className="text-sm text-slate-700"
          />

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Días con vuelos
            </span>
            {ayuda && <span className="text-right text-slate-400">{ayuda}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarioVuelos;
