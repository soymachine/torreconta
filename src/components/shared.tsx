import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { esImputable, type Cuenta } from '../lib/cuentas'
import { formatEuros, type Cents } from '../lib/money'
import { Badge as UiBadge } from './ui/badge'
import { Button as UiButton } from './ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

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
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent
        className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto', wide ? 'sm:max-w-5xl' : 'sm:max-w-xl')}
        // Evita que un clic fuera (p. ej. en un desplegable de un diálogo anidado) cierre el formulario.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * Selector de cuenta con búsqueda por código o nombre (combobox de shadcn).
 * Solo ofrece cuentas imputables; con `permitirPrefijo` también acepta un
 * prefijo escrito (p. ej. «43» para todos los clientes en el mayor).
 */
export function CuentaInput({
  value,
  onChange,
  cuentas,
  filtro,
  permitirPrefijo,
  disabled,
  placeholder = 'Elige cuenta…',
  ...rest
}: {
  value: string
  onChange: (codigo: string) => void
  cuentas: readonly Cuenta[]
  filtro?: (c: Cuenta) => boolean
  permitirPrefijo?: boolean
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const opciones = cuentas.filter((c) => esImputable(c, cuentas) && (!filtro || filtro(c)))
  const actual = cuentas.find((c) => c.codigo === value)
  const elegir = (codigo: string) => {
    onChange(codigo)
    setAbierto(false)
    setBusqueda('')
  }
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <UiButton
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-label={rest['aria-label']}
          disabled={disabled}
          className="h-9 w-full justify-between bg-white px-2.5 font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? (
              <>
                <span className="font-mono">{value}</span>
                {actual && <span className="text-muted-foreground"> · {actual.nombre}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </UiButton>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command filter={(valor, busqueda) => (normalizar(valor).includes(normalizar(busqueda)) ? 1 : 0)}>
          <CommandInput placeholder="Código o nombre…" value={busqueda} onValueChange={setBusqueda} />
          <CommandList>
            <CommandEmpty>No hay cuentas que coincidan.</CommandEmpty>
            {permitirPrefijo && /^\d+$/.test(busqueda) && !opciones.some((c) => c.codigo === busqueda) && (
              <CommandGroup>
                <CommandItem value={`prefijo ${busqueda}`} onSelect={() => elegir(busqueda)}>
                  Todas las cuentas que empiezan por <span className="font-mono">{busqueda}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {opciones.map((c) => (
                <CommandItem key={c.codigo} value={`${c.codigo} ${c.nombre}`} onSelect={() => elegir(c.codigo)}>
                  <Check className={cn('size-4', value === c.codigo ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-mono">{c.codigo}</span>
                  <span className="truncate text-muted-foreground">{c.nombre}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  return (
    <UiBadge variant="secondary" className={cn('rounded-md align-middle', tones[tone])}>
      {children}
    </UiBadge>
  )
}
