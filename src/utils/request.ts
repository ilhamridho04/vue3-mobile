import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { showNotify } from 'vant'

let csrfReady = false
let csrfPromise: Promise<void> | null = null

async function ensureCsrfCookie(): Promise<void> {
  if (csrfReady)
    return
  if (csrfPromise)
    return csrfPromise

  csrfPromise = axios
    .get('/sanctum/csrf-cookie', {
      baseURL: '',
      withCredentials: true,
    })
    .then(() => {
      csrfReady = true
    })
    .finally(() => {
      csrfPromise = null
    })

  return csrfPromise
}

// 创建 axios 实例
const request = axios.create({
  // API 请求的默认前缀
  baseURL: import.meta.env.VITE_APP_API_BASE_URL || '/api',
  timeout: 6000, // 请求超时时间
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
})

export type RequestError = AxiosError<{
  message?: string
  result?: any
  errorMessage?: string
}>

// 异常拦截处理器
function errorHandler(error: RequestError): Promise<any> {
  if (error.response) {
    const { data = {}, status, statusText } = error.response
    // 403 无权限
    if (status === 403) {
      showNotify({
        type: 'danger',
        message: (data && data.message) || statusText,
      })
    }
    // 401 未登录/未授权
    if (status === 401) {
      showNotify({
        type: 'danger',
        message: (data && data.message) || 'Unauthenticated',
      })

      // If session expired, bounce to Laravel login
      try {
        window.location.href = '/mobile-auth/login'
      }
      catch { }
    }

    // 419 CSRF token mismatch / Page expired
    if (status === 419) {
      csrfReady = false
    }
  }
  return Promise.reject(error)
}

// 请求拦截器
async function requestHandler(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  const method = (config.method || 'get').toLowerCase()

  // For state-changing requests, ensure Sanctum CSRF cookie is set
  if (['post', 'put', 'patch', 'delete'].includes(method))
    await ensureCsrfCookie()

  return config
}

// Add a request interceptor
request.interceptors.request.use(requestHandler, errorHandler)

// 响应拦截器
function responseHandler(response: { data: any }) {
  return response.data
}

// Add a response interceptor
request.interceptors.response.use(responseHandler, errorHandler)

export default request
