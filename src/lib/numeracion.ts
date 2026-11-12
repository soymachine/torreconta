/** Inicio de la numeración de facturas emitidas de un ejercicio. */
export const MAX_SECUENCIA = 9999

/**
 * Valida el número de la próxima factura. Debe ser mayor que la última
 * secuencia emitida en el ejercicio para no repetir números.
 */
export function validarInicioNumeracion(siguiente: number, ultimaSecuencia: number, numeroUltima?: string): string | null {
  if (!Number.isInteger(siguiente) || siguiente < 1 || siguiente > MAX_SECUENCIA)
    return `Indica un número entero entre 1 y ${MAX_SECUENCIA}.`
  if (siguiente <= ultimaSecuencia)
    return `Ya existe la factura ${numeroUltima ?? ultimaSecuencia}: el número debe ser ${ultimaSecuencia + 1} o mayor.`
  return null
}
