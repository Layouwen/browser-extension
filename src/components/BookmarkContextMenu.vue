<script setup lang="ts">
import { computed, h } from 'vue'
import { NIcon, type DropdownOption } from 'naive-ui'
import type { BmItem } from '@/lib/types'

defineProps<{
  show: boolean
  x: number
  y: number
  item: BmItem | null
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'open', item: BmItem): void
  (e: 'open-new-tab', item: BmItem): void
  (e: 'open-new-window', item: BmItem): void
  (e: 'copy-url', item: BmItem): void
  (e: 'copy-title', item: BmItem): void
  (e: 'edit', item: BmItem): void
  (e: 'delete', item: BmItem): void
}>()

const renderIcon = (emoji: string) =>
  () => h(NIcon, null, { default: () => h('span', { style: 'font-size: 14px;' }, emoji) })

const options = computed<DropdownOption[]>(() => [
  { label: '打开', key: 'open', icon: renderIcon('↗') },
  { label: '在新标签页打开', key: 'open-new-tab', icon: renderIcon('⊕') },
  { label: '在新窗口打开', key: 'open-new-window', icon: renderIcon('▢') },
  { type: 'divider', key: 'd1' },
  { label: '复制链接', key: 'copy-url', icon: renderIcon('🔗') },
  { label: '复制标题', key: 'copy-title', icon: renderIcon('T') },
  { type: 'divider', key: 'd2' },
  { label: '编辑', key: 'edit', icon: renderIcon('✎') },
  {
    label: '删除',
    key: 'delete',
    icon: renderIcon('✕'),
    props: { style: 'color: var(--danger);' },
  },
])

function onSelect(key: string, _option: DropdownOption, item: BmItem | null) {
  emit('update:show', false)
  if (!item) return
  switch (key) {
    case 'open':
      emit('open', item)
      break
    case 'open-new-tab':
      emit('open-new-tab', item)
      break
    case 'open-new-window':
      emit('open-new-window', item)
      break
    case 'copy-url':
      emit('copy-url', item)
      break
    case 'copy-title':
      emit('copy-title', item)
      break
    case 'edit':
      emit('edit', item)
      break
    case 'delete':
      emit('delete', item)
      break
  }
}
</script>

<template>
  <n-dropdown
    placement="bottom-start"
    trigger="manual"
    :x="x"
    :y="y"
    :options="options"
    :show="show"
    :on-clickoutside="() => emit('update:show', false)"
    @select="(k: string, o: DropdownOption) => onSelect(k, o, item)"
  />
</template>
