'use strict';

/**
 * Capa de Aplicación — caso de uso "Venta de tiquete en mostrador" (agente
 * comercial / administrador; el pago se recibe en efectivo o POS fuera del
 * sistema, así que no hay simulación de pasarela como en el checkout).
 *
 * Orquesta: valida y normaliza los datos del pasajero, prepara la
 * contraseña provisional por si hay que crearlo como usuario y delega la
 * operación transaccional al repositorio inyectado, traduciendo su
 * resultado a errores de negocio tipados. `ventasAdminRepository`,
 * `bcrypt` y `generarSecretoAleatorio` se inyectan para poder testear sin
 * PostgreSQL.
 */

const { ConflictError, NotFoundError, ValidationError } = require('../../errors/AppError');

const SALT_ROUNDS = 10;
const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const LONGITUD_MAXIMA_DOCUMENTO = 30; // usuarios.documento_identidad VARCHAR(30)

const CAMPOS_PASAJERO_OBLIGATORIOS = ['documento', 'nombres', 'apellidos', 'correo'];

const MENSAJES = {
  DATOS_INCOMPLETOS: 'vueloId, asientoId y pasajero son obligatorios.',
  CORREO_INVALIDO: 'El correo electrónico del pasajero no tiene un formato válido.',
  DOCUMENTO_INVALIDO: `El documento del pasajero no puede superar ${LONGITUD_MAXIMA_DOCUMENTO} caracteres.`,
  ASIENTO_NO_ENCONTRADO: 'El asiento indicado no existe o no pertenece al avión asignado a este vuelo.',
  ASIENTO_NO_DISPONIBLE: 'El asiento ya no está disponible: fue reservado o comprado por otro pasajero.',
  VUELO_NO_VENDIBLE: 'El vuelo ya despegó o fue cancelado: no admite ventas.',
  CORREO_DE_OTRO_PASAJERO:
    'Ese correo ya pertenece a un pasajero registrado con otro documento. Verifica los datos.',
};

/** Recorta espacios; el documento y el correo se normalizan para buscar sin duplicar usuarios. */
function normalizarPasajero(pasajero) {
  return {
    documento: String(pasajero.documento ?? '').trim().toUpperCase(),
    nombres: String(pasajero.nombres ?? '').trim(),
    apellidos: String(pasajero.apellidos ?? '').trim(),
    correo: String(pasajero.correo ?? '').trim().toLowerCase(),
    telefono: String(pasajero.telefono ?? '').trim() || undefined,
  };
}

function validarPasajero(pasajero) {
  const faltantes = CAMPOS_PASAJERO_OBLIGATORIOS.filter((campo) => !pasajero[campo]);
  if (faltantes.length > 0) {
    throw new ValidationError(
      `Datos del pasajero incompletos: falta(n) ${faltantes.join(', ')}.`,
      'DATOS_PASAJERO_INCOMPLETOS'
    );
  }
  if (!PATRON_CORREO.test(pasajero.correo)) {
    throw new ValidationError(MENSAJES.CORREO_INVALIDO, 'CORREO_INVALIDO');
  }
  if (pasajero.documento.length > LONGITUD_MAXIMA_DOCUMENTO) {
    throw new ValidationError(MENSAJES.DOCUMENTO_INVALIDO, 'DOCUMENTO_INVALIDO');
  }
}

function lanzarErrorDeMotivo(motivo) {
  switch (motivo) {
    case 'ASIENTO_NO_ENCONTRADO':
      throw new NotFoundError(MENSAJES.ASIENTO_NO_ENCONTRADO, 'ASIENTO_NO_ENCONTRADO');
    case 'VUELO_NO_VENDIBLE':
      throw new ConflictError(MENSAJES.VUELO_NO_VENDIBLE, 'VUELO_NO_VENDIBLE');
    case 'CORREO_DE_OTRO_PASAJERO':
      throw new ConflictError(MENSAJES.CORREO_DE_OTRO_PASAJERO, 'CORREO_DE_OTRO_PASAJERO');
    default: // 'ASIENTO_NO_DISPONIBLE'
      throw new ConflictError(MENSAJES.ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
  }
}

/**
 * @param {{
 *   ventasAdminRepository: { registrarVentaMostrador: Function },
 *   bcrypt: { hash: Function },
 *   generarSecretoAleatorio: () => string,
 * }} dependencias
 * @returns {(datos: {
 *   vueloId: string,
 *   asientoId: string,
 *   pasajero: { documento: string, nombres: string, apellidos: string, correo: string, telefono?: string },
 *   idAgente: string,
 * }) => Promise<{ tiquete: object, pasajeroCreado: boolean }>}
 */
function crearRegistrarVentaAdminUseCase({ ventasAdminRepository, bcrypt, generarSecretoAleatorio }) {
  return async function registrarVentaAdmin({ vueloId, asientoId, pasajero, idAgente }) {
    if (!vueloId || !asientoId || !pasajero) {
      throw new ValidationError(MENSAJES.DATOS_INCOMPLETOS, 'DATOS_INCOMPLETOS');
    }

    const pasajeroNormalizado = normalizarPasajero(pasajero);
    validarPasajero(pasajeroNormalizado);

    // Si el pasajero no existe se crea como usuario sin contraseña conocida
    // (hash de un secreto aleatorio que nadie ve): queda registrado para
    // auditoría/historial, pero no puede iniciar sesión hasta que exista un
    // flujo de "recuperar contraseña". Se calcula siempre (~70 ms) para no
    // hacer hashing dentro de la transacción, que tiene el asiento bloqueado.
    const hashContrasenaProvisional = await bcrypt.hash(generarSecretoAleatorio(), SALT_ROUNDS);

    const resultado = await ventasAdminRepository.registrarVentaMostrador({
      vueloId,
      asientoId,
      pasajero: pasajeroNormalizado,
      idAgente,
      hashContrasenaProvisional,
    });

    if (!resultado.ok) {
      lanzarErrorDeMotivo(resultado.motivo);
    }

    return { tiquete: resultado.tiquete, pasajeroCreado: resultado.pasajeroCreado };
  };
}

module.exports = { crearRegistrarVentaAdminUseCase };
