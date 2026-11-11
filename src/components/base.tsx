/**
 * Componentes base de la app construidos sobre shadcn/ui. Mantienen la
 * interfaz que ya usaban las pantallas (p. ej. `Select` con `<option>`), así
 * el cambio de librería no obliga a reescribir cada formulario.
 */
import { cn } from '@/lib/utils'
import {
  Children,
  isValidElement,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { AlertCircle, Info } from 'lucide-react'
import { Alert as UiAlert, AlertDescription } from './ui/alert'
import { Button as UiButton } from './ui/button'
import { Card as UiCard } from './ui/card'
import { Input as UiInput } from './ui/input'
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTES = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
} as const

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <UiButton variant={VARIANTES[variant]} className={cn('h-9 px-3', className)} {...props} />
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <UiInput className={cn('h-9 bg-white', className)} {...props} />
}

/* ─────────────── Select (shadcn) con la interfaz del <select> nativo ─────────────── */

// Radix no admite value="" en un SelectItem: se traduce a un centinela.
const VACIO = '__vacio__'
const aRadix = (v: string) => (v === '' ? VACIO : v)
const deRadix = (v: string) => (v === VACIO ? '' : v)

function texto(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(texto).join('')
  if (isValidElement<{ children?: ReactNode }>(n)) return texto(n.props.children)
  return ''
}

interface OpcionProps {
  value?: string | number
  children?: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  value: string | number
  /** Mismo contrato que el `<select>` nativo: se lee `e.target.value`. */
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
}

export function Select({ value, onChange, children, disabled, className, placeholder, id, ...rest }: SelectProps) {
  const opciones = Children.toArray(children)
    .filter((c): c is ReactElement<OpcionProps> => isValidElement(c))
    .map((c) => ({ value: String(c.props.value ?? texto(c.props.children)), label: texto(c.props.children), disabled: c.props.disabled }))
  return (
    <UiSelect value={aRadix(String(value))} onValueChange={(v) => onChange({ target: { value: deRadix(v) } })} disabled={disabled}>
      <SelectTrigger id={id} aria-label={rest['aria-label']} aria-invalid={rest['aria-invalid'] || undefined} className={cn('h-9 w-full min-w-0 bg-white', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80">
        {opciones.map((o) => (
          <SelectItem key={o.value} value={aRadix(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  )
}

/* ───────────────────────────── Formularios y avisos ───────────────────────────── */

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  // Un <label> envolvente da nombre accesible al campo (también al botón del Select).
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <UiCard className={cn('block px-6 py-6 shadow-xs', className)}>{children}</UiCard>
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return (
    <UiAlert
      role={tone === 'error' ? 'alert' : 'status'}
      variant={tone === 'error' ? 'destructive' : 'default'}
      className={tone === 'info' ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-red-200 bg-red-50'}
    >
      {tone === 'error' ? <AlertCircle /> : <Info />}
      <AlertDescription className={tone === 'info' ? 'text-sky-900' : undefined}>{children}</AlertDescription>
    </UiAlert>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground" role="status">
      {label}
    </div>
  )
}
