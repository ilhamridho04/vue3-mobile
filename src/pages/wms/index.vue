<script setup lang="ts">
const cards = [
  { title: 'Lookup Barang', desc: 'Scan / cari barang & stok', to: '/wms/lookup' },
  { title: 'Inbound', desc: 'Penerimaan barang (verify/cancel)', to: '/wms/inbound' },
  { title: 'Outbound', desc: 'Pengiriman barang (prepare/ship/delivered)', to: '/wms/outbound' },
]
</script>

<template>
  <van-nav-bar title="WMS" />

  <van-cell-group inset title="Menu">
    <template v-for="c in cards" :key="c.to">
      <van-cell :title="c.title" :label="c.desc" :to="c.to" is-link />
    </template>
  </van-cell-group>
</template>

<route lang="json5">
{
  name: 'WmsHome',
  meta: {
    requiresAuth: true,
  },
}
</route>
