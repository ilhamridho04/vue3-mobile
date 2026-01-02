<script setup lang="ts">
  import { showNotify } from 'vant'
  import { listWarehouses, productLookup, type WarehouseDto } from '@/api/wms'
  import { useCameraBarcodeScanner } from '@/composables/useCameraBarcodeScanner'
  import { useQuickScan } from '@/composables/useQuickScan'

  type ApiResponse<T> = {
    success: boolean
    message?: string
    data: T
  }

  type InventoryDto = {
    id: number
    warehouse_id: number
    product_id: number
    qty_available: number
    qty_reserved: number
    qty_damaged: number
    last_movement_at?: string | null
    warehouse?: {
      id: number
      code: string
      name: string
    }
  }

  type ProductDto = {
    id: number
    sku?: string | null
    name: string
    display_name?: string | null
    unit?: string | null
    active_barcode?: string | null
    minimum_stock?: number | null
    total_stock?: number | null
  }

  type ProductLookupData = {
    product: ProductDto
    inventories: InventoryDto[]
  }

  const quickScan = ref(true)
  const barcodeField = ref<any>(null)

  const cameraVideo = ref<HTMLVideoElement | null>(null)
  const camera = useCameraBarcodeScanner(cameraVideo)

  const barcode = ref('')
  const loading = ref(false)

  const warehouseId = ref<number | undefined>(undefined)
  const warehouses = ref<WarehouseDto[]>([])
  const warehouseLoading = ref(false)

  const result = ref<ProductLookupData | null>(null)

  const warehouseOptions = computed(() => {
    return [
      { text: 'Semua Gudang', value: undefined },
      ...warehouses.value.map(w => ({ text: `${w.code} - ${w.name}`, value: w.id })),
    ]
  })

  async function loadWarehouses() {
    warehouseLoading.value = true
    try {
      const res = await listWarehouses() as unknown as ApiResponse<WarehouseDto[]>
      warehouses.value = res?.data || []
    }
    catch {
      // ignore; not critical for lookup
    }
    finally {
      warehouseLoading.value = false
    }
  }

  async function runLookup() {
    const cleaned = barcode.value.trim()
    if (!cleaned)
      return

    loading.value = true
    try {
      const res = await productLookup({
        barcode: cleaned,
        warehouse_id: warehouseId.value,
      }) as unknown as ApiResponse<ProductLookupData>

      if (!res?.success) {
        result.value = null
        showNotify({ type: 'danger', message: res?.message || 'Gagal mengambil data' })
        return
      }

      result.value = res.data
    }
    catch (err: any) {
      result.value = null

      const status = err?.response?.status
      if (status === 404)
        showNotify({ type: 'warning', message: 'Product tidak ditemukan' })
      else
        showNotify({ type: 'danger', message: 'Terjadi kesalahan saat lookup' })
    }
    finally {
      loading.value = false
      scan.focus()
    }
  }

  async function onSubmit() {
    const cleaned = barcode.value.trim()
    if (!cleaned) {
      showNotify({ type: 'warning', message: 'Barcode wajib diisi' })
      return
    }
    await runLookup()
  }

  async function onBarcodeEnter() {
    await onSubmit()
  }

  async function toggleCameraScan() {
    if (camera.active.value) {
      camera.stop()
      return
    }

    if (!camera.secureContext) {
      showNotify({ type: 'warning', message: 'Kamera butuh HTTPS. Buka lewat https://wms.biforst.id/mobile/ (bukan http atau IP).' })
      return
    }

    if (!camera.mediaSupported) {
      showNotify({ type: 'warning', message: 'Browser ini tidak mendukung akses kamera (getUserMedia).' })
      return
    }

    if (!camera.barcodeSupported) {
      showNotify({ type: 'warning', message: 'Scan kamera tidak didukung di browser ini. Gunakan Chrome Android, atau pakai scanner keyboard (Scan Cepat).' })
      return
    }

    try {
      await camera.start({
        onResult: (code) => {
          barcode.value = code
        },
      })
    }
    catch (err: any) {
      const name = err?.name
      const msg =
        name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Aktifkan permission Camera di browser lalu coba lagi.'
          : name === 'NotFoundError'
            ? 'Kamera tidak ditemukan di device ini.'
            : name === 'NotReadableError'
              ? 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi lain lalu coba lagi.'
              : (err?.message || 'Gagal mengakses kamera')
      showNotify({ type: 'danger', message: msg })
    }
  }

  const scan = useQuickScan({
    enabled: quickScan,
    value: barcode,
    fieldRef: barcodeField,
    busy: loading,
    storageKey: 'wms.quickScan',
    onAuto: () => runLookup(),
    onEnter: onBarcodeEnter,
  })

  onMounted(() => {
    loadWarehouses()
    scan.focus()
  })
</script>

<template>
  <van-nav-bar title="WMS Lookup" left-arrow @click-left="$router.back()" />

  <van-cell-group inset title="Scan / Input Barcode">
    <van-cell title="Scan Cepat" :label="quickScan ? 'Aktif (auto lookup saat scan)' : 'Nonaktif'">
      <template #right-icon>
        <van-switch v-model="quickScan" size="22" />
      </template>
    </van-cell>
    <van-field ref="barcodeField" v-model="barcode" label="Barcode" placeholder="Scan atau ketik barcode" clearable
      inputmode="text" autocomplete="off" enterkeyhint="search" @keyup.enter="scan.onEnter" />

    <div class="px-4 pb-4">
      <van-button type="default" block :disabled="loading || warehouseLoading" @click="toggleCameraScan">
        {{ camera.active ? 'Stop Kamera' : 'Scan dengan Kamera' }}
      </van-button>
    </div>

    <div v-if="camera.active" class="px-4 pb-4">
      <video ref="cameraVideo" autoplay playsinline muted style="width: 100%; max-height: 240px; object-fit: cover;" />
    </div>

    <van-field label="Gudang">
      <template #input>
        <van-dropdown-menu>
          <van-dropdown-item v-model="warehouseId" :options="warehouseOptions" :disabled="warehouseLoading" />
        </van-dropdown-menu>
      </template>
    </van-field>

    <div class="px-4 pb-4">
      <van-button type="primary" block :loading="loading" :disabled="loading" @click="onSubmit">
        Lookup
      </van-button>
    </div>
  </van-cell-group>

  <template v-if="result">
    <van-cell-group inset title="Product">
      <van-cell title="Nama" :value="result.product.display_name || result.product.name" />
      <van-cell title="SKU" :value="result.product.sku || '-'" />
      <van-cell title="Unit" :value="result.product.unit || '-'" />
      <van-cell title="Barcode Aktif" :value="result.product.active_barcode || '-'" />
      <van-cell title="Minimum Stock" :value="String(result.product.minimum_stock ?? '-')" />
      <van-cell title="Total Stock" :value="String(result.product.total_stock ?? '-')" />
    </van-cell-group>

    <van-cell-group inset title="Inventories">
      <template v-if="result.inventories?.length">
        <template v-for="inv in result.inventories" :key="inv.id">
          <van-cell
            :title="inv.warehouse ? `${inv.warehouse.code} - ${inv.warehouse.name}` : `Warehouse #${inv.warehouse_id}`"
            :label="inv.last_movement_at ? `Last movement: ${inv.last_movement_at}` : undefined">
            <template #value>
              <div class="text-right">
                <div>Avail: {{ inv.qty_available }}</div>
                <div>Resv: {{ inv.qty_reserved }}</div>
                <div>Damg: {{ inv.qty_damaged }}</div>
              </div>
            </template>
          </van-cell>
        </template>
      </template>
      <van-empty v-else description="Tidak ada inventory" />
    </van-cell-group>
  </template>
</template>

<route lang="json5">
{
  name: 'WmsLookup',
  meta: {
    requiresAuth: true,
  },
}
</route>
