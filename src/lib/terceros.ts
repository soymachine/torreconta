/** Relación entre el tipo de tercero y su subcuenta del PGC. */
import type { Cuenta, Naturaleza } from './cuentas'
import type { TipoTercero } from './tipos'

export const CUENTA_TIPO: Record<TipoTercero, { prefijo: string; naturaleza: Naturaleza }> = {
  cliente: { prefijo: '430', naturaleza: 'activo' },
  proveedor: { prefijo: '400', naturaleza: 'pasivo' },
  acreedor: { prefijo: '410', naturaleza: 'pasivo' },
}

/** Siguiente subcuenta libre de 7 dígitos: 4300001, 4300002… */
export function siguienteSubcuenta(tipo: TipoTercero, cuentas: readonly Pick<Cuenta, 'codigo'>[]): string {
  const { prefijo } = CUENTA_TIPO[tipo]
  let max = 0
  for (const c of cuentas)
    if (c.codigo.length === 7 && c.codigo.startsWith(prefijo)) max = Math.max(max, Number(c.codigo.slice(3)))
  if (max >= 9999) throw new Error('No quedan subcuentas libres.')
  return prefijo + String(max + 1).padStart(4, '0')
}

/** La subcuenta de un tercero debe colgar de la cuenta de su tipo. */
export function cuentaCoherente(tipo: TipoTercero, cuenta: string): boolean {
  return /^\d{7}$/.test(cuenta) && cuenta.startsWith(CUENTA_TIPO[tipo].prefijo)
}

/**
 * Valida el código de subcuenta elegido para un tercero: 7 dígitos, que
 * cuelgue de la cuenta de su tipo (430/400/410) y que esté libre. Una
 * subcuenta desactivada que no pertenece a ningún tercero se considera libre:
 * se reutiliza (reactivándola). Los movimientos se comprueban en el servidor.
 * `actual` es su código actual (al editar, mantenerlo es válido).
 */
export function validarCodigoTercero(
  tipo: TipoTercero,
  codigo: string,
  cuentas: readonly (Pick<Cuenta, 'codigo'> & { activa?: boolean })[],
  actual?: string,
  terceros: readonly { cuenta: string; nombre: string }[] = [],
): string | null {
  const prefijo = CUENTA_TIPO[tipo].prefijo
  if (!/^\d{7}$/.test(codigo)) return `La subcuenta debe tener 7 dígitos y empezar por ${prefijo} (p. ej. ${prefijo}0999).`
  if (!cuentaCoherente(tipo, codigo)) return `Para este tipo, la subcuenta debe empezar por ${prefijo}.`
  if (codigo === prefijo + '0000') return `La ${codigo} no es válida: usa a partir de ${prefijo}0001.`
  if (codigo === actual) return null
  const existente = cuentas.find((c) => c.codigo === codigo)
  if (!existente) return null
  const duenio = terceros.find((t) => t.cuenta === codigo)
  if (duenio) return `La subcuenta ${codigo} ya es de «${duenio.nombre}».`
  if (existente.activa !== false) return `La subcuenta ${codigo} ya existe.`
  return null // desactivada y sin tercero: se reutilizará
}

/** ¿El código corresponde a una subcuenta desactivada que se reutilizaría? */
export function esSubcuentaReutilizable(
  codigo: string,
  cuentas: readonly (Pick<Cuenta, 'codigo'> & { activa?: boolean })[],
  terceros: readonly { cuenta: string }[] = [],
): boolean {
  const c = cuentas.find((x) => x.codigo === codigo)
  return !!c && c.activa === false && !terceros.some((t) => t.cuenta === codigo)
}
