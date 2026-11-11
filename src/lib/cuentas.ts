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

export type ErrorNuevaCuenta = 'formato' | 'existe' | 'sin-padre' | 'padre-grupo'

/**
 * Valida el código de una cuenta nueva:
 *  - cuenta del PGC de 3 dígitos, que cuelga de su subgrupo (p. ej. 607 de 60);
 *  - subcuenta de 4 a 12 dígitos, que cuelga de una cuenta de 3 o más (6020001 de 602).
 * No se permiten códigos que ya existan ni grupos/subgrupos (1-2 dígitos).
 */
export function validarNuevaCuenta(
  codigo: string,
  cuentas: readonly Cuenta[],
): { ok: true; padre: Cuenta; tipo: 'cuenta' | 'subcuenta' } | { ok: false; error: ErrorNuevaCuenta; padre?: Cuenta } {
  if (!/^\d{3,12}$/.test(codigo)) return { ok: false, error: 'formato' }
  if (cuentas.some((c) => c.codigo === codigo)) return { ok: false, error: 'existe' }
  const padre = cuentaPadre(codigo, cuentas)
  if (!padre) return { ok: false, error: 'sin-padre' }
  if (codigo.length >= 4 && padre.codigo.length < 3) return { ok: false, error: 'padre-grupo', padre }
  return { ok: true, padre, tipo: codigo.length === 3 ? 'cuenta' : 'subcuenta' }
}

export function mensajeErrorNuevaCuenta(codigo: string, error: ErrorNuevaCuenta, cuentas: readonly Cuenta[] = []): string {
  switch (error) {
    case 'formato':
      return 'El código debe tener entre 3 y 12 dígitos: 3 para una cuenta del PGC (p. ej. 601) y 4 o más para una subcuenta (p. ej. 6020001).'
    case 'existe':
      return cuentas.find((c) => c.codigo === codigo)?.activa === false
        ? `La cuenta ${codigo} ya existe pero está desactivada: márcala con «Mostrar inactivas» y pulsa «Activar».`
        : `Ya existe la cuenta ${codigo}.`
    case 'sin-padre':
      return `No existe el grupo o subgrupo del que colgaría la ${codigo}.`
    case 'padre-grupo':
      return `Antes crea la cuenta de 3 dígitos ${codigo.slice(0, 3)}: las subcuentas cuelgan de una cuenta, no de un subgrupo.`
  }
}

export function compararCodigos(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: false })
}

/**
 * Cuentas de gasto donde se puede contabilizar una factura de una categoría
 * con cuenta raíz `raiz`: las imputables y activas que cuelgan de ella. Si la
 * raíz tiene subcuentas, nunca se ofrece la raíz (siempre la subcuenta).
 */
export function cuentasDeGasto(raiz: string, cuentas: readonly Cuenta[]): Cuenta[] {
  return cuentas
    .filter((c) => c.codigo.startsWith(raiz) && c.activa && esImputable(c, cuentas))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo))
}

/**
 * Cuenta de gasto definitiva para una factura de la categoría con raíz `raiz`:
 * la preferida si es válida; si solo hay una posible, esa; si hay varias y
 * ninguna elegida, error (hay que elegir subcuenta).
 */
export function resolverCuentaGasto(raiz: string, cuentas: readonly Cuenta[], preferida?: string): string {
  const opciones = cuentasDeGasto(raiz, cuentas)
  if (preferida && opciones.some((c) => c.codigo === preferida)) return preferida
  if (opciones.length === 1) return opciones[0].codigo
  if (opciones.length === 0) throw new Error(`La cuenta ${raiz} no tiene subcuentas activas donde contabilizar.`)
  throw new Error(`Elige la subcuenta de gasto: la ${raiz} tiene subcuentas.`)
}
