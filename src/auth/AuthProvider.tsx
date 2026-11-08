import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth } from '../firebase'
import { autorizadoRef } from '../services/paths'

type AuthState =
  | { status: 'cargando' }
  | { status: 'anonimo' }
  | { status: 'no-autorizado'; user: User }
  | { status: 'autorizado'; user: User }

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
          // Solo los UID dados de alta en /autorizados/{uid} pueden usar la app.
          const snap = await getDoc(autorizadoRef(user.uid))
          setState(snap.exists() ? { status: 'autorizado', user } : { status: 'no-autorizado', user })
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

/** UID del usuario autorizado. Solo usar dentro de rutas protegidas. */
export function useUid(): string {
  const state = useAuth()
  if (state.status !== 'autorizado') throw new Error('useUid fuera de una ruta protegida')
  return state.user.uid
}

export function cerrarSesion() {
  return signOut(auth)
}
