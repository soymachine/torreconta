import { Select } from '../../components/base'
import { opcionesCategoriaGasto } from '../../lib/categoriasGasto'
import type { Cuenta } from '../../lib/cuentas'
import type { Categoria } from '../../lib/tipos'

/**
 * Selector de categoría de gasto: las categorías existentes y cualquier
 * cuenta mayor del grupo 6 sin categoría (valor `cat:<id>` o `cta:<codigo>`).
 */
export function CategoriaGastoSelect({
  value,
  onChange,
  categorias,
  cuentas,
  vacio = '— Elige —',
  'aria-label': ariaLabel = 'Categoría',
  'aria-invalid': ariaInvalid,
}: {
  value: string
  onChange: (valor: string) => void
  categorias: readonly Categoria[]
  cuentas: readonly Cuenta[]
  vacio?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
}) {
  const opciones = opcionesCategoriaGasto(categorias, cuentas, value)
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} aria-invalid={ariaInvalid}>
      <option value="">{vacio}</option>
      {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
    </Select>
  )
}
