import { zodResolver } from '@hookform/resolvers/zod'
import { FirebaseError } from 'firebase/app'
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, Button, Card, Field, Input } from '../components/ui'
import { auth } from '../firebase'

const schema = z.object({
  email: z.email('Email no válido'),
  password: z.string().min(1, 'Introduce la contraseña'),
})
type FormValues = z.infer<typeof schema>

function mensajeError(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email o contraseña incorrectos.'
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Prueba de nuevo en unos minutos.'
      case 'auth/network-request-failed':
        return 'Sin conexión con el servidor.'
    }
  }
  return 'No se ha podido iniciar sesión.'
}

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email, password }: FormValues) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const resetPassword = async () => {
    const email = getValues('email')
    setError(null)
    setInfo(null)
    if (!email) {
      setError('Escribe tu email para recibir el enlace.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email)
      setInfo('Si el email existe, recibirás un enlace para cambiar la contraseña.')
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">TorreConta</h1>
        <p className="mb-6 text-sm text-slate-500">Inicia sesión para continuar</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          {info && <Alert tone="info">{info}</Alert>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
          <button type="button" onClick={resetPassword} className="w-full text-center text-xs text-slate-500 hover:underline">
            He olvidado la contraseña
          </button>
        </form>
      </Card>
    </main>
  )
}
