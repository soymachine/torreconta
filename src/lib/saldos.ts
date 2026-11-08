/** Mayor, sumas y saldos, balance y PyG calculados a partir de los asientos. */
import type { AsientoData } from './asientos'
import { ordenarAsientos } from './asientos'
import type { Cuenta, Naturaleza } from './cuentas'
import type { Cents } from './money'

export interface SumaCuenta {
  debe: Cents
  haber: Cents
}

/** Sumas de debe y haber por cuenta de detalle. */
export function sumasPorCuenta(asientos: readonly AsientoData[]): Map<string, SumaCuenta> {
  const m = new Map<string, SumaCuenta>()
  for (const a of asientos)
    for (const l of a.lineas) {
      const s = m.get(l.cuenta) ?? { debe: 0, haber: 0 }
      s.debe += l.debeCent
      s.haber += l.haberCent
      m.set(l.cuenta, s)
    }
  return m
}

export interface MovimientoMayor<A> {
  asiento: A
  concepto: string
  debe: Cents
  haber: Cents
  saldo: Cents // acumulado, deudor positivo
}

/** Movimientos de una cuenta (o de todas las que empiezan por el prefijo). */
export function mayor<A extends AsientoData>(asientos: readonly A[], prefijo: string): MovimientoMayor<A>[] {
  let saldo = 0
  const out: MovimientoMayor<A>[] = []
  for (const a of ordenarAsientos(asientos))
    for (const l of a.lineas) {
      if (!l.cuenta.startsWith(prefijo)) continue
      saldo += l.debeCent - l.haberCent
      out.push({ asiento: a, concepto: l.concepto || a.concepto, debe: l.debeCent, haber: l.haberCent, saldo })
    }
  return out
}

export interface FilaSumasYSaldos {
  codigo: string
  nombre: string
  debe: Cents
  haber: Cents
  saldoDeudor: Cents
  saldoAcreedor: Cents
}

/**
 * Balance de sumas y saldos. `digitos` agrega por los primeros N dígitos
 * (3 = cuentas del PGC); `null` muestra las cuentas de detalle.
 */
export function sumasYSaldos(
  asientos: readonly AsientoData[],
  cuentas: readonly Cuenta[],
  digitos: number | null,
): FilaSumasYSaldos[] {
  const nombres = new Map(cuentas.map((c) => [c.codigo, c.nombre]))
  const agregadas = new Map<string, SumaCuenta>()
  for (const [codigo, s] of sumasPorCuenta(asientos)) {
    const clave = digitos ? codigo.slice(0, digitos) : codigo
    const acc = agregadas.get(clave) ?? { debe: 0, haber: 0 }
    acc.debe += s.debe
    acc.haber += s.haber
    agregadas.set(clave, acc)
  }
  return [...agregadas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, s]) => {
      const saldo = s.debe - s.haber
      return {
        codigo,
        nombre: nombres.get(codigo) ?? '',
        debe: s.debe,
        haber: s.haber,
        saldoDeudor: saldo > 0 ? saldo : 0,
        saldoAcreedor: saldo < 0 ? -saldo : 0,
      }
    })
}

const esResultado = (codigo: string) => codigo[0] === '6' || codigo[0] === '7'

export interface PartidaPyg {
  codigo: string // subgrupo (2 dígitos)
  nombre: string
  importe: Cents
}

export interface Pyg {
  ingresos: PartidaPyg[]
  gastos: PartidaPyg[]
  totalIngresos: Cents
  totalGastos: Cents
  resultado: Cents
}

export function pyg(asientos: readonly AsientoData[], cuentas: readonly Cuenta[]): Pyg {
  const nombres = new Map(cuentas.map((c) => [c.codigo, c.nombre]))
  const ing = new Map<string, Cents>()
  const gas = new Map<string, Cents>()
  for (const [codigo, s] of sumasPorCuenta(asientos)) {
    const sub = codigo.slice(0, 2)
    if (codigo[0] === '7') ing.set(sub, (ing.get(sub) ?? 0) + s.haber - s.debe)
    if (codigo[0] === '6') gas.set(sub, (gas.get(sub) ?? 0) + s.debe - s.haber)
  }
  const partidas = (m: Map<string, Cents>) =>
    [...m.entries()]
      .filter(([, v]) => v !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([codigo, importe]) => ({ codigo, nombre: nombres.get(codigo) ?? '', importe }))
  const ingresos = partidas(ing)
  const gastos = partidas(gas)
  const totalIngresos = ingresos.reduce((s, p) => s + p.importe, 0)
  const totalGastos = gastos.reduce((s, p) => s + p.importe, 0)
  return { ingresos, gastos, totalIngresos, totalGastos, resultado: totalIngresos - totalGastos }
}

export interface PartidaBalance {
  codigo: string
  nombre: string
  importe: Cents
}

export interface SeccionBalance {
  titulo: string
  partidas: PartidaBalance[]
  total: Cents
}

export interface Balance {
  activoNoCorriente: SeccionBalance
  activoCorriente: SeccionBalance
  patrimonioNeto: SeccionBalance
  pasivoNoCorriente: SeccionBalance
  pasivoCorriente: SeccionBalance
  totalActivo: Cents
  totalPasivoYPn: Cents
  resultado: Cents
  cuadra: boolean
}

/**
 * Balance de situación. Cada cuenta va a activo, pasivo o patrimonio neto
 * según su naturaleza; las cuentas «mixtas» según el signo de su saldo.
 * El resultado del ejercicio (grupos 6 y 7 sin regularizar) se suma al PN.
 */
export function balance(asientos: readonly AsientoData[], cuentas: readonly Cuenta[]): Balance {
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]))
  const naturalezaDe = (codigo: string): Naturaleza => {
    for (let n = codigo.length; n > 0; n--) {
      const c = porCodigo.get(codigo.slice(0, n))
      if (c) return c.naturaleza
    }
    return 'mixta'
  }
  const secciones = {
    anc: new Map<string, Cents>(),
    ac: new Map<string, Cents>(),
    pn: new Map<string, Cents>(),
    pnc: new Map<string, Cents>(),
    pc: new Map<string, Cents>(),
  }
  let resultado = 0
  const add = (m: Map<string, Cents>, codigo: string, v: Cents) => {
    const sub = codigo.slice(0, 2)
    m.set(sub, (m.get(sub) ?? 0) + v)
  }
  for (const [codigo, s] of sumasPorCuenta(asientos)) {
    const saldo = s.debe - s.haber
    if (saldo === 0) continue
    if (esResultado(codigo)) {
      resultado -= saldo
      continue
    }
    let nat = naturalezaDe(codigo)
    if (nat === 'mixta' || nat === 'gasto' || nat === 'ingreso') nat = saldo > 0 ? 'activo' : 'pasivo'
    if (nat === 'activo') add(codigo[0] === '2' ? secciones.anc : secciones.ac, codigo, saldo)
    else if (nat === 'patrimonio') add(secciones.pn, codigo, -saldo)
    else add(codigo[0] === '1' ? secciones.pnc : secciones.pc, codigo, -saldo)
  }
  const seccion = (titulo: string, m: Map<string, Cents>, extra: PartidaBalance[] = []): SeccionBalance => {
    const partidas = [
      ...[...m.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([codigo, importe]) => ({ codigo, nombre: porCodigo.get(codigo)?.nombre ?? '', importe })),
      ...extra,
    ].filter((p) => p.importe !== 0)
    return { titulo, partidas, total: partidas.reduce((s, p) => s + p.importe, 0) }
  }
  const activoNoCorriente = seccion('Activo no corriente', secciones.anc)
  const activoCorriente = seccion('Activo corriente', secciones.ac)
  const patrimonioNeto = seccion('Patrimonio neto', secciones.pn, [
    { codigo: '129', nombre: 'Resultado del ejercicio', importe: resultado },
  ])
  const pasivoNoCorriente = seccion('Pasivo no corriente', secciones.pnc)
  const pasivoCorriente = seccion('Pasivo corriente', secciones.pc)
  const totalActivo = activoNoCorriente.total + activoCorriente.total
  const totalPasivoYPn = patrimonioNeto.total + pasivoNoCorriente.total + pasivoCorriente.total
  return {
    activoNoCorriente,
    activoCorriente,
    patrimonioNeto,
    pasivoNoCorriente,
    pasivoCorriente,
    totalActivo,
    totalPasivoYPn,
    resultado,
    cuadra: totalActivo === totalPasivoYPn,
  }
}
