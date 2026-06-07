<script setup lang="ts">
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import PopupInner from './PopupInner.vue'

const isDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
const theme = computed(() => (isDark.value ? darkTheme : null))

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    fontFamily: 'var(--font-sans)',
    fontFamilyMono: 'var(--font-mono)',
    fontWeight: '400',
    fontWeightStrong: '600',
    primaryColor: isDark.value ? '#2997ff' : '#0071e3',
    primaryColorHover: isDark.value ? '#3aa3ff' : '#0077ed',
    primaryColorPressed: isDark.value ? '#1e8de8' : '#006edb',
    primaryColorSuppl: isDark.value ? '#2997ff' : '#0077ed',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    textColorBase: isDark.value ? '#f5f5f7' : '#1d1d1f',
  },
}))

onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', (e) => (isDark.value = e.matches))
})
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <PopupInner />
    </n-message-provider>
  </n-config-provider>
</template>
