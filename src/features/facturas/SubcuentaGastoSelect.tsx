import { Field, Select } from '../../components/base'
import { cuentasDeGasto, type Cuenta } from '../../lib/cuentas'
import type { Categoria } from '../../lib/tipos'

/**
 * Selector de subcuenta para una categoría cuya cuenta tiene subcuentas.
 * Si solo hay una cuenta posible no muestra nada (se usa esa).
 */
export function SubcuentaGastoSelect({
  categoria,
  cuentas,
  value,
  onChange,
  label = 'Cuenta de gasto',
  vacio = '— Elige subcuenta —',
}: {
  categoria: Categoria | undefined
  cuentas: readonly Cuenta[]
  value: string
  onChange: (codigo: string) => void
  label?: string
  vacio?: string
}) {
  if (!categoria) return null
  const opciones = cuentasDeGasto(categoria.cuentaGasto, cuentas)
  if (opciones.length <= 1) return null
  return (
    <Field label={label} hint={`La ${categoria.cuentaGasto} tiene subcuentas: elige en cuál se contabiliza`}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{vacio}</option>
        {opciones.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
      </Select>
    </Field>
  )
}

/** ¿Falta elegir subcuenta para esta categoría? */
export function faltaSubcuenta(categoria: Categoria | undefined, cuentas: readonly Cuenta[], value: string): boolean {
  if (!categoria) return false
  const opciones = cuentasDeGasto(categoria.cuentaGasto, cuentas)
  return opciones.length > 1 && !opciones.some((c) => c.codigo === value)
}
