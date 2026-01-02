import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

type QuickScanOptions = {
  enabled: Ref<boolean>
  value: Ref<string>
  fieldRef?: Ref<any>
  busy?: Ref<boolean>
  debounceMs?: number
  dedupeMs?: number
  storageKey?: string
  onAuto: () => Promise<void> | void
  onEnter?: () => Promise<void> | void
}

export function useQuickScan(options: QuickScanOptions) {
  const debounceMs = options.debounceMs ?? 180
  const dedupeMs = options.dedupeMs ?? 600

  if (options.storageKey && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(options.storageKey)
      if (raw === '0' || raw === 'false')
        options.enabled.value = false
      else if (raw === '1' || raw === 'true')
        options.enabled.value = true
    }
    catch {
      // ignore
    }
  }

  let scanTimer: ReturnType<typeof setTimeout> | null = null
  let locked = false
  let lastAction: { code: string, at: number } | null = null

  const clearTimer = () => {
    if (scanTimer) {
      clearTimeout(scanTimer)
      scanTimer = null
    }
  }

  const focus = async () => {
    await nextTick()
    const el = options.fieldRef?.value?.$el as HTMLElement | undefined
    const input = el?.querySelector('input') as HTMLInputElement | null
    input?.focus()
    input?.select?.()
  }

  const shouldSkip = (code: string) => {
    const now = Date.now()
    if (!code)
      return true
    if (lastAction && lastAction.code === code && (now - lastAction.at) < dedupeMs)
      return true
    return false
  }

  const run = async (fn: () => Promise<void> | void) => {
    clearTimer()

    const code = (options.value.value || '').trim()
    if (shouldSkip(code))
      return

    if (locked)
      return
    locked = true

    try {
      await fn()
    }
    finally {
      lastAction = { code, at: Date.now() }
      locked = false
      focus()
    }
  }

  const onEnter = async () => {
    await run(options.onEnter ?? options.onAuto)
  }

  watch(options.enabled, (enabled) => {
    if (options.storageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(options.storageKey, enabled ? '1' : '0')
      }
      catch {
        // ignore
      }
    }
    if (enabled)
      focus()
  })

  watch(options.value, (value) => {
    if (!options.enabled.value)
      return
    if (options.busy?.value)
      return

    const trimmed = (value || '').trim()
    if (!trimmed)
      return

    clearTimer()
    scanTimer = setTimeout(() => {
      if (!options.enabled.value)
        return
      if (options.busy?.value)
        return
      if (((options.value.value || '').trim()) !== trimmed)
        return

      run(options.onAuto)
    }, debounceMs)
  })

  onBeforeUnmount(() => {
    clearTimer()
  })

  return {
    focus,
    onEnter,
    clearTimer,
  }
}
