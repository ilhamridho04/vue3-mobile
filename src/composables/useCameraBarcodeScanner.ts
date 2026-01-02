import { onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'

export type CameraScanOptions = {
    // Called once a barcode is detected (scanner auto-stops after first hit).
    onResult: (code: string) => void
    // Optional BarcodeDetector formats; if omitted, browser defaults are used.
    formats?: string[]
}

export function useCameraBarcodeScanner(videoEl: Ref<HTMLVideoElement | null>) {
    const active = ref(false)

    const secureContext = typeof window !== 'undefined' && window.isSecureContext
    const mediaSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    const barcodeSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

    // Backward-compat for existing pages.
    const supported = barcodeSupported

    let stream: MediaStream | null = null
    let rafId: number | null = null
    let detector: BarcodeDetector | null = null

    const stop = () => {
        active.value = false

        if (rafId != null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }

        if (stream) {
            for (const track of stream.getTracks())
                track.stop()
            stream = null
        }

        detector = null

        const video = videoEl.value
        if (video)
            video.srcObject = null
    }

    const start = async (options: CameraScanOptions) => {
        if (!secureContext)
            throw new Error('Kamera butuh HTTPS. Buka lewat https:// atau localhost.')

        if (!mediaSupported)
            throw new Error('Browser tidak mendukung akses kamera (getUserMedia).')

        if (!barcodeSupported)
            throw new Error('BarcodeDetector is not supported')

        // Stop any previous session
        stop()

        const video = videoEl.value
        if (!video)
            throw new Error('Video element is not mounted')

        // Ensure iOS Safari behaves.
        try {
            video.setAttribute('playsinline', 'true')
            video.setAttribute('muted', 'true')
            video.autoplay = true
            video.muted = true
            // @ts-ignore Safari/iOS
            video.playsInline = true
        }
        catch {
            // ignore
        }

        const preferred: MediaStreamConstraints = {
            video: {
                facingMode: { ideal: 'environment' },
            },
            audio: false,
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia(preferred)
        }
        catch {
            // Some devices/browsers choke on facingMode constraints; fall back.
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }

        video.srcObject = stream

        // Some browsers require a direct play call.
        try {
            await video.play()
        }
        catch {
            // ignore
        }

        active.value = true
        detector = new BarcodeDetector(options.formats ? { formats: options.formats } : undefined)

        const tick = async () => {
            if (!active.value || !detector || !videoEl.value)
                return

            try {
                const codes = await detector.detect(videoEl.value)
                const hit = codes?.[0]?.rawValue?.trim()
                if (hit) {
                    stop()
                    options.onResult(hit)
                    return
                }
            }
            catch {
                // ignore detection errors; keep scanning
            }

            rafId = requestAnimationFrame(() => {
                void tick()
            })
        }

        void tick()
    }

    onBeforeUnmount(() => {
        stop()
    })

    return {
        active,
        supported,
        secureContext,
        mediaSupported,
        barcodeSupported,
        start,
        stop,
    }
}
