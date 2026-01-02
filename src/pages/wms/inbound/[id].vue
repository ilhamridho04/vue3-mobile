<script setup lang="ts">
import { showConfirmDialog, showNotify } from 'vant'
import { cancelInbound, getInbound, verifyInbound } from '@/api/wms'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

type ReceiptItem = {
  id: number
  product_id: number
  product_variant_id?: number | null
  qty_ordered: number
  qty_received: number
  qty_damaged: number
  unit: string
  notes?: string | null
  product?: {
    id: number
    sku?: string | null
    name: string
    display_name?: string | null
  }
  product_variant?: {
    id: number
    name: string
  } | null
}

type ReceiptDetails = {
  id: number
  receipt_number: string
  supplier_name: string
  supplier_contact?: string | null
  receipt_date: string
  status: 'pending' | 'completed' | 'cancelled' | string
  notes?: string | null
  warehouse?: {
    id: number
    code: string
    name: string
  }
  received_by?: number | null
  verified_by?: number | null
  received_by_at?: string | null
  verified_at?: string | null
  received_by_user?: { id: number, name: string } | null
  verified_by_user?: { id: number, name: string } | null
  receivedBy?: { id: number, name: string } | null
  verifiedBy?: { id: number, name: string } | null
  items: ReceiptItem[]
}

const route = useRoute()
const id = computed(() => Number((route.params as any).id))

const loading = ref(false)
const actionLoading = ref(false)
const receipt = ref<ReceiptDetails | null>(null)

async function load() {
  if (!id.value || Number.isNaN(id.value)) {
    showNotify({ type: 'danger', message: 'ID inbound tidak valid' })
    return
  }

  loading.value = true
  try {
    const res = await getInbound(id.value) as unknown as ApiResponse<ReceiptDetails>
    if (!res?.success) {
      receipt.value = null
      showNotify({ type: 'danger', message: res?.message || 'Gagal memuat detail inbound' })
      return
    }

    receipt.value = res.data
  }
  catch (err: any) {
    receipt.value = null
    const status = err?.response?.status
    if (status === 404)
      showNotify({ type: 'warning', message: 'Inbound tidak ditemukan' })
    else
      showNotify({ type: 'danger', message: 'Terjadi kesalahan saat memuat detail' })
  }
  finally {
    loading.value = false
  }
}

const canVerify = computed(() => receipt.value?.status === 'pending')
const canCancel = computed(() => receipt.value?.status !== 'completed' && receipt.value?.status !== 'cancelled')

async function onVerify() {
  if (!receipt.value)
    return

  try {
    await showConfirmDialog({
      title: 'Verify Inbound',
      message: 'Verifikasi inbound akan menambah stock sesuai qty_received - qty_damaged. Lanjutkan?',
      confirmButtonText: 'Verify',
      cancelButtonText: 'Batal',
    })
  }
  catch {
    return
  }

  actionLoading.value = true
  try {
    const res = await verifyInbound(receipt.value.id) as unknown as ApiResponse<null>
    if (!res?.success) {
      showNotify({ type: 'danger', message: res?.message || 'Gagal verify' })
      return
    }

    showNotify({ type: 'success', message: res?.message || 'Verified' })
    await load()
  }
  catch (err: any) {
    showNotify({ type: 'danger', message: err?.response?.data?.message || 'Gagal verify inbound' })
  }
  finally {
    actionLoading.value = false
  }
}

async function onCancel() {
  if (!receipt.value)
    return

  try {
    await showConfirmDialog({
      title: 'Cancel Inbound',
      message: 'Batalkan inbound ini?',
      confirmButtonText: 'Cancel',
      confirmButtonColor: '#ee0a24',
      cancelButtonText: 'Batal',
    })
  }
  catch {
    return
  }

  actionLoading.value = true
  try {
    const res = await cancelInbound(receipt.value.id) as unknown as ApiResponse<null>
    if (!res?.success) {
      showNotify({ type: 'danger', message: res?.message || 'Gagal cancel' })
      return
    }

    showNotify({ type: 'success', message: res?.message || 'Cancelled' })
    await load()
  }
  catch (err: any) {
    showNotify({ type: 'danger', message: err?.response?.data?.message || 'Gagal cancel inbound' })
  }
  finally {
    actionLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <van-nav-bar title="Inbound Detail" left-arrow @click-left="$router.back()" />

  <van-skeleton title :row="8" :loading="loading">
    <template v-if="receipt">
      <van-cell-group inset title="Info">
        <van-cell title="Receipt" :value="receipt.receipt_number" />
        <van-cell title="Supplier" :value="receipt.supplier_name" />
        <van-cell title="Tanggal" :value="receipt.receipt_date" />
        <van-cell title="Gudang" :value="receipt.warehouse ? `${receipt.warehouse.code} - ${receipt.warehouse.name}` : '-'" />
        <van-cell title="Status">
          <template #value>
            <van-tag
              :type="receipt.status === 'completed' ? 'success' : receipt.status === 'cancelled' ? 'danger' : 'primary'"
            >
              {{ receipt.status }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell v-if="receipt.notes" title="Notes" :label="receipt.notes" />
      </van-cell-group>

      <div class="px-4 py-3 flex gap-2">
        <van-button
          type="primary"
          block
          :loading="actionLoading"
          :disabled="actionLoading || !canVerify"
          @click="onVerify"
        >
          Verify
        </van-button>
        <van-button
          type="danger"
          block
          :loading="actionLoading"
          :disabled="actionLoading || !canCancel"
          @click="onCancel"
        >
          Cancel
        </van-button>
      </div>

      <van-cell-group inset title="Items">
        <template v-if="receipt.items?.length">
          <template v-for="item in receipt.items" :key="item.id">
            <van-cell
              :title="item.product?.display_name || item.product?.name || `Product #${item.product_id}`"
              :label="item.product?.sku ? `SKU: ${item.product.sku}` : undefined"
            >
              <template #value>
                <div class="text-right">
                  <div>Recv: {{ item.qty_received }} {{ item.unit }}</div>
                  <div class="text-xs">Damg: {{ item.qty_damaged }}</div>
                  <div class="text-xs">Ord: {{ item.qty_ordered }}</div>
                </div>
              </template>
            </van-cell>
            <van-cell v-if="item.notes" title="Item Notes" :label="item.notes" />
          </template>
        </template>
        <van-empty v-else description="Tidak ada item" />
      </van-cell-group>
    </template>

    <van-empty v-else description="Tidak ada data" />
  </van-skeleton>
</template>

<route lang="json5">
{
  name: 'WmsInboundDetail',
  meta: {
    requiresAuth: true,
  },
}
</route>
