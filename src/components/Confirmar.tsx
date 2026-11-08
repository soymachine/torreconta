import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

export interface OpcionesConfirmar {
  titulo: string
  descripcion?: ReactNode
  accion?: string
  destructiva?: boolean
}

type Confirmar = (o: OpcionesConfirmar) => Promise<boolean>

const ConfirmarContext = createContext<Confirmar | null>(null)

/** Sustituye a `window.confirm` por un AlertDialog de shadcn. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirmar = useCallback<Confirmar>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpciones(o)
      }),
    [],
  )

  const cerrar = (v: boolean) => {
    resolver.current(v)
    setOpciones(null)
  }

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <AlertDialog open={!!opciones} onOpenChange={(abierto) => !abierto && cerrar(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opciones?.titulo}</AlertDialogTitle>
            {opciones?.descripcion && <AlertDialogDescription>{opciones.descripcion}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => cerrar(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={opciones?.destructiva ? 'destructive' : 'default'}
              onClick={() => cerrar(true)}
            >
              {opciones?.accion ?? 'Aceptar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmarContext.Provider>
  )
}

export function useConfirmar(): Confirmar {
  const c = useContext(ConfirmarContext)
  if (!c) throw new Error('useConfirmar fuera de ConfirmarProvider')
  return c
}
