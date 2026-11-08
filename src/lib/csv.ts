/** CSV compatible con Excel en español: separador «;», coma decimal y BOM. */
export type Celda = string | number | null | undefined

function escapar(v: Celda): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** Céntimos a texto «1234,56» (sin separador de miles) para hojas de cálculo. */
export function centsCsv(cents: number): string {
  const neg = cents < 0
  const abs = Math.abs(cents)
  return `${neg ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function toCsv(cabecera: string[], filas: Celda[][]): string {
  return '﻿' + [cabecera, ...filas].map((f) => f.map(escapar).join(';')).join('\r\n') + '\r\n'
}

export function descargarCsv(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
