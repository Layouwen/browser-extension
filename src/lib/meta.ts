import {
  META_SCHEMA_VERSION,
  META_STORAGE_KEY,
  type BookmarkMeta,
  type MetaSchema,
} from './types'

export const CUSTOM_META_EXPORT_TYPE = 'bookmark-custom-meta' as const

export interface CustomMetaExport {
  version: typeof META_SCHEMA_VERSION
  type: typeof CUSTOM_META_EXPORT_TYPE
  exportedAt: string
  meta: Record<string, {
    tags: string[]
    note?: string
  }>
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    throw new Error('标签数据格式不正确')
  }
  return Array.from(
    new Set(
      tags
        .map((tag) => {
          if (typeof tag !== 'string') {
            throw new Error('标签数据格式不正确')
          }
          return tag.trim()
        })
        .filter(Boolean)
    )
  )
}

function normalizeCustomMetaExport(raw: unknown): CustomMetaExport {
  if (!isRecord(raw)) throw new Error('导入文件格式不正确')
  if (raw.version !== META_SCHEMA_VERSION) throw new Error('导入文件版本不兼容')
  if (raw.type !== CUSTOM_META_EXPORT_TYPE) throw new Error('导入文件类型不正确')
  if (!isRecord(raw.meta)) throw new Error('导入文件缺少元数据')

  const normalized: CustomMetaExport['meta'] = {}
  for (const [id, value] of Object.entries(raw.meta)) {
    if (!id.trim() || !isRecord(value)) {
      throw new Error('导入文件元数据格式不正确')
    }
    const tags = normalizeTags(value.tags)
    const note = value.note
    if (note !== undefined && typeof note !== 'string') {
      throw new Error('备注数据格式不正确')
    }
    normalized[id] = {
      tags,
      ...(note?.trim() ? { note } : {}),
    }
  }

  return {
    version: META_SCHEMA_VERSION,
    type: CUSTOM_META_EXPORT_TYPE,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    meta: normalized,
  }
}

export async function exportCustomMeta(): Promise<CustomMetaExport> {
  const schema = await loadMeta()
  const exported: CustomMetaExport['meta'] = {}
  for (const [id, value] of Object.entries(schema.meta)) {
    const tags = normalizeTags(value.tags ?? [])
    const note = value.note?.trim()
    if (tags.length > 0 || note) {
      exported[id] = {
        tags,
        ...(note ? { note: value.note } : {}),
      }
    }
  }
  return {
    version: META_SCHEMA_VERSION,
    type: CUSTOM_META_EXPORT_TYPE,
    exportedAt: new Date().toISOString(),
    meta: exported,
  }
}

export async function importCustomMeta(raw: unknown): Promise<number> {
  const imported = normalizeCustomMetaExport(raw)
  const schema = await loadMeta()
  for (const [id, value] of Object.entries(imported.meta)) {
    const cur: BookmarkMeta = schema.meta[id] ?? { tags: [] }
    const next: BookmarkMeta = {
      ...cur,
      tags: value.tags,
    }
    if (value.note !== undefined) next.note = value.note
    else delete next.note
    const hasContent =
      (next.note && next.note.trim()) || next.tags.length > 0 || next.favicon
    if (hasContent) {
      schema.meta[id] = next
    } else {
      delete schema.meta[id]
    }
  }
  await saveMeta(schema)
  return Object.keys(imported.meta).length
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
