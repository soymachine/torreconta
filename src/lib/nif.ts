/** Validación de identificadores fiscales españoles: DNI, NIE y CIF. */

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

export function normalizeNif(value: string): string {
  return value.toUpperCase().replace(/[\s.-]/g, '')
}

function validDni(nif: string): boolean {
  const m = /^(\d{8})([A-Z])$/.exec(nif)
  return !!m && LETRAS_DNI[Number(m[1]) % 23] === m[2]
}

function validNie(nif: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(nif)
  if (!m) return false
  const prefix = { X: '0', Y: '1', Z: '2' }[m[1] as 'X' | 'Y' | 'Z']
  return LETRAS_DNI[Number(prefix + m[2]) % 23] === m[3]
}

function validCif(nif: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(nif)
  if (!m) return false
  const digits = m[2]
  let sum = 0
  for (let i = 0; i < 7; i++) {
    let d = Number(digits[i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  const control = (10 - (sum % 10)) % 10
  const letter = 'JABCDEFGHI'[control]
  const type = m[1]
  const check = m[3]
  if ('PQRSNW'.includes(type)) return check === letter
  if ('ABEH'.includes(type)) return check === String(control)
  return check === String(control) || check === letter
}

export type TipoNif = 'DNI' | 'NIE' | 'CIF'

export function tipoNif(value: string): TipoNif | null {
  const nif = normalizeNif(value)
  if (validDni(nif)) return 'DNI'
  if (validNie(nif)) return 'NIE'
  if (validCif(nif)) return 'CIF'
  return null
}

export function isValidNif(value: string): boolean {
  return tipoNif(value) !== null
}
