import httpClient from './httpClient.js';

/*
 * Documentos PDF de un tiquete. `responseType: 'blob'` es obligatorio: sin
 * él Axios intenta decodificar el binario como texto/JSON y el PDF queda
 * corrupto. Devuelven la respuesta completa de Axios (`response.data` es el
 * Blob) para que quien llama decida cómo entregar el archivo.
 *
 * Los errores llegan normalizados por el interceptor de `httpClient`
 * (`Error` con `.code`/`.status`), incluso con el cuerpo de error en Blob.
 */

/** GET /api/tiquetes/:id/pase-abordar */
export function obtenerPaseAbordarPdf(tiqueteId) {
  return httpClient.get(`/tiquetes/${tiqueteId}/pase-abordar`, { responseType: 'blob' });
}

/** GET /api/tiquetes/:id/factura */
export function obtenerFacturaPdf(tiqueteId) {
  return httpClient.get(`/tiquetes/${tiqueteId}/factura`, { responseType: 'blob' });
}

export default { obtenerPaseAbordarPdf, obtenerFacturaPdf };
