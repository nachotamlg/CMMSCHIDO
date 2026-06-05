import { apiClient } from "./client"

// All requests go through apiClient which uses Next.js API routes

export interface Documento {
  id: number
  nombre: string
  tipo?: string
  tamanio_kb?: number
  url_archivo?: string
  subido_por?: number
  subidoPor?: {
    id: number
    nombre: string
    email: string
  }
  created_at: string
  id_orden?: number | null
  id_equipo: number
}

export interface DocumentoResponse {
  data: Documento[]
}

// Get all documents for an equipment
export async function getDocumentos(equipoId: number): Promise<Documento[]> {
  const response = await apiClient.get<DocumentoResponse>(`/equipos/${equipoId}/documentos`)
  return response.data
}

export async function uploadDocumento(
  equipoId: number,
  file: File,
  subidoPorId: number,
  token?: string,
): Promise<Documento> {
  console.log('[v0] uploadDocumento - starting upload for equipment:', equipoId)
  
  const uploadUrl = `/api/equipos/${equipoId}/documentos`
  console.log('[v0] uploadDocumento - uploading to:', uploadUrl)

  const formData = new FormData()
  formData.append("archivo", file)
  formData.append("subido_por_id", subidoPorId.toString())

  console.log('[v0] uploadDocumento - making request with formData')
  const headers: HeadersInit = {}
  
  // Add Bearer token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    console.log('[v0] uploadDocumento - added Bearer token')
  }

  // Fetch with credentials: cookies will be sent automatically
  const response = await fetch(uploadUrl, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  })

  console.log('[v0] uploadDocumento - response status:', response.status)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.log('[v0] uploadDocumento - error response:', errorText)
    try {
      const errorData = JSON.parse(errorText)
      throw new Error(errorData.error || `Failed to upload document: ${response.statusText}`)
    } catch (e) {
      throw new Error(`Failed to upload document: ${response.statusText}`)
    }
  }

  const result = await response.json()
  const documento = result.data || result
  console.log('[v0] uploadDocumento - document created successfully:', documento.id)
  return documento
}

export async function downloadDocumento(documentoId: number): Promise<Blob> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null

  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  
  // Add X-User-ID as fallback for cross-origin auth
  if (userId) {
    headers["X-User-ID"] = userId
  }

  console.log('[v0] downloadDocumento - requesting:', `/api/documentos/${documentoId}/download`)
  console.log('[v0] downloadDocumento - headers:', Object.keys(headers))

  const response = await fetch(`/api/documentos/${documentoId}/download`, {
    method: "GET",
    headers,
    credentials: "include",
  })

  console.log('[v0] downloadDocumento - response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[v0] downloadDocumento - error:', errorText)
    throw new Error(`Error al descargar documento: ${response.status}`)
  }

  return await response.blob()
}

export async function deleteDocumento(documentoId: number): Promise<void> {
  await apiClient.delete(`/documentos/${documentoId}`)
}

export function getDocumentoUrl(urlArchivo: string): string {
  if (urlArchivo.startsWith("http")) {
    return urlArchivo
  }
  // Use Next.js storage endpoint
  return `/api/storage/${urlArchivo}`
}
