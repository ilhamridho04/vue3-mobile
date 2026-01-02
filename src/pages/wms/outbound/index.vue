<script setup lang="ts">
import { showNotify } from 'vant'
import { listOutbound } from '@/api/wms'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

type OutboundListItem = {
  id: number
  delivery_number: string
  sj_number?: string | null
  do_number?: string | null
  customer_name: string
  delivery_date: string
  status: 'pending' | 'prepared' | 'shipped' | 'delivered' | 'cancelled' | string
  items_count?: number
  warehouse?: {
    id: number
    code: string
    name: string
  }
}

type LaravelPaginator<T> = {
  data: T[]
  current_page: number
  last_page: number
  next_page_url: string | null
  per_page: number
  total: number
}

const search = ref('')
const loading = ref(false)
const finished = ref(false)

const page = ref(1)
const rows = ref<OutboundListItem[]>([])

async function fetchPage(reset = false) {
  if (loading.value)
    return

  if (reset) {
    rows.value = []
    page.value = 1
    finished.value = false
  }

  loading.value = true
  try {
    const res = await listOutbound({
      page: page.value,
      per_page: 20,
      search: search.value.trim() || undefined,
    }) as unknown as ApiResponse<LaravelPaginator<OutboundListItem>>

    if (!res?.success) {
      showNotify({ type: 'danger', message: res?.message || 'Gagal memuat outbound' })
      finished.value = true
      return
    }

    const payload = res.data
    rows.value.push(...(payload?.data || []))

    if (!payload?.next_page_url) {
      finished.value = true
    }
    else {
      page.value += 1
    }
  }
  catch {
    showNotify({ type: 'danger', message: 'Terjadi kesalahan saat memuat outbound' })
    finished.value = true
  }
  finally {
    loading.value = false
  }
}

function onSearch() {
  fetchPage(true)
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

onMounted(() => {
  fetchPage(true)
})
</script>

<template>
  <van-nav-bar title="WMS Outbound" left-arrow @click-left="$router.back()">
    <template #right>
      <van-button size="small" type="primary" plain to="/wms/outbound/create">Create</van-button>
    </template>
  </van-nav-bar>

  <van-search
    v-model="search"
    placeholder="Cari delivery/SJ/DO/customer"
    show-action
    @search="onSearch"
    @cancel="onSearch"
  />

  <van-list
    v-model:loading="loading"
    :finished="finished"
    finished-text="Tidak ada data lagi"
    @load="() => fetchPage(false)"
  >
    <template v-for="row in rows" :key="row.id">
      <van-cell
        is-link
        :to="`/wms/outbound/${row.id}`"
        :title="row.delivery_number"
        :label="`${row.customer_name} • ${row.delivery_date}`"
      >
        <template #value>
          <div class="text-right">
            <div class="text-xs">{{ row.warehouse?.code || '-' }}</div>
            <van-tag :type="statusTagType(row.status)">
              {{ row.status }}
            </van-tag>
            <div class="text-xs" v-if="typeof row.items_count === 'number'">
              items: {{ row.items_count }}
            </div>
          </div>
        </template>
      </van-cell>
    </template>

    <van-empty v-if="!loading && rows.length === 0" description="Tidak ada outbound" />
  </van-list>
</template>

<route lang="json5">
{
  name: 'WmsOutbound',
  meta: {
    requiresAuth: true,
  },
}
</route>
