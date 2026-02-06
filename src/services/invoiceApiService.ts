import { apiRequest } from './apiService'

export interface CreateInvoiceItemRequest {
  timeEntryId?: string | null
  projectId?: string | null
  description?: string | null
  startTime?: Date | string | null
  endTime?: Date | string | null
  duration: number
  rate?: number | null
  amount?: number | null
}

export interface SendInvoiceRequest {
  pdfBase64: string
  fileName?: string | null
  subject?: string | null
  message?: string | null
}

export interface CreateInvoiceRequest {
  invoiceNumber: string
  clientId: string
  startDate: Date | string
  endDate: Date | string
  status?: 'draft' | 'sent' | 'paid' | 'void'
  notes?: string | null
  currency?: string | null
  hourlyRate?: number | null
  items: CreateInvoiceItemRequest[]
}

export interface CreateInvoiceResponse {
  success: boolean
  data: {
    id: string
    invoiceNumber: string
    status: string
    totalSeconds: number
    totalAmount: number
  }
}

export interface InvoiceDetailsResponse {
  success: boolean
  data: {
    invoice: any
    items: any[]
  }
}

export const invoiceApiService = {
  async createInvoice(payload: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
    return apiRequest<CreateInvoiceResponse>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  async getInvoices(): Promise<{ success: boolean; data: any[]; count: number }> {
    return apiRequest<{ success: boolean; data: any[]; count: number }>('/invoices')
  },

  async getInvoiceDetails(invoiceId: string): Promise<InvoiceDetailsResponse> {
    return apiRequest<InvoiceDetailsResponse>(`/invoices/${invoiceId}`)
  },

  async sendInvoice(invoiceId: string, payload: SendInvoiceRequest): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/invoices/${invoiceId}/send`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }
}
