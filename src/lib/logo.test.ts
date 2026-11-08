import { describe, expect, it } from 'vitest'
import { dataUrlValido, dimensionesAjustadas, MAX_DATAURL, validarArchivoLogo } from './logo'

describe('logotipo', () => {
  it('valida tipo y tamaño del archivo', () => {
    expect(validarArchivoLogo({ type: 'image/png', size: 1000 })).toBeNull()
    expect(validarArchivoLogo({ type: 'image/svg+xml', size: 1000 })).toBeNull()
    expect(validarArchivoLogo({ type: 'application/pdf', size: 1000 })).toMatch(/PNG, JPG/)
    expect(validarArchivoLogo({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
    expect(validarArchivoLogo({ type: 'image/jpeg', size: 0 })).toMatch(/vacío/)
  })
  it('reduce manteniendo la proporción y no amplía', () => {
    expect(dimensionesAjustadas(2048, 1024)).toEqual({ ancho: 512, alto: 256 })
    expect(dimensionesAjustadas(300, 1200)).toEqual({ ancho: 128, alto: 512 })
    expect(dimensionesAjustadas(200, 80)).toEqual({ ancho: 200, alto: 80 })
    expect(() => dimensionesAjustadas(0, 10)).toThrow()
  })
  it('solo acepta dataURL WebP o PNG de tamaño razonable', () => {
    expect(dataUrlValido('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(dataUrlValido('data:image/webp;base64,UklGRg==')).toBe(true)
    expect(dataUrlValido('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(dataUrlValido('data:image/png;base64,' + 'A'.repeat(MAX_DATAURL))).toBe(false)
  })
})
