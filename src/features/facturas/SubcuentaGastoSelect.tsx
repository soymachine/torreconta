import { Field, Select } from '../../components/base'
import { cuentasDeGasto, type Cuenta } from '../../lib/cuentas'

/**
 * Selector de subcuenta para una cuenta de gasto (`raiz`) que tiene
 * subcuentas. Si solo hay una cuenta posible no muestra nada (se usa esa).
 */
export function SubcuentaGastoSelect({
  raiz,
  cuentas,
  value,
  onChange,
  label = 'Cuenta de gasto',
  vacio = '— Elige subcuenta —',
}: {
  raiz: string | undefined
  cuentas: readonly Cuenta[]
  value: string
  onChange: (codigo: string) => void
  label?: string
  vacio?: string
}) {
  if (!raiz) return null
  const opciones = cuentasDeGasto(raiz, cuentas)
  if (opciones.length <= 1) return null
  return (
    <Field label={label} hint={`La ${raiz} tiene subcuentas: elige en cuál se contabiliza`}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{vacio}</option>
        {opciones.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
      </Select>
    </Field>
  )
}

/** ¿Falta elegir subcuenta para esta cuenta raíz? */
export function faltaSubcuenta(raiz: string | undefined, cuentas: readonly Cuenta[], value: string): boolean {
  if (!raiz) return false
  const opciones = cuentasDeGasto(raiz, cuentas)
  return opciones.length > 1 && !opciones.some((c) => c.codigo === value)
}
