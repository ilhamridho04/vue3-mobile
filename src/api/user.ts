import request from '@/utils/request'

export interface LoginData {
  email: string
  password: string
}

export interface UserState {
  uid?: number
  name?: string
  avatar?: string
  email?: string
  roles?: string[]
  permissions?: string[]
}

// NOTE: For this WMS mobile SPA we use Laravel web login + Sanctum cookies.
// Login/logout are handled by Laravel routes; mobile app only needs /mobile/me.

export function getMe() {
  return request.get('/mobile/me')
}

export function getEmailCode(): Promise<any> {
  return request.get('/user/email-code')
}

export function resetPassword(): Promise<any> {
  return request.post('/user/reset-password')
}

export function register(): Promise<any> {
  return request.post('/user/register')
}
