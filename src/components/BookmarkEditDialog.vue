<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMessage, type TreeSelectOption } from 'naive-ui'
import { useBookmarksStore } from '@/stores/bookmarks'
import type { BmItem } from '@/lib/types'

const props = defineProps<{
  show: boolean
  item: BmItem | null
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
}>()

const store = useBookmarksStore()
const message = useMessage()

const title = ref('')
const url = ref('')
const note = ref('')
const parentId = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [props.show, props.item],
  () => {
    if (props.show && props.item) {
      title.value = props.item.title
      url.value = props.item.url
      const m = store.metaOf(props.item.id)
      note.value = m.note ?? ''
      parentId.value = props.item.parentId
    }
  },
  { immediate: true }
)

const buildTree = (pid: string | null): TreeSelectOption[] =>
  store.childrenOf(pid).map((f) => ({
    key: f.id,
    label: f.title,
    children: buildTree(f.id),
  }))

const folderOptions = computed(() => buildTree(null))

async function handleSave() {
  if (!props.item) return
  if (!title.value.trim()) {
    message.warning('标题不能为空')
    return
  }
  if (!parentId.value) {
    message.warning('请选择目录')
    return
  }
  saving.value = true
  try {
    await store.updateBookmark(props.item.id, {
      title: title.value,
      url: url.value,
      parentId: parentId.value,
      note: note.value,
    })
    message.success('已保存')
    emit('update:show', false)
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="编辑收藏"
    style="width: 520px"
    :bordered="false"
    size="huge"
    :mask-closable="!saving"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="flex flex-col gap-4">
      <div>
        <div class="text-[12px] text-tertiary mb-1.5 font-medium">标题</div>
        <n-input v-model:value="title" placeholder="收藏标题" />
      </div>
      <div>
        <div class="text-[12px] text-tertiary mb-1.5 font-medium">链接</div>
        <n-input v-model:value="url" placeholder="https://..." />
      </div>
      <div>
        <div class="text-[12px] text-tertiary mb-1.5 font-medium">所在目录</div>
        <n-tree-select
          v-model:value="parentId"
          :options="folderOptions"
          placeholder="选择目录"
          default-expand-all
        />
      </div>
      <div>
        <div class="text-[12px] text-tertiary mb-1.5 font-medium">备注(可选,仅本插件可见)</div>
        <n-input
          v-model:value="note"
          type="textarea"
          placeholder="添加备注..."
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <n-button :disabled="saving" @click="handleCancel">取消</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
      </div>
    </template>
  </n-modal>
</template>
