/** Vencimientos de las facturas recibidas (fechas AAAA-MM-DD). */
import type { Cents } from './money'

export interface ConVencimiento {
  fecha: string
  vencimiento?: string
  estado: 'pendiente' | 'pagada'
  totalCent: Cents
}

/** Las facturas antiguas sin vencimiento vencen el día de su fecha. */
export const vencimientoDe = (f: Pick<ConVencimiento, 'fecha' | 'vencimiento'>) => f.vencimiento || f.fecha

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d + dias))
  return t.toISOString().slice(0, 10)
}

export function diasEntre(desde: string, hasta: string): number {
  const ms = (f: string) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))
  return Math.round((ms(hasta) - ms(desde)) / 86_400_000)
}

export function hoyIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface FilaVencimiento<F> {
  factura: F
  vencimiento: string
  /** Días hasta el vencimiento desde hoy: negativo si ya venció. */
  dias: number
  vencida: boolean
}

/** Facturas que vencen entre dos fechas (incluidas), ordenadas por vencimiento. */
export function vencimientosEntre<F extends ConVencimiento>(
  facturas: readonly F[],
  desde: string,
  hasta: string,
  hoy: string,
  opciones: { soloPendientes?: boolean } = {},
): FilaVencimiento<F>[] {
  return facturas
    .filter((f) => !opciones.soloPendientes || f.estado === 'pendiente')
    .map((f) => {
      const v = vencimientoDe(f)
      const dias = diasEntre(hoy, v)
      return { factura: f, vencimiento: v, dias, vencida: f.estado === 'pendiente' && dias < 0 }
    })
    .filter((r) => (!desde || r.vencimiento >= desde) && (!hasta || r.vencimiento <= hasta))
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
}

/** Pendientes cuyo vencimiento ya pasó. */
export function vencidasPendientes<F extends ConVencimiento>(facturas: readonly F[], hoy: string) {
  const filas = facturas.filter((f) => f.estado === 'pendiente' && vencimientoDe(f) < hoy)
  return { numero: filas.length, totalCent: filas.reduce((s, f) => s + f.totalCent, 0) }
}
