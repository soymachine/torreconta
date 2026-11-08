import { useEffect, useId, type ReactNode } from 'react'
import { esImputable, type Cuenta } from '../lib/cuentas'
import { formatEuros, type Cents } from '../lib/money'
import { Input } from './ui'

export const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
export const thNum = 'px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500'
export const td = 'px-3 py-2 align-top'
export const tdNum = 'px-3 py-2 text-right align-top tabular-nums whitespace-nowrap'

export function Euros({ cents, muted, className = '' }: { cents: Cents; muted?: boolean; className?: string }) {
  return (
    <span className={`tabular-nums ${cents < 0 ? 'text-red-700' : ''} ${muted && cents === 0 ? 'text-slate-300' : ''} ${className}`}>
      {formatEuros(cents)}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">{children}</div>
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const id = useId()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-2 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`my-4 w-full rounded-lg bg-white shadow-xl ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 id={id} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Campo de cuenta con autocompletado de las cuentas imputables. */
export function CuentaInput({
  value,
  onChange,
  cuentas,
  filtro,
  ...rest
}: {
  value: string
  onChange: (codigo: string) => void
  cuentas: readonly Cuenta[]
  filtro?: (c: Cuenta) => boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const listId = useId()
  const opciones = cuentas.filter((c) => esImputable(c, cuentas) && (!filtro || filtro(c)))
  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value.split(' ')[0].replace(/\D/g, ''))}
        inputMode="numeric"
        className="font-mono"
        {...rest}
      />
      <datalist id={listId}>
        {opciones.map((c) => (
          <option key={c.codigo} value={c.codigo}>
            {c.codigo} · {c.nombre}
          </option>
        ))}
      </datalist>
    </>
  )
}

/** Céntimos → texto editable «1234,56». */
export function centsAInput(cents: Cents): string {
  if (!cents) return ''
  const neg = cents < 0
  const abs = Math.abs(cents)
  return `${neg ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function hoyEn(anio: number): string {
  const hoy = new Date()
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return hoy.getFullYear() === anio ? iso : `${anio}-12-31`
}

export function formatFecha(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function errorMsg(e: unknown): string {
  if (e instanceof Error) {
    if (/permission|PERMISSION_DENIED/i.test(e.message)) return 'Operación no permitida (revisa que el ejercicio esté abierto).'
    return e.message
  }
  return 'Error inesperado.'
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'sky' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    sky: 'bg-sky-50 text-sky-800',
  }
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}
