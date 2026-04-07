import { describe, expect, it, jest } from '@jest/globals'

jest.unstable_mockModule('jspdf', () => ({
  default: jest.fn()
}))

jest.unstable_mockModule('html2canvas', () => ({
  default: jest.fn()
}))

const { generateClientReportPDF, generateIndividualClientPDF } = await import('./pdfExport')

describe('pdfExport', () => {
  it('exports generateClientReportPDF', () => {
    expect(typeof generateClientReportPDF).toBe('function')
  })

  it('exports generateIndividualClientPDF', () => {
    expect(typeof generateIndividualClientPDF).toBe('function')
  })
})
