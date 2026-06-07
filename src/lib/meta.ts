import {
  META_SCHEMA_VERSION,
  META_STORAGE_KEY,
  type BookmarkMeta,
  type MetaSchema,
} from './types'

const empty = (): MetaSchema => ({
  version: META_SCHEMA_VERSION,
  meta: {},
  tags: [],
})

function migrate(raw: unknown): MetaSchema {
  if (!raw || typeof raw !== 'object') return empty()
  const data = raw as Partial<MetaSchema>
  if (data.version === META_SCHEMA_VERSION && data.meta && typeof data.meta === 'object') {
    return {
      version: META_SCHEMA_VERSION,
      meta: data.meta,
      tags: Array.isArray(data.tags) ? data.tags : [],
    }
  }
  return empty()
}

export async function loadMeta(): Promise<MetaSchema> {
  const got = await chrome.storage.local.get(META_STORAGE_KEY)
  return migrate(got?.[META_STORAGE_KEY])
}

export async function saveMeta(schema: MetaSchema): Promise<void> {
  await chrome.storage.local.set({ [META_STORAGE_KEY]: schema })
}

export async function setMeta(id: string, patch: Partial<BookmarkMeta>): Promise<void> {
  const schema = await loadMeta()
  const cur = schema.meta[id] ?? { tags: [] }
  const next: BookmarkMeta = {
    ...cur,
    ...patch,
    tags: patch.tags ?? cur.tags ?? [],
  }
  // 若全部字段为空,直接删除该条目
  const hasContent =
    (next.note && next.note.trim()) || next.tags.length > 0 || next.favicon
  if (hasContent) {
    schema.meta[id] = next
  } else {
    delete schema.meta[id]
  }
  await saveMeta(schema)
}

export async function deleteMeta(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const schema = await loadMeta()
  let changed = false
  for (const id of ids) {
    if (schema.meta[id]) {
      delete schema.meta[id]
      changed = true
    }
  }
  if (changed) await saveMeta(schema)
}

export function subscribeMeta(callback: (schema: MetaSchema) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== 'local') return
    const change = changes[META_STORAGE_KEY]
    if (!change) return
    callback(migrate(change.newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
