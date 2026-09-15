import { Fragment, useCallback, useMemo, useState } from 'react';
import Asiento from './Asiento.jsx';
import ToastAlerta from './ToastAlerta.jsx';
import { AsientoNoDisponibleError, bloquearAsiento } from '../../services/asientosApi.js';

const CANTIDAD_MINIMA_PARA_PASILLO = 4;

/** "12A" -> { fila: 12, columna: 'A' }. Asume el formato de `database/init.sql` (^[0-9]{1,3}[A-Z]$). */
function parsearCodigoAsiento(codigoAsiento) {
  const coincidencia = /^(\d{1,3})([A-Z])$/.exec(codigoAsiento);
  return coincidencia
    ? { fila: Number(coincidencia[1]), columna: coincidencia[2] }
    : { fila: 0, columna: codigoAsiento };
}

/** Agrupa y ordena los asientos por fila/columna para el layout de la cabina. */
function agruparPorFila(asientos) {
  const filas = new Map();

  asientos.forEach((asiento) => {
    const { fila } = parsearCodigoAsiento(asiento.codigoAsiento);
    if (!filas.has(fila)) filas.set(fila, []);
    filas.get(fila).push(asiento);
  });

  return [...filas.entries()]
    .sort(([filaA], [filaB]) => filaA - filaB)
    .map(([fila, asientosFila]) => [
      fila,
      [...asientosFila].sort((a, b) => a.codigoAsiento.localeCompare(b.codigoAsiento)),
    ]);
}

function Leyenda() {
  const items = [
    { estado: 'DISPONIBLE', etiqueta: 'Disponible', clase: 'bg-emerald-100 ring-emerald-300' },
    { estado: 'BLOQUEADO_TEMPORAL', etiqueta: 'Bloqueado temporalmente', clase: 'bg-amber-100 ring-amber-300' },
    { estado: 'OCUPADO', etiqueta: 'Ocupado', clase: 'bg-slate-200 ring-slate-300' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.estado} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ring-1 ${item.clase}`} aria-hidden="true" />
          {item.etiqueta}
        </span>
      ))}
    </div>
  );
}

/**
 * Plano interactivo de la cabina (HU-02, SCRUM-8). Renderiza la matriz de
 * asientos del avión y gestiona su propio estado local: al confirmar el
 * bloqueo (200 OK) marca el asiento como BLOQUEADO_TEMPORAL de inmediato;
 * si otro pasajero se adelantó (409 Conflict) lo marca como OCUPADO y
 * muestra una alerta, sin romper el renderizado del resto del plano.
 *
 * `asientosIniciales` es el mapa de asientos del vuelo (id, código, estado)
 * ya resuelto por el padre — este componente no hace fetch por sí mismo.
 */
function PlanoCabina({ vueloId, usuarioId, asientosIniciales }) {
  const [asientos, setAsientos] = useState(asientosIniciales);
  const [idAsientoEnCurso, setIdAsientoEnCurso] = useState(null);
  const [toast, setToast] = useState(null);

  const filas = useMemo(() => agruparPorFila(asientos), [asientos]);

  const actualizarEstadoAsiento = useCallback((idAsiento, nuevoEstado) => {
    setAsientos((actuales) =>
      actuales.map((asiento) => (asiento.idAsiento === idAsiento ? { ...asiento, estado: nuevoEstado } : asiento))
    );
  }, []);

  const manejarSeleccion = useCallback(
    async (asiento) => {
      setIdAsientoEnCurso(asiento.idAsiento);
      try {
        await bloquearAsiento({ vueloId, asientoId: asiento.idAsiento, usuarioId });
        actualizarEstadoAsiento(asiento.idAsiento, 'BLOQUEADO_TEMPORAL');
      } catch (error) {
        if (error instanceof AsientoNoDisponibleError) {
          // Alguien más lo reservó un instante antes: se refleja como
          // OCUPADO (no vuelve a quedar seleccionable) y se avisa al
          // pasajero, sin romper el renderizado del resto del plano.
          actualizarEstadoAsiento(asiento.idAsiento, 'OCUPADO');
        }
        setToast({ tipo: 'error', mensaje: error.message });
      } finally {
        setIdAsientoEnCurso(null);
      }
    },
    [vueloId, usuarioId, actualizarEstadoAsiento]
  );

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <Leyenda />

      <div className="flex flex-col gap-2 overflow-x-auto">
        {filas.map(([fila, asientosFila]) => {
          const indicePasillo =
            asientosFila.length >= CANTIDAD_MINIMA_PARA_PASILLO ? Math.ceil(asientosFila.length / 2) : -1;

          return (
            <div key={fila} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs font-medium text-slate-400">{fila}</span>
              {asientosFila.map((asiento, indice) => (
                <Fragment key={asiento.idAsiento}>
                  {indice === indicePasillo && <span className="w-4 shrink-0" aria-hidden="true" />}
                  <Asiento
                    codigo={asiento.codigoAsiento}
                    estado={asiento.estado}
                    bloqueando={idAsientoEnCurso === asiento.idAsiento}
                    onSeleccionar={() => manejarSeleccion(asiento)}
                  />
                </Fragment>
              ))}
            </div>
          );
        })}
      </div>

      {toast && <ToastAlerta mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  );
}

export default PlanoCabina;
