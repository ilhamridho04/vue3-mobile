<script setup lang="ts">
import { showConfirmDialog, showNotify } from 'vant'
import {
  cancelOutbound,
  deliveredOutbound,
  getOutbound,
  prepareOutbound,
  shipOutbound,
} from '@/api/wms'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

type DeliveryItem = {
  id: number
  product_id: number
  product_variant_id?: number | null
  qty_requested: number
  qty_delivered: number
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
    variant_name?: string
  } | null
}

type DeliveryDetails = {
  id: number
  delivery_number: string
  sj_number?: string | null
  do_number?: string | null
  customer_name: string
  customer_contact?: string | null
  delivery_address: string
  delivery_date: string
  driver_name?: string | null
  vehicle_number?: string | null
  status: 'pending' | 'prepared' | 'shipped' | 'delivered' | 'cancelled' | string
  notes?: string | null
  warehouse?: {
    id: number
    code: string
    name: string
  }
  preparedBy?: { id: number, name: string } | null
  verifiedBy?: { id: number, name: string } | null
  items: DeliveryItem[]
}

const route = useRoute()
const id = computed(() => Number((route.params as any).id))

const loading = ref(false)
const actionLoading = ref(false)
const delivery = ref<DeliveryDetails | null>(null)

async function load() {
  if (!id.value || Number.isNaN(id.value)) {
    showNotify({ type: 'danger', message: 'ID outbound tidak valid' })
    return
  }

  loading.value = true
  try {
    const res = await getOutbound(id.value) as unknown as ApiResponse<DeliveryDetails>
    if (!res?.success) {
      delivery.value = null
      showNotify({ type: 'danger', message: res?.message || 'Gagal memuat detail outbound' })
      return
    }

    delivery.value = res.data
  }
  catch (err: any) {
    delivery.value = null
    const status = err?.response?.status
    if (status === 404)
      showNotify({ type: 'warning', message: 'Outbound tidak ditemukan' })
    else
      showNotify({ type: 'danger', message: 'Terjadi kesalahan saat memuat detail' })
  }
  finally {
    loading.value = false
  }
}

const canPrepare = computed(() => delivery.value?.status === 'pending')
const canShip = computed(() => delivery.value?.status === 'prepared')
const canDelivered = computed(() => delivery.value?.status === 'shipped')
const canCancel = computed(() => !['shipped', 'delivered', 'cancelled'].includes(delivery.value?.status || ''))

async function runAction(
  title: string,
  message: string,
  run: () => Promise<ApiResponse<null>>,
) {
  if (!delivery.value)
    return

  try {
    await showConfirmDialog({
      title,
      message,
      confirmButtonText: 'Lanjut',
      cancelButtonText: 'Batal',
    })
  }
  catch {
    return
  }

  actionLoading.value = true
  try {
    const res = await run()
    if (!res?.success) {
      showNotify({ type: 'danger', message: res?.message || 'Gagal' })
      return
    }

    showNotify({ type: 'success', message: res?.message || 'OK' })
    await load()
  }
  catch (err: any) {
    showNotify({ type: 'danger', message: err?.response?.data?.message || 'Terjadi kesalahan' })
  }
  finally {
    actionLoading.value = false
  }
}

async function onPrepare() {
  if (!delivery.value)
    return

  await runAction(
    'Prepare Outbound',
    'Prepare akan melakukan pengecekan ketersediaan stock untuk semua item. Lanjutkan?',
    async () => (await prepareOutbound(delivery.value!.id) as unknown as ApiResponse<null>),
  )
}

async function onShip() {
  if (!delivery.value)
    return

  await runAction(
    'Ship Outbound',
    'Ship akan mengurangi stock sesuai qty_delivered. Pastikan sudah dicek. Lanjutkan?',
    async () => (await shipOutbound(delivery.value!.id) as unknown as ApiResponse<null>),
  )
}

async function onDelivered() {
  if (!delivery.value)
    return

  await runAction(
    'Mark Delivered',
    'Tandai outbound sebagai delivered?',
    async () => (await deliveredOutbound(delivery.value!.id) as unknown as ApiResponse<null>),
  )
}

async function onCancel() {
  if (!delivery.value)
    return

  await runAction(
    'Cancel Outbound',
    'Batalkan outbound ini?',
    async () => (await cancelOutbound(delivery.value!.id) as unknown as ApiResponse<null>),
  )
}

function statusTagType(status: string) {
  if (status === 'delivered')
    return 'success'
  if (status === 'shipped')
    return 'primary'
  if (status === 'prepared')
    return 'warning'
  if (status === 'cancelled')
    return 'danger'
  return 'default'
}

onMounted(load)
</script>

<template>
  <van-nav-bar title="Outbound Detail" left-arrow @click-left="$router.back()" />

  <van-skeleton title :row="10" :loading="loading">
    <template v-if="delivery">
      <van-cell-group inset title="Info">
        <van-cell title="Delivery" :value="delivery.delivery_number" />
        <van-cell title="SJ" :value="delivery.sj_number || '-'" />
        <van-cell title="DO" :value="delivery.do_number || '-'" />
        <van-cell title="Customer" :value="delivery.customer_name" />
        <van-cell title="Tanggal" :value="delivery.delivery_date" />
        <van-cell title="Gudang" :value="delivery.warehouse ? `${delivery.warehouse.code} - ${delivery.warehouse.name}` : '-'" />
        <van-cell title="Status">
          <template #value>
            <van-tag :type="statusTagType(delivery.status)">{{ delivery.status }}</van-tag>
          </template>
        </van-cell>
        <van-cell title="Alamat" :label="delivery.delivery_address" />
        <van-cell v-if="delivery.notes" title="Notes" :label="delivery.notes" />
      </van-cell-group>

      <div class="px-4 py-3 grid grid-cols-2 gap-2">
        <van-button
          type="warning"
          :loading="actionLoading"
          :disabled="actionLoading || !canPrepare"
          @click="onPrepare"
        >
          Prepare
        </van-button>
        <van-button
          type="primary"
          :loading="actionLoading"
          :disabled="actionLoading || !canShip"
          @click="onShip"
        >
          Ship
        </van-button>
        <van-button
          type="success"
          :loading="actionLoading"
          :disabled="actionLoading || !canDelivered"
          @click="onDelivered"
        >
          Delivered
        </van-button>
        <van-button
          type="danger"
          :loading="actionLoading"
          :disabled="actionLoading || !canCancel"
          @click="onCancel"
        >
          Cancel
        </van-button>
      </div>

      <van-cell-group inset title="Items">
        <template v-if="delivery.items?.length">
          <template v-for="item in delivery.items" :key="item.id">
            <van-cell
              :title="item.product?.display_name || item.product?.name || `Product #${item.product_id}`"
              :label="item.product?.sku ? `SKU: ${item.product.sku}` : undefined"
            >
              <template #value>
                <div class="text-right">
                  <div>Delv: {{ item.qty_delivered }} {{ item.unit }}</div>
                  <div class="text-xs">Req: {{ item.qty_requested }}</div>
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
  name: 'WmsOutboundDetail',
  meta: {
    requiresAuth: true,
  },
}
</route>
