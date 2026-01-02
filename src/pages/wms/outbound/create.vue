<script setup lang="ts">
  import { showConfirmDialog, showNotify } from 'vant'
  import {
    createOutbound,
    listWarehouses,
    productLookup,
  } from '@/api/wms'
  import type { WarehouseDto } from '@/api/wms'
  import { useCameraBarcodeScanner } from '@/composables/useCameraBarcodeScanner'
  import { useQuickScan } from '@/composables/useQuickScan'
  import { useVariantActionSheetPicker } from '@/composables/useVariantActionSheet'

  interface ApiResponse<T> {
    success: boolean
    message?: string
    data: T
  }

  interface ProductLookupData {
    product: {
      id: number
      sku?: string | null
      name: string
      display_name?: string | null
      unit?: string | null
      has_variants?: boolean | null
    }
    variant?: {
      id: number
      variant_name: string
      variant_sku?: string | null
      variant_barcode?: string | null
    } | null
    variants?: Array<{
      id: number
      product_id: number
      variant_name: string
      variant_sku?: string | null
      variant_barcode?: string | null
    }>
    inventories?: Array<{
      id: number
      warehouse_id: number
      product_id: number
      product_variant_id?: number | null
      qty_available: number
    }>
  }

  interface ProductSearchItem {
    id: number
    sku?: string | null
    name: string
    display_name?: string | null
    unit?: string | null
    original_barcode?: string | null
    system_barcode?: string | null
  }

  interface CreateOutboundItem {
    product_id: number
    product_variant_id?: number | null
    product_label: string
    variant_label?: string
    qty_requested: number
    qty_delivered: number
    unit: string
    notes?: string
    available_stock?: number
  }

  const router = useRouter()

  const warehouseLoading = ref(false)
  const warehouses = ref<WarehouseDto[]>([])

  const form = reactive({
    warehouse_id: undefined as number | undefined,
    customer_name: '',
    customer_contact: '',
    delivery_address: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    driver_name: '',
    vehicle_number: '',
    notes: '',
  })

  const quickScan = ref(true)
  const barcodeField = ref<any>(null)

  const addMode = ref<'scan' | 'search'>('scan')
  const searchQuery = ref('')
  const searching = ref(false)
  const searchResults = ref<ProductSearchItem[]>([])

  const { variantSheet, pickVariantAction, onVariantSelect, onVariantCancel } = useVariantActionSheetPicker()

  const cameraVideo = ref<HTMLVideoElement | null>(null)
  const camera = useCameraBarcodeScanner(cameraVideo)

  const barcode = ref('')
  const adding = ref(false)
  const submitting = ref(false)

  const items = ref<CreateOutboundItem[]>([])

  const warehouseOptions = computed(() => {
    return warehouses.value.map(w => ({ text: `${w.code} - ${w.name}`, value: w.id }))
  })

  async function loadWarehouses() {
    warehouseLoading.value = true
    try {
      const res = await listWarehouses() as unknown as ApiResponse<WarehouseDto[]>
      warehouses.value = res?.data || []
    }
    catch {
      // ignore
    }
    finally {
      warehouseLoading.value = false
    }
  }

  async function lookupAndAdd(code: string) {
    if (!form.warehouse_id) {
      showNotify({ type: 'warning', message: 'Gudang wajib dipilih sebelum tambah item' })
      return
    }

    const cleaned = (code || '').trim()
    if (!cleaned) {
      showNotify({ type: 'warning', message: 'Barcode / SKU wajib diisi' })
      return
    }

    adding.value = true
    try {
      const res = await productLookup({ barcode: cleaned, warehouse_id: form.warehouse_id }) as unknown as ApiResponse<ProductLookupData>
      if (!res?.success) {
        showNotify({ type: 'danger', message: res?.message || 'Gagal lookup product' })
        return
      }

      // If product has variants and we didn't resolve a specific variant yet, ask user.
      if (!res.data.variant && (res.data.variants?.length || 0) > 0) {
        const picked: any = await pickVariantAction(res.data.variants!)
        if (!picked)
          return

        if (picked?.key?.startsWith('v:')) {
          const v = picked.variant as ProductLookupData['variants'][number]
          const vCode = v.variant_barcode || v.variant_sku
          if (vCode) {
            await lookupAndAdd(vCode)
            return
          }
        }
      }

      const p = res.data.product
      const label = p.display_name || p.name

      const variant = res.data.variant
      const variantId = variant?.id ?? null
      const variantLabel = variant ? `${variant.variant_name}${variant.variant_sku ? ` (${variant.variant_sku})` : ''}` : undefined

      const inv = (res.data.inventories || []).find(x => (x.product_variant_id ?? null) === variantId)
      const available = inv?.qty_available ?? 0

      const existingIndex = items.value.findIndex(i => i.product_id === p.id && (i.product_variant_id ?? null) === variantId)
      if (existingIndex >= 0) {
        items.value[existingIndex].qty_requested += 1
        items.value[existingIndex].qty_delivered = items.value[existingIndex].qty_requested
        items.value[existingIndex].available_stock = available
        showNotify({ type: 'success', message: `Tambah qty: ${variantLabel ? `${label} - ${variantLabel}` : label}` })
      }
      else {
        items.value.push({
          product_id: p.id,
          product_variant_id: variantId,
          product_label: label,
          variant_label: variantLabel,
          qty_requested: 1,
          qty_delivered: 1,
          unit: p.unit || 'pcs',
          available_stock: available,
        })
        showNotify({ type: 'success', message: `Ditambahkan: ${variantLabel ? `${label} - ${variantLabel}` : label}` })
      }

      if (available === 0) {
        showNotify({ type: 'warning', message: 'Stock 0 untuk item ini (cek gudang/variant)' })
      }
    }
    catch (err: any) {
      const status = err?.response?.status
      if (status === 404)
        showNotify({ type: 'warning', message: 'Product tidak ditemukan' })
      else
        showNotify({ type: 'danger', message: 'Gagal menambah item' })
    }
    finally {
      adding.value = false
    }
  }

  async function addItemByBarcode() {
    const code = barcode.value
    await lookupAndAdd(code)
    barcode.value = ''
  }

  async function searchProducts() {
    if (!form.warehouse_id) {
      showNotify({ type: 'warning', message: 'Pilih gudang dulu sebelum search' })
      return
    }

    const q = searchQuery.value.trim()
    if (!q) {
      searchResults.value = []
      return
    }

    searching.value = true
    try {
      const res = await productLookup({ query: q, limit: 10, warehouse_id: form.warehouse_id }) as unknown as ApiResponse<ProductSearchItem[]>
      searchResults.value = Array.isArray(res?.data) ? res.data : []
    }
    catch {
      searchResults.value = []
    }
    finally {
      searching.value = false
    }
  }

  async function addFromSearch(p: ProductSearchItem) {
    const code = p.sku || p.system_barcode || p.original_barcode
    if (!code) {
      showNotify({ type: 'warning', message: 'Produk ini tidak punya SKU/barcode' })
      return
    }
    await lookupAndAdd(code)
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

  async function removeItem(index: number) {
    try {
      await showConfirmDialog({
        title: 'Hapus item',
        message: `Hapus item: ${items.value[index]?.product_label || ''}?`,
        confirmButtonText: 'Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ee0a24',
      })
    }
    catch {
      return
    }

    items.value.splice(index, 1)
  }

  async function submit() {
    if (!form.warehouse_id) {
      showNotify({ type: 'warning', message: 'Gudang wajib dipilih' })
      return
    }
    if (!form.customer_name.trim()) {
      showNotify({ type: 'warning', message: 'Customer wajib diisi' })
      return
    }
    if (!form.delivery_address.trim()) {
      showNotify({ type: 'warning', message: 'Alamat wajib diisi' })
      return
    }
    if (!form.delivery_date) {
      showNotify({ type: 'warning', message: 'Tanggal wajib diisi' })
      return
    }
    if (!items.value.length) {
      showNotify({ type: 'warning', message: 'Minimal 1 item' })
      return
    }

    submitting.value = true
    try {
      const payload = {
        warehouse_id: form.warehouse_id,
        customer_name: form.customer_name,
        customer_contact: form.customer_contact || undefined,
        delivery_address: form.delivery_address,
        delivery_date: form.delivery_date,
        driver_name: form.driver_name || undefined,
        vehicle_number: form.vehicle_number || undefined,
        notes: form.notes || undefined,
        items: items.value.map(i => ({
          product_id: i.product_id,
          product_variant_id: i.product_variant_id ?? undefined,
          qty_requested: i.qty_requested,
          // Web app aligns qty_delivered with qty_requested at create time
          qty_delivered: i.qty_requested,
          unit: i.unit,
          notes: i.notes || undefined,
        })),
      }

      const res = await createOutbound(payload) as unknown as ApiResponse<{ id: number, delivery_number: string, sj_number?: string, do_number?: string }>
      if (!res?.success) {
        showNotify({ type: 'danger', message: res?.message || 'Gagal create outbound' })
        return
      }

      showNotify({ type: 'success', message: res?.message || 'Outbound dibuat' })

      const newId = res.data?.id
      if (newId)
        router.replace(`/wms/outbound/${newId}`)
      else
        router.back()
    }
    catch (err: any) {
      showNotify({ type: 'danger', message: err?.response?.data?.message || 'Gagal submit outbound' })
    }
    finally {
      submitting.value = false
    }
  }

  const scan = useQuickScan({
    enabled: quickScan,
    value: barcode,
    fieldRef: barcodeField,
    busy: adding,
    storageKey: 'wms.quickScan',
    onAuto: addItemByBarcode,
    onEnter: addItemByBarcode,
  })

  onMounted(loadWarehouses)
  onMounted(() => {
    scan.focus()
  })

  watch(addMode, (mode) => {
    if (mode !== 'scan' && camera.active.value)
      camera.stop()
    if (mode === 'scan')
      scan.focus()
  })
</script>

<template>
  <van-nav-bar title="Create Outbound" left-arrow @click-left="$router.back()" />

  <van-cell-group inset title="Header">
    <van-field label="Gudang">
      <template #input>
        <van-dropdown-menu>
          <van-dropdown-item v-model="form.warehouse_id" :options="warehouseOptions" :disabled="warehouseLoading" />
        </van-dropdown-menu>
      </template>
    </van-field>

    <van-field v-model="form.customer_name" label="Customer" placeholder="Nama customer" />
    <van-field v-model="form.customer_contact" label="Contact" placeholder="Optional" />
    <van-field v-model="form.delivery_address" label="Alamat" type="textarea" rows="2" autosize
      placeholder="Alamat pengiriman" />
    <van-field v-model="form.delivery_date" label="Tanggal" type="date" />
    <van-field v-model="form.driver_name" label="Driver" placeholder="Optional" />
    <van-field v-model="form.vehicle_number" label="Vehicle" placeholder="Optional" />
    <van-field v-model="form.notes" label="Notes" type="textarea" rows="2" autosize />
  </van-cell-group>

  <van-cell-group inset title="Tambah Item">
    <van-tabs v-model:active="addMode">
      <van-tab name="scan" title="Scan">
        <van-cell title="Scan Cepat" :label="quickScan ? 'Aktif (auto tambah saat scan)' : 'Nonaktif'">
          <template #right-icon>
            <van-switch v-model="quickScan" size="22" />
          </template>
        </van-cell>

        <van-field ref="barcodeField" v-model="barcode" label="Barcode" placeholder="Scan / input barcode" clearable
          @keyup.enter="scan.onEnter" />

        <div class="px-4 pb-4">
          <van-button type="default" block :disabled="adding || submitting" @click="toggleCameraScan">
            {{ camera.active ? 'Stop Kamera' : 'Scan dengan Kamera' }}
          </van-button>
        </div>

        <div v-if="camera.active" class="px-4 pb-4">
          <video ref="cameraVideo" autoplay playsinline muted
            style="width: 100%; max-height: 240px; object-fit: cover;" />
        </div>

        <div class="px-4 pb-4">
          <van-button type="primary" block :loading="adding" :disabled="adding" @click="addItemByBarcode">
            Tambah Item
          </van-button>
        </div>
      </van-tab>

      <van-tab name="search" title="Search">
        <van-search v-model="searchQuery" placeholder="Cari nama / SKU / barcode"
          :disabled="searching || adding || submitting" @search="searchProducts" />

        <div class="px-4 pb-4">
          <van-button type="primary" block :loading="searching" :disabled="searching || adding || submitting"
            @click="searchProducts">
            Cari
          </van-button>
        </div>

        <van-cell-group inset>
          <template v-if="searchResults.length">
            <van-cell v-for="p in searchResults" :key="p.id" :title="p.display_name || p.name"
              :label="p.sku ? `SKU: ${p.sku}` : undefined" is-link @click="addFromSearch(p)" />
          </template>
          <van-empty v-else description="Belum ada hasil" />
        </van-cell-group>
      </van-tab>
    </van-tabs>
  </van-cell-group>

  <van-cell-group inset title="Items">
    <template v-if="items.length">
      <template v-for="(it, idx) in items" :key="it.product_id">
        <van-cell :title="it.product_label" :label="it.variant_label ? `Variant: ${it.variant_label}` : undefined">
          <template #value>
            <van-button size="small" type="danger" plain @click="removeItem(idx)">Hapus</van-button>
          </template>
        </van-cell>

        <van-cell title="Available Stock">
          <template #value>
            <span :style="{ color: (it.available_stock ?? 0) > 0 ? 'inherit' : '#ee0a24' }">
              {{ it.available_stock ?? 0 }}
            </span>
          </template>
        </van-cell>

        <van-cell title="Qty Requested">
          <template #value>
            <van-stepper v-model="it.qty_requested" min="0"
              @change="() => { if (it.qty_delivered > it.qty_requested) it.qty_delivered = it.qty_requested }" />
          </template>
        </van-cell>

        <van-cell title="Qty Delivered">
          <template #value>
            <van-stepper v-model="it.qty_delivered" min="0" :max="it.qty_requested" />
          </template>
        </van-cell>

        <van-field v-model="it.unit" label="Unit" placeholder="pcs" />
        <van-field v-model="it.notes" label="Notes" placeholder="Optional" />
      </template>
    </template>
    <van-empty v-else description="Belum ada item" />
  </van-cell-group>

  <div class="p-4">
    <van-button type="success" block :loading="submitting" :disabled="submitting" @click="submit">
      Submit Outbound
    </van-button>
  </div>

  <van-action-sheet v-model:show="variantSheet.show" :actions="variantSheet.actions" cancel-text="Batal"
    close-on-click-action @select="onVariantSelect" @cancel="onVariantCancel" />
</template>

<route lang="json5">
{
  name: 'WmsOutboundCreate',
  meta: {
    requiresAuth: true,
  },
}
</route>
