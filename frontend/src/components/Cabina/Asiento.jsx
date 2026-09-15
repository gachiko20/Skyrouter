const ESTILOS_POR_ESTADO = {
  DISPONIBLE: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 cursor-pointer',
  BLOQUEADO_TEMPORAL: 'border-amber-300 bg-amber-100 text-amber-700 cursor-not-allowed',
  OCUPADO: 'border-slate-300 bg-slate-200 text-slate-400 cursor-not-allowed',
};

const ETIQUETA_POR_ESTADO = {
  DISPONIBLE: 'Disponible',
  BLOQUEADO_TEMPORAL: 'Bloqueado temporalmente',
  OCUPADO: 'Ocupado',
};

/**
 * Un único asiento del plano de cabina. Puramente presentacional: recibe su
 * estado ya resuelto y solo notifica la intención de selección vía
 * `onSeleccionar`; toda la lógica de red y de conflicto vive en
 * `PlanoCabina`.
 */
function Asiento({ codigo, estado, bloqueando = false, onSeleccionar }) {
  const esSeleccionable = estado === 'DISPONIBLE' && !bloqueando;
  const etiquetaEstado = bloqueando ? 'Bloqueando…' : ETIQUETA_POR_ESTADO[estado] ?? estado;

  return (
    <button
      type="button"
      disabled={!esSeleccionable}
      onClick={() => onSeleccionar?.(codigo)}
      aria-label={`Asiento ${codigo}, ${etiquetaEstado}`}
      title={`Asiento ${codigo} — ${etiquetaEstado}`}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${
        bloqueando ? 'cursor-wait border-sky-400 bg-sky-100 text-sky-700 animate-pulse' : ESTILOS_POR_ESTADO[estado] ?? ESTILOS_POR_ESTADO.OCUPADO
      }`}
    >
      {codigo}
    </button>
  );
}

export default Asiento;
