'use strict';

/**
 * Capa de Aplicación — caso de uso "Checkout de tiquete" (procesar pago
 * simulado y confirmar la reserva).
 *
 * Orquesta: valida los datos de pago (simulación de pasarela de pago) y
 * delega la operación transaccional al repositorio inyectado, traduciendo
 * su resultado a errores de negocio tipados. El repositorio se recibe por
 * parámetro (inyección de dependencias) para que este caso de uso sea
 * testeable sin PostgreSQL.
 */

const { ConflictError, NotFoundError, ValidationError } = require('../../errors/AppError');

const MENSAJE_ASIENTO_NO_ENCONTRADO =
  'El asiento indicado no existe o no pertenece al avión asignado a este vuelo.';
const MENSAJE_ASIENTO_NO_DISPONIBLE =
  'El asiento ya no está disponible: fue reservado o comprado por otro pasajero.';
const MENSAJE_PASAJERO_NO_ENCONTRADO = 'El pasajero indicado no existe.';
const MENSAJE_DATOS_PAGO_INCOMPLETOS =
  'Los datos de la tarjeta (numeroTarjeta, fechaExpiracion, cvv, nombreTitular) son obligatorios.';

/** Campos de `datosPago` que la pasarela simulada exige no-vacíos. */
const CAMPOS_TARJETA_REQUERIDOS = ['numeroTarjeta', 'fechaExpiracion', 'cvv', 'nombreTitular'];

/**
 * Simulación de pasarela de pago: un pago "exitoso" es aquel cuyos datos de
 * tarjeta llegan completos. No se realiza ninguna validación de negocio de
 * tarjetas reales (Luhn, vigencia, etc.) — está fuera del alcance de esta
 * simulación.
 */
function validarDatosPago(datosPago) {
  const datosIncompletos =
    !datosPago ||
    CAMPOS_TARJETA_REQUERIDOS.some((campo) => !String(datosPago[campo] ?? '').trim());

  if (datosIncompletos) {
    throw new ValidationError(MENSAJE_DATOS_PAGO_INCOMPLETOS, 'DATOS_PAGO_INCOMPLETOS');
  }
}

/**
 * @param {{ tiquetesRepository: { confirmarCompra: Function } }} dependencias
 * @returns {(datos: {
 *   vueloId: string,
 *   asientoId: string,
 *   pasajeroId: string,
 *   datosPago: { numeroTarjeta: string, fechaExpiracion: string, cvv: string, nombreTitular: string },
 * }) => Promise<object>}
 */
function crearCheckoutUseCase({ tiquetesRepository }) {
  return async function checkout({ vueloId, asientoId, pasajeroId, datosPago }) {
    validarDatosPago(datosPago);

    const resultado = await tiquetesRepository.confirmarCompra({ vueloId, asientoId, pasajeroId });

    if (!resultado.ok) {
      if (resultado.motivo === 'ASIENTO_NO_ENCONTRADO') {
        throw new NotFoundError(MENSAJE_ASIENTO_NO_ENCONTRADO, 'ASIENTO_NO_ENCONTRADO');
      }

      if (resultado.motivo === 'PASAJERO_NO_ENCONTRADO') {
        throw new NotFoundError(MENSAJE_PASAJERO_NO_ENCONTRADO, 'PASAJERO_NO_ENCONTRADO');
      }

      // Asiento ya tomado (bloqueado o comprado por otro pasajero): conflicto
      // de negocio, no error inesperado.
      throw new ConflictError(MENSAJE_ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
    }

    return resultado.tiquete;
  };
}

module.exports = { crearCheckoutUseCase };
