/**
 * Modelo 347: declaración anual de operaciones con terceros que superan
 * 3.005,06 € (IVA incluido) en el año, por tercero y clave:
 *  - A: adquisiciones (facturas recibidas de proveedores y acreedores)
 *  - B: entregas (facturas emitidas a clientes)
 * Cálculo orientativo para ayudar a cumplimentar la declaración.
 */
import { trimestreDe } from './iva'
import type { Cents } from './money'
import { isValidNif } from './nif'
import type { FacturaEmitida, Tercero } from './tipos'

export const UMBRAL_347: Cents = 300506
export const UMBRAL_METALICO: Cents = 600000

export type Clave347 = 'A' | 'B'

export interface Fila347 {
  terceroId: string
  nif: string
  nombre: string
  provincia: string | null
  clave: Clave347
  trimestres: [Cents, Cents, Cents, Cents]
  totalCent: Cents
  metalicoCent: Cents
  numFacturas: number
  avisos: string[]
}

export interface Resultado347 {
  declarados: Fila347[]
  noDeclarados: Fila347[]
  totales: Record<Clave347, { importeCent: Cents; declarados: number }>
}

/** Código de provincia (2 primeros dígitos del código postal) buscado en el domicilio. */
export function provinciaDesdeDomicilio(domicilio: string): string | null {
  const m = /(?:^|\D)((0[1-9]|[1-4]\d|5[0-2])\d{3})(?!\d)/.exec(domicilio)
  return m ? m[2] : null
}

type FacturaComun = Pick<FacturaEmitida, 'terceroId' | 'terceroNombre' | 'terceroNif' | 'fecha' | 'baseCent' | 'cuotaIvaCent' | 'retencionCent'>

export function calcularModelo347(d: {
  anio: number
  emitidas: readonly (FacturaComun & Pick<FacturaEmitida, 'cobro'>)[]
  recibidas: readonly FacturaComun[]
  emitidasAnteriores?: readonly Pick<FacturaEmitida, 'terceroId' | 'terceroNombre' | 'terceroNif' | 'totalCent' | 'cobro'>[]
  terceros: readonly Pick<Tercero, 'id' | 'nombre' | 'nif' | 'domicilio'>[]
  incluirConRetencion?: boolean
  umbralCent?: Cents
}): Resultado347 {
  const umbral = d.umbralCent ?? UMBRAL_347
  const porTercero = new Map(d.terceros.map((t) => [t.id, t]))
  const filas = new Map<string, Fila347>()
  const enAnio = (fecha: string) => fecha.startsWith(`${d.anio}-`)

  const fila = (clave: Clave347, f: { terceroId: string; terceroNombre: string; terceroNif: string }) => {
    const k = `${clave}:${f.terceroId}`
    let r = filas.get(k)
    if (!r) {
      const t = porTercero.get(f.terceroId)
      r = {
        terceroId: f.terceroId,
        nif: t?.nif || f.terceroNif,
        nombre: t?.nombre || f.terceroNombre,
        provincia: t ? provinciaDesdeDomicilio(t.domicilio) : null,
        clave,
        trimestres: [0, 0, 0, 0],
        totalCent: 0,
        metalicoCent: 0,
        numFacturas: 0,
        avisos: [],
      }
      filas.set(k, r)
    }
    return r
  }

  const sumar = (clave: Clave347, f: FacturaComun) => {
    const r = fila(clave, f)
    const importe = f.baseCent + f.cuotaIvaCent // contraprestación con IVA, sin restar retenciones
    r.trimestres[trimestreDe(f.fecha) - 1] += importe
    r.totalCent += importe
    r.numFacturas++
  }

  for (const f of d.emitidas) if (enAnio(f.fecha)) sumar('B', f)
  for (const f of d.recibidas) {
    if (!enAnio(f.fecha)) continue
    // Las facturas de profesionales con retención se declaran en el modelo 190.
    if (f.retencionCent !== 0 && !d.incluirConRetencion) continue
    sumar('A', f)
  }

  // Cobros en metálico (caja, 570…) con fecha en el año, incluidos los de facturas del año anterior.
  for (const f of [...d.emitidas, ...(d.emitidasAnteriores ?? [])]) {
    const c = f.cobro
    if (!c || !enAnio(c.fecha) || !c.cuenta.startsWith('570')) continue
    const importe = 'baseCent' in f ? f.baseCent + f.cuotaIvaCent - f.retencionCent : f.totalCent
    fila('B', f).metalicoCent += importe
  }

  const declarados: Fila347[] = []
  const noDeclarados: Fila347[] = []
  for (const r of filas.values()) {
    const declarable = Math.abs(r.totalCent) > umbral || r.metalicoCent > UMBRAL_METALICO
    if (declarable) {
      if (!r.nif) r.avisos.push('Falta el NIF')
      else if (!isValidNif(r.nif)) r.avisos.push('NIF no válido o extranjero')
      if (!r.provincia) r.avisos.push('Sin código postal en el domicilio')
    }
    if (r.metalicoCent > UMBRAL_METALICO) r.avisos.push('Cobros en metálico > 6.000 €')
    ;(declarable ? declarados : noDeclarados).push(r)
  }
  const orden = (a: Fila347, b: Fila347) => a.clave.localeCompare(b.clave) || b.totalCent - a.totalCent
  declarados.sort(orden)
  noDeclarados.sort(orden)
  const totales = {
    A: { importeCent: 0, declarados: 0 },
    B: { importeCent: 0, declarados: 0 },
  }
  for (const r of declarados) {
    totales[r.clave].importeCent += r.totalCent
    totales[r.clave].declarados++
  }
  return { declarados, noDeclarados, totales }
}
