/** Renumeración de las facturas emitidas de un ejercicio. */
export const MAX_SECUENCIA = 9999

export interface FacturaNumerada {
  id: string
  numero: string
  secuencia: number
}

export interface CambioNumero {
  id: string
  numeroAntes: string
  numeroNuevo: string
  secuencia: number
}

/** Sustituye la parte numérica final («-0001») conservando serie y año. */
export function cambiarSecuencia(numero: string, secuencia: number): string {
  const sufijo = '-' + String(secuencia).padStart(4, '0')
  return /-\d+$/.test(numero) ? numero.replace(/-\d+$/, sufijo) : numero + sufijo
}

/** Numeración consecutiva desde `inicio`, en el orden actual de las facturas. */
export function planRenumeracion(facturas: readonly FacturaNumerada[], inicio: number): { cambios: CambioNumero[]; ultima: number } {
  const ordenadas = [...facturas].sort((a, b) => a.secuencia - b.secuencia)
  const cambios = ordenadas.map((f, i) => ({
    id: f.id,
    numeroAntes: f.numero,
    numeroNuevo: cambiarSecuencia(f.numero, inicio + i),
    secuencia: inicio + i,
  }))
  return { cambios, ultima: inicio + ordenadas.length - 1 }
}

export function validarRenumeracion(inicio: number, numFacturas: number, primeraActual?: number): string | null {
  if (!Number.isInteger(inicio) || inicio < 1 || inicio > MAX_SECUENCIA) return `Indica un número entero entre 1 y ${MAX_SECUENCIA}.`
  if (inicio + numFacturas - 1 > MAX_SECUENCIA)
    return `Con ${numFacturas} facturas, el número inicial no puede pasar de ${MAX_SECUENCIA - numFacturas + 1}.`
  if (numFacturas > 0 && primeraActual === inicio) return `Las facturas ya empiezan en la ${inicio}.`
  return null
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cambia el número de factura dentro de un texto (p. ej. el concepto de un asiento). */
export function renumerarTexto(texto: string, antes: string, despues: string): string {
  return texto.replace(new RegExp(escapar(antes) + '(?!\\d)', 'g'), despues)
}
