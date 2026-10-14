/**
 * Fuerza en el navegador la descarga de un PDF recibido con Axios
 * (`responseType: 'blob'`): URL temporal + `<a download>` oculto + click,
 * y libera la URL al terminar.
 *
 * @param {import('axios').AxiosResponse<Blob>} response
 * @param {string} nombreArchivo
 */
export function descargarPdf(response, nombreArchivo) {
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default descargarPdf;
