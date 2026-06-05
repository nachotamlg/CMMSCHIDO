const API_BASE_URL = typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    console.log("[v0] ApiClient initialized - using proxy at:", baseUrl)
  }

  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem("authToken")
  }

  private getUserId(): string | null {
    if (typeof window === "undefined") {
      return null
    }
    
    try {
      const userId = localStorage.getItem("userId")
      
      if (!userId || userId === "null" || userId === "0" || userId === "") {
        return null
      }
      
      return userId
    } catch (error) {
      console.error("[v0] Error accessing localStorage:", error)
      return null
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}, params?: Record<string, any>, userId?: string): Promise<T> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    let url = `${this.baseUrl}${normalizedEndpoint}`

    if (typeof window !== 'undefined' && !url.startsWith('http')) {
      url = `${window.location.origin}${url}`
    }

    if (params) {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
      const queryString = queryParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const token = this.getAuthToken()
    const finalUserId = userId || this.getUserId()
    
    console.log('[v0] API Request details:', {
      method: options.method || 'GET',
      endpoint,
      url,
      hasToken: !!token,
      userId: finalUserId,
      userIdType: typeof finalUserId
    })
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    if (finalUserId) {
      const userIdString = String(finalUserId)
      headers["X-User-ID"] = userIdString
      console.log(`[v0] Adding X-User-ID header: ${userIdString} (type: ${typeof userIdString})`)
    } else {
      console.warn(`[v0] Sending request to ${endpoint} WITHOUT User ID`)
    }

    console.log(`[v0] Making request to: ${url}`)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `API error: ${response.status} ${response.statusText}${errorData.message ? ` - ${errorData.message}` : ""}`,
        )
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Request timeout - El servidor no responde. Verifica la conexión.",
          )
        }
      }
      throw error
    }
  }

  get<T>(endpoint: string, params?: Record<string, any>, userId?: string) {
    return this.request<T>(endpoint, { method: "GET" }, params, userId)
  }

  post<T>(endpoint: string, body: unknown, userId?: string) {
    const finalUserId = userId || this.getUserId()
    const bodyWithUserId = body && typeof body === 'object' 
      ? { ...body, usuario_id: finalUserId ? parseInt(finalUserId) : undefined }
      : body
    
    console.log('[v0] POST body:', bodyWithUserId)
    
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(bodyWithUserId),
    }, undefined, finalUserId)
  }

  put<T>(endpoint: string, body: unknown, userId?: string) {
    const finalUserId = userId || this.getUserId()
    const bodyWithUserId = body && typeof body === 'object' 
      ? { ...body, usuario_id: finalUserId ? parseInt(finalUserId) : undefined }
      : body
    
    console.log('[v0] PUT body:', bodyWithUserId)
    
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(bodyWithUserId),
    }, undefined, finalUserId)
  }

  delete<T>(endpoint: string, params?: Record<string, any>, userId?: string) {
    const finalUserId = userId || this.getUserId()
    return this.request<T>(endpoint, { method: "DELETE" }, params, finalUserId)
  }

  patch<T>(endpoint: string, body: unknown, userId?: string) {
    const finalUserId = userId || this.getUserId()
    const bodyWithUserId = body && typeof body === 'object' 
      ? { ...body, usuario_id: finalUserId ? parseInt(finalUserId) : undefined }
      : body
    
    console.log('[v0] PATCH body:', bodyWithUserId)
    
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(bodyWithUserId),
    }, undefined, finalUserId)
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
