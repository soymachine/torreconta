import { deleteDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { dataUrlValido, dimensionesAjustadas, MAX_LADO, validarArchivoLogo, type Logo } from '../lib/logo'
import { logoRef } from './paths'

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se ha podido leer la imagen.'))
    img.src = url
  })
}

/**
 * Reduce la imagen a un máximo de 512 px por lado y la convierte a WebP
 * (o PNG si el navegador no sabe generar WebP). Los SVG se rasterizan, así
 * que nunca se guarda código.
 */
export async function procesarLogo(file: File): Promise<Logo> {
  const error = validarArchivoLogo(file)
  if (error) throw new Error(error)
  const url = URL.createObjectURL(file)
  try {
    const img = await cargarImagen(url)
    // Algunos SVG no declaran tamaño: se usa el máximo.
    const { ancho, alto } = dimensionesAjustadas(img.naturalWidth || MAX_LADO, img.naturalHeight || MAX_LADO)
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('El navegador no permite procesar la imagen.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, ancho, alto)
    let dataUrl = canvas.toDataURL('image/webp', 0.9)
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png')
    if (!dataUrlValido(dataUrl)) throw new Error('El logotipo procesado es demasiado grande. Prueba con una imagen más sencilla.')
    return { dataUrl, ancho, alto }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function guardarLogo(eid: string, logo: Logo) {
  await setDoc(logoRef(eid), { ...logo, actualizado: serverTimestamp() })
}

export async function borrarLogo(eid: string) {
  await deleteDoc(logoRef(eid))
}

export function suscribirLogo(eid: string, cb: (l: Logo | null) => void) {
  return onSnapshot(
    logoRef(eid),
    (s) => cb(s.exists() ? (s.data() as Logo) : null),
    () => cb(null),
  )
}
