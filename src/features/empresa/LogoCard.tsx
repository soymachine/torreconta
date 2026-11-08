import { ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { useEmpresaId } from '../../auth/AuthProvider'
import { Alert, Button, Card } from '../../components/base'
import { useConfirmar } from '../../components/Confirmar'
import { errorMsg } from '../../components/shared'
import { borrarLogo, guardarLogo, procesarLogo } from '../../services/logo'
import { useLogo } from './useLogo'

export function LogoCard() {
  const eid = useEmpresaId()
  const logo = useLogo()
  const confirmar = useConfirmar()
  const input = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subir = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setGuardando(true)
    try {
      await guardarLogo(eid, await procesarLogo(file))
      toast.success('Logotipo actualizado')
    } catch (e) {
      setError(errorMsg(e))
    } finally {
      setGuardando(false)
      if (input.current) input.current.value = ''
    }
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    void subir(e.dataTransfer.files[0])
  }

  const quitar = async () => {
    const ok = await confirmar({
      titulo: '¿Quitar el logotipo?',
      descripcion: 'Dejará de mostrarse en el menú y en las facturas.',
      accion: 'Quitar',
      destructiva: true,
    })
    if (!ok) return
    try {
      await borrarLogo(eid)
      toast.success('Logotipo eliminado')
    } catch (e) {
      setError(errorMsg(e))
    }
  }

  return (
    <Card className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Logotipo</h2>
        <p className="text-sm text-muted-foreground">
          Se muestra arriba a la izquierda y en las facturas impresas. PNG, JPG, WebP o SVG de hasta 5 MB; se reduce
          automáticamente. Mejor con fondo transparente.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex h-28 w-full items-center justify-center rounded-lg border bg-white p-3 sm:w-56">
          {logo ? (
            <img src={logo.dataUrl} alt="Logotipo actual" className="max-h-full max-w-full object-contain" data-testid="logo-preview" />
          ) : (
            <span className="text-sm text-muted-foreground">Sin logotipo</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
          disabled={guardando}
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-sm transition-colors ${
            arrastrando ? 'border-slate-500 bg-slate-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <ImageUp className="size-6 text-muted-foreground" />
          <span className="font-medium">{guardando ? 'Procesando…' : logo ? 'Cambiar logotipo' : 'Subir logotipo'}</span>
          <span className="text-xs text-muted-foreground">Haz clic o arrastra aquí la imagen</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          aria-label="Archivo del logotipo"
          onChange={(e) => void subir(e.target.files?.[0])}
        />
      </div>
      {error && <Alert>{error}</Alert>}
      {logo && (
        <Button variant="ghost" onClick={quitar} className="text-red-700">
          <Trash2 /> Quitar logotipo
        </Button>
      )}
    </Card>
  )
}
