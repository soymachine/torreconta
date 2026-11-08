import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Field, Input } from '../../components/base'
import { empresaSchema, type EmpresaFormInput, type EmpresaFormValues } from './empresaSchema'

export function EmpresaForm({
  defaultValues,
  submitLabel,
  onSubmit,
  extra,
}: {
  defaultValues: EmpresaFormInput
  submitLabel: string
  onSubmit: (v: EmpresaFormValues) => Promise<void>
  extra?: React.ReactNode
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaFormInput, unknown, EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Razón social" error={errors.razonSocial?.message} className="sm:col-span-2">
        <Input aria-invalid={!!errors.razonSocial} {...register('razonSocial')} />
      </Field>
      <Field label="NIF / CIF" error={errors.nif?.message}>
        <Input aria-invalid={!!errors.nif} {...register('nif')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input type="email" aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Domicilio" error={errors.domicilio?.message} className="sm:col-span-2">
        <Input {...register('domicilio')} />
      </Field>
      <Field label="Código postal" error={errors.codigoPostal?.message}>
        <Input inputMode="numeric" aria-invalid={!!errors.codigoPostal} {...register('codigoPostal')} />
      </Field>
      <Field label="Municipio" error={errors.municipio?.message}>
        <Input {...register('municipio')} />
      </Field>
      <Field label="Provincia" error={errors.provincia?.message}>
        <Input {...register('provincia')} />
      </Field>
      <Field
        label="Serie de facturas"
        error={errors.serieFacturas?.message}
        hint="Prefijo de la numeración, p. ej. «F» → F2026-0001"
      >
        <Input aria-invalid={!!errors.serieFacturas} {...register('serieFacturas')} />
      </Field>
      {extra}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
