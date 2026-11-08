import { z } from 'zod'
import { isValidNif, normalizeNif } from '../../lib/nif'

export const empresaSchema = z.object({
  razonSocial: z.string().trim().min(2, 'Obligatorio').max(150),
  nif: z
    .string()
    .transform(normalizeNif)
    .refine(isValidNif, 'NIF/CIF no válido'),
  domicilio: z.string().trim().max(200),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^(\d{5})?$/, 'Código postal de 5 dígitos'),
  municipio: z.string().trim().max(100),
  provincia: z.string().trim().max(100),
  email: z.union([z.literal(''), z.email('Email no válido')]),
  serieFacturas: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{0,10}$/i, 'Solo letras, números y guiones (máx. 10)'),
})

export type EmpresaFormInput = z.input<typeof empresaSchema>
export type EmpresaFormValues = z.output<typeof empresaSchema>
