<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage, type TreeSelectOption } from 'naive-ui'
import { useBookmarksStore } from '@/stores/bookmarks'
import { BOOKMARKS_BAR_ID } from '@/lib/types'

const store = useBookmarksStore()
const message = useMessage()

const tabTitle = ref('')
const tabUrl = ref('')
const tabFavicon = ref<string | undefined>(undefined)
const parentId = ref<string | null>(null)
const note = ref('')
const tags = ref<string[]>([])
const saving = ref(false)
const ready = ref(false)

onMounted(async () => {
  await store.init()
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) {
    tabTitle.value = tab.title ?? ''
    tabUrl.value = tab.url ?? ''
    tabFavicon.value = tab.favIconUrl
  }
  const last = await chrome.storage.local.get('last-folder-id')
  const lastId = last['last-folder-id'] as string | undefined
  if (lastId && store.folderById(lastId)) {
    parentId.value = lastId
  } else {
    parentId.value = store.folderById(BOOKMARKS_BAR_ID)?.id ?? store.rootFolders[0]?.id ?? null
  }
  ready.value = true
})

const buildTree = (pid: string | null): TreeSelectOption[] =>
  store.childrenOf(pid).map((f) => ({
    key: f.id,
    label: f.title,
    children: buildTree(f.id),
  }))

const folderOptions = computed(() => buildTree(null))
const tagOptions = computed(() =>
  store.allTagNames.map((name) => ({
    label: name,
    value: name,
  }))
)

const canSave = computed(
  () => !!tabUrl.value && !!parentId.value && !!tabTitle.value.trim()
)

function normalizedTags(): string[] {
  return Array.from(new Set(tags.value.map((tag) => tag.trim()).filter(Boolean)))
}

async function save() {
  if (!canSave.value || !parentId.value) return
  saving.value = true
  try {
    await store.addBookmark({
      parentId: parentId.value,
      title: tabTitle.value,
      url: tabUrl.value,
      favicon: tabFavicon.value,
      note: note.value,
      tags: normalizedTags(),
    })
    await chrome.storage.local.set({ 'last-folder-id': parentId.value })
    message.success('已加入 Chrome 收藏夹')
    setTimeout(() => window.close(), 400)
  } finally {
    saving.value = false
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage()
}
</script>

<template>
  <div class="w-[380px] bg-surface text-primary">
    <div class="px-5 pt-4 pb-3 border-b border-subtle">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-md bg-subtle flex items-center justify-center overflow-hidden shrink-0"
        >
          <img
            v-if="tabFavicon"
            :src="tabFavicon"
            class="w-5 h-5"
            referrerpolicy="no-referrer"
            alt=""
          />
          <span v-else class="text-xs text-muted">🔗</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[11px] text-tertiary uppercase tracking-wider font-semibold">
            添加到 Chrome 收藏夹
          </div>
          <div class="text-[12px] text-tertiary truncate">{{ tabUrl }}</div>
        </div>
      </div>
    </div>

    <div v-if="ready" class="px-5 py-4 flex flex-col gap-3">
      <div>
        <div class="text-[11px] text-tertiary mb-1 font-medium">标题</div>
        <n-input v-model:value="tabTitle" placeholder="收藏标题" size="small" />
      </div>

      <div>
        <div class="text-[11px] text-tertiary mb-1 font-medium">收藏到</div>
        <n-tree-select
          v-model:value="parentId"
          :options="folderOptions"
          placeholder="选择目录"
          default-expand-all
          size="small"
        />
      </div>

      <div>
        <div class="text-[11px] text-tertiary mb-1 font-medium">备注(可选)</div>
        <n-input
          v-model:value="note"
          type="textarea"
          placeholder="加点笔记..."
          :autosize="{ minRows: 2, maxRows: 3 }"
          size="small"
        />
      </div>

      <div>
        <div class="text-[11px] text-tertiary mb-1 font-medium">标签(可选)</div>
        <n-select
          v-model:value="tags"
          :options="tagOptions"
          multiple
          filterable
          tag
          placeholder="选择或输入标签"
          size="small"
        />
      </div>
    </div>
    <div v-else class="py-8 text-center text-sm text-muted">加载中…</div>

    <div
      class="px-5 py-3 border-t border-subtle flex items-center justify-between bg-subtle"
    >
      <n-button text size="small" @click="openOptions">
        打开管理页 →
      </n-button>
      <n-button
        type="primary"
        size="small"
        :loading="saving"
        :disabled="!canSave"
        @click="save"
      >
        收藏
      </n-button>
    </div>
  </div>
</template>
