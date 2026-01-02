<script setup lang="ts">
import type { PickerColumn } from 'vant'
import { languageColumns, locale } from '@/utils/i18n'

const checked = computed({
  get: () => isDark.value,
  set: () => toggleDark(),
})

const menuItems = computed(() => ([
  { title: 'WMS', route: '/wms' },
  { title: 'Lookup Barang', route: '/wms/lookup' },
  { title: 'Inbound', route: '/wms/inbound' },
  { title: 'Outbound', route: '/wms/outbound' },
]))

const showLanguagePicker = ref(false)
const languageValues = ref<Array<string>>([locale.value])
const language = computed(() => languageColumns.find(l => l.value === locale.value).text)

function onLanguageConfirm(event: { selectedOptions: PickerColumn }) {
  locale.value = event.selectedOptions[0].value as string
  showLanguagePicker.value = false
}
</script>

<template>
  <van-cell-group :title="$t('home.settings')" :border="false" :inset="true">
    <van-cell center :title="$t('home.darkMode')">
      <template #right-icon>
        <van-switch
          v-model="checked"
          size="20px"
          aria-label="on/off Dark Mode"
        />
      </template>
    </van-cell>

    <van-cell
      is-link
      :title="$t('home.language')"
      :value="language"
      @click="showLanguagePicker = true"
    />
  </van-cell-group>

  <van-cell-group title="WMS" :border="false" :inset="true">
    <template v-for="item in menuItems" :key="item.route">
      <van-cell :title="item.title" :to="item.route" is-link />
    </template>
  </van-cell-group>

  <van-popup v-model:show="showLanguagePicker" position="bottom">
    <van-picker
      v-model="languageValues"
      :columns="languageColumns"
      @confirm="onLanguageConfirm"
      @cancel="showLanguagePicker = false"
    />
  </van-popup>
</template>

<route lang="json5">
{
  name: 'Home'
}
</route>
