import { useEffect } from 'react'
import { toast } from 'sonner'
import { cerrarSesion } from '../auth/AuthProvider'

const MINUTOS = 30
const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

/** Duración configurable solo para pruebas (sessionStorage), 30 min por defecto. */
function duracionMs(): number {
  try {
    const v = Number(sessionStorage.getItem('torreconta.inactividadMs'))
    if (v > 0) return v
  } catch {
    /* sin almacenamiento */
  }
  return MINUTOS * 60_000
}

/**
 * Cierra la sesión tras un tiempo sin actividad (y borra los datos locales),
 * avisando un minuto antes. La actividad en cualquier pestaña reinicia el plazo.
 */
export function useInactividad() {
  useEffect(() => {
    const total = duracionMs()
    const aviso = Math.max(total - 60_000, total * 0.8)
    let tAviso: ReturnType<typeof setTimeout>
    let tFin: ReturnType<typeof setTimeout>
    let idAviso: string | number | undefined
    let ultimo = 0

    const programar = () => {
      clearTimeout(tAviso)
      clearTimeout(tFin)
      if (idAviso !== undefined) toast.dismiss(idAviso)
      idAviso = undefined
      tAviso = setTimeout(() => {
        idAviso = toast.warning('Por seguridad, la sesión se cerrará en breve por inactividad.', { duration: total - aviso })
      }, aviso)
      tFin = setTimeout(() => {
        toast.info('Sesión cerrada por inactividad')
        void cerrarSesion()
      }, total)
    }
    const actividad = () => {
      const ahora = Date.now()
      if (ahora - ultimo < 1000) return // como mucho una vez por segundo
      ultimo = ahora
      programar()
    }
    programar()
    EVENTOS.forEach((e) => window.addEventListener(e, actividad, { passive: true }))
    return () => {
      clearTimeout(tAviso)
      clearTimeout(tFin)
      EVENTOS.forEach((e) => window.removeEventListener(e, actividad))
    }
  }, [])
}
