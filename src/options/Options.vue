<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import OptionsLayout from './OptionsLayout.vue'

const isDark = ref(false)
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
    textColor1: isDark.value ? 'rgba(245, 245, 247, 0.92)' : 'rgba(29, 29, 31, 0.95)',
    textColor2: isDark.value ? 'rgba(245, 245, 247, 0.82)' : 'rgba(29, 29, 31, 0.78)',
    textColor3: isDark.value ? 'rgba(245, 245, 247, 0.6)' : 'rgba(29, 29, 31, 0.55)',
  },
  Tree: {
    nodeTextColor: isDark.value ? 'rgba(245, 245, 247, 0.85)' : 'rgba(29, 29, 31, 0.85)',
    nodeColorHover: isDark.value ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.045)',
    nodeColorActive: isDark.value ? 'rgba(41, 151, 255, 0.18)' : 'rgba(0, 113, 227, 0.1)',
    nodeColorPressed: isDark.value ? 'rgba(41, 151, 255, 0.22)' : 'rgba(0, 113, 227, 0.14)',
  },
  Dropdown: {
    color: isDark.value ? '#2c2c2e' : '#ffffff',
    optionTextColor: isDark.value ? '#f5f5f7' : '#1d1d1f',
    optionColorHover: isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
  },
}))

onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  isDark.value = mq.matches
  mq.addEventListener('change', (e) => (isDark.value = e.matches))
})
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <OptionsLayout />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
