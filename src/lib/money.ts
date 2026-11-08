/**
 * Importes monetarios en céntimos enteros. Nunca se usan floats para
 * almacenar ni sumar dinero: solo para leer lo que teclea el usuario.
 */
export type Cents = number

const formatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  // En es-ES los números de 4 cifras no se agrupan por defecto (1234,56);
  // en contabilidad se lee mejor siempre agrupado (1.234,56).
  useGrouping: 'always',
})

export function formatEuros(cents: Cents): string {
  return formatter.format(cents / 100)
}

/** Formatos aceptados: [regex, separador de miles, separador decimal]. */
const FORMATOS: [RegExp, string, string][] = [
  [/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/, '.', ','], // 1.234,56
  [/^\d+(,\d{1,2})?$/, '', ','], // 1234,56
  [/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/, ',', '.'], // 1,234.56
  [/^\d+(\.\d{1,2})?$/, '', '.'], // 1234.56
]

/**
 * Convierte texto introducido por el usuario ("1.234,56", "1234.5", "-12")
 * en céntimos. Devuelve null si no es un importe válido.
 */
export function parseEuros(input: string): Cents | null {
  let s = input.trim().replace(/[\s€]/g, '')
  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)
  for (const [re, miles, decimal] of FORMATOS) {
    if (!re.test(s)) continue
    const sinMiles = miles ? s.replaceAll(miles, '') : s
    const [ent, dec = ''] = sinMiles.split(decimal)
    const cents = Number(ent) * 100 + Number(dec.padEnd(2, '0'))
    if (!Number.isSafeInteger(cents)) return null
    return negative ? -cents || 0 : cents
  }
  return null
}

/**
 * Porcentaje sobre una base con redondeo comercial (mitad lejos de cero).
 * Admite porcentajes con hasta dos decimales (p. ej. 5,2 % de recargo).
 */
export function percentOf(base: Cents, percent: number): Cents {
  const basisPoints = Math.round(percent * 100)
  const n = Math.abs(base) * Math.abs(basisPoints)
  const rounded = Math.floor((n + 5000) / 10000)
  return Math.sign(base) * Math.sign(basisPoints) * rounded + 0
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0
  for (const v of values) total += v
  return total
}
