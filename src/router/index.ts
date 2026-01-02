import { createRouter, createWebHistory } from 'vue-router'
import { handleHotUpdate, routes } from 'vue-router/auto-routes'

import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

import type { EnhancedRouteLocation } from './types'
import { useRouteCacheStore, useUserStore } from '@/stores'
import setPageTitle from '@/utils/set-page-title'

NProgress.configure({ showSpinner: true, parent: '#app' })

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_APP_PUBLIC_PATH),
  routes,
})

// This will update routes at runtime without reloading the page
if (import.meta.hot)
  handleHotUpdate(router)

router.beforeEach(async (to: EnhancedRouteLocation) => {
  NProgress.start()

  // Mobile app is worker-focused: default landing goes to WMS.
  // This ensures /mobile redirects to /mobile/wms (SPA path: /wms).
  if (to.path === '/')
    return { path: '/wms', replace: true }

  const routeCacheStore = useRouteCacheStore()
  const userStore = useUserStore()

  // Route cache
  routeCacheStore.addRoute(to)

  // Set page title
  setPageTitle(to.name)

  if (!userStore.userInfo?.uid) {
    try {
      await userStore.info()
    }
    catch {
      // If unauthenticated, Laravel will redirect anyway (route protected).
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})

export default router
