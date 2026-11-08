/** Reglas del cuadro de cuentas: jerarquía por prefijo de código. */

export type Naturaleza = 'activo' | 'pasivo' | 'patrimonio' | 'gasto' | 'ingreso' | 'mixta'

export const NATURALEZAS: Naturaleza[] = ['activo', 'pasivo', 'patrimonio', 'gasto', 'ingreso', 'mixta']

export interface Cuenta {
  codigo: string
  nombre: string
  naturaleza: Naturaleza
  activa: boolean
}

export const GRUPOS: Record<string, string> = {
  '1': 'Financiación básica',
  '2': 'Activo no corriente',
  '3': 'Existencias',
  '4': 'Acreedores y deudores',
  '5': 'Cuentas financieras',
  '6': 'Compras y gastos',
  '7': 'Ventas e ingresos',
}

export function grupoDe(codigo: string): string {
  return codigo[0]
}

/** Cuenta existente más larga cuyo código es prefijo propio de `codigo`. */
export function cuentaPadre(codigo: string, cuentas: readonly Cuenta[]): Cuenta | undefined {
  let best: Cuenta | undefined
  for (const c of cuentas) {
    if (c.codigo.length < codigo.length && codigo.startsWith(c.codigo)) {
      if (!best || c.codigo.length > best.codigo.length) best = c
    }
  }
  return best
}

export function tieneHijas(codigo: string, cuentas: readonly Cuenta[]): boolean {
  return cuentas.some((c) => c.codigo.length > codigo.length && c.codigo.startsWith(codigo))
}

/**
 * Una cuenta admite apuntes si tiene al menos 3 dígitos y no tiene
 * subcuentas por debajo (los apuntes van siempre al nivel de detalle).
 */
export function esImputable(cuenta: Cuenta, cuentas: readonly Cuenta[]): boolean {
  return cuenta.activa && cuenta.codigo.length >= 3 && !tieneHijas(cuenta.codigo, cuentas)
}

export type ErrorSubcuenta =
  | 'formato'
  | 'existe'
  | 'sin-padre'
  | 'padre-grupo'

/**
 * Valida el código de una nueva subcuenta: solo dígitos (4 a 12), no
 * existente y colgando de una cuenta de al menos 3 dígitos.
 */
export function validarNuevaSubcuenta(
  codigo: string,
  cuentas: readonly Cuenta[],
): { ok: true; padre: Cuenta } | { ok: false; error: ErrorSubcuenta } {
  if (!/^\d{4,12}$/.test(codigo)) return { ok: false, error: 'formato' }
  if (cuentas.some((c) => c.codigo === codigo)) return { ok: false, error: 'existe' }
  const padre = cuentaPadre(codigo, cuentas)
  if (!padre) return { ok: false, error: 'sin-padre' }
  if (padre.codigo.length < 3) return { ok: false, error: 'padre-grupo' }
  return { ok: true, padre }
}

export const MENSAJES_ERROR_SUBCUENTA: Record<ErrorSubcuenta, string> = {
  formato: 'El código debe tener entre 4 y 12 dígitos.',
  existe: 'Ya existe una cuenta con ese código.',
  'sin-padre': 'No existe ninguna cuenta de la que pueda colgar este código.',
  'padre-grupo': 'Las subcuentas deben colgar de una cuenta de al menos 3 dígitos (p. ej. 4300001 de 430).',
}

export function compararCodigos(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: false })
}
