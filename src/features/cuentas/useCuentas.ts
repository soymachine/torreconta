import { useEffect, useState } from 'react'
import { useUid } from '../../auth/AuthProvider'
import type { Cuenta } from '../../lib/cuentas'
import { suscribirCuentas } from '../../services/cuentas'

export function useCuentas() {
  const uid = useUid()
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => suscribirCuentas(uid, setCuentas, setError), [uid])
  return { cuentas, error }
}
