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
