import { useEffect, useState } from 'react'
import { useEmpresaId } from '../../auth/AuthProvider'
import type { Logo } from '../../lib/logo'
import { suscribirLogo } from '../../services/logo'

/** Logotipo de la empresa (documento aparte para no cargarlo con cada lectura de la configuración). */
export function useLogo(): Logo | null {
  const eid = useEmpresaId()
  const [logo, setLogo] = useState<Logo | null>(null)
  useEffect(() => suscribirLogo(eid, setLogo), [eid])
  return logo
}
