import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, borrarDatosLocales, iniciarFirestore } from '../firebase'
import { autorizadoRef } from '../services/paths'

type AuthState =
  | { status: 'cargando' }
  | { status: 'anonimo' }
  | { status: 'no-autorizado'; user: User }
  | { status: 'autorizado'; user: User; empresaId: string }

const AuthContext = createContext<AuthState>({ status: 'cargando' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'cargando' })

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState({ status: 'anonimo' })
          return
        }
        setState({ status: 'cargando' })
        try {
          iniciarFirestore()
          // Solo los UID dados de alta en /autorizados/{uid} pueden usar la app;
          // el documento indica a qué empresa (contabilidad compartida) acceden.
          const snap = await getDoc(autorizadoRef(user.uid))
          const empresaId = snap.exists() ? snap.data().empresaId : undefined
          setState(
            typeof empresaId === 'string' && empresaId
              ? { status: 'autorizado', user, empresaId }
              : { status: 'no-autorizado', user },
          )
        } catch {
          setState({ status: 'no-autorizado', user })
        }
      }),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Empresa a la que accede el usuario autorizado. Solo dentro de rutas protegidas. */
export function useEmpresaId(): string {
  const state = useAuth()
  if (state.status !== 'autorizado') throw new Error('useEmpresaId fuera de una ruta protegida')
  return state.empresaId
}

/**
 * Cierra la sesión y borra los datos guardados en este navegador (caché de
 * Firestore), para que no queden clientes ni facturas en el equipo.
 */
export async function cerrarSesion() {
  try {
    await signOut(auth)
  } finally {
    await borrarDatosLocales()
    window.location.replace('/')
  }
}
