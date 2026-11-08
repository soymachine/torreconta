import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useEmpresaId } from '../../auth/AuthProvider'
import { suscribirEmpresa, type Empresa } from '../../services/empresa'

type EmpresaState =
  | { status: 'cargando' }
  | { status: 'error'; error: Error }
  | { status: 'sin-configurar' }
  | { status: 'lista'; empresa: Empresa }

const EmpresaContext = createContext<EmpresaState>({ status: 'cargando' })

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const eid = useEmpresaId()
  const [state, setState] = useState<EmpresaState>({ status: 'cargando' })

  useEffect(
    () =>
      suscribirEmpresa(
        eid,
        (empresa) => setState(empresa ? { status: 'lista', empresa } : { status: 'sin-configurar' }),
        (error) => setState({ status: 'error', error }),
      ),
    [eid],
  )

  return <EmpresaContext.Provider value={state}>{children}</EmpresaContext.Provider>
}

export function useEmpresaState() {
  return useContext(EmpresaContext)
}

export function useEmpresa(): Empresa {
  const s = useEmpresaState()
  if (s.status !== 'lista') throw new Error('useEmpresa sin empresa configurada')
  return s.empresa
}
