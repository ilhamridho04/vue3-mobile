import { defineStore } from 'pinia'
import type { UserState } from '@/api/user'
import { getMe } from '@/api/user'

const InitUserInfo = {
  uid: 0,
  nickname: '',
  avatar: '',
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserState>({ ...InitUserInfo })

  // Set user's information
  const setInfo = (partial: Partial<UserState>) => {
    userInfo.value = { ...partial }
  }

  const login = async () => {
    // Mobile SPA is served behind Laravel auth; use the standard web login.
    window.location.href = '/mobile-auth/login'
  }

  const info = async () => {
    try {
      const { data } = await getMe()

      setInfo({
        uid: data.user?.id,
        name: data.user?.name,
        email: data.user?.email,
        roles: data.roles || [],
        permissions: data.permissions || [],
      })
    }
    catch (error) {
      throw error
    }
  }

  const logout = async () => {
    // Logout handled by Laravel (/logout). Reset local cache only.
    setInfo({ ...InitUserInfo })
  }

  return {
    userInfo,
    login,
    info,
    logout,
  }
}, {
  persist: true,
})

export default useUserStore
