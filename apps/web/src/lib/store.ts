import { create } from 'zustand'

type Docs = Record<string, string>

type State = {
  filePath?: string
  code: string
  open: string[]
  docs: Docs
  dirty: Record<string, boolean>
  quickOpen: boolean
  setFile: (path: string, code: string) => void
  setCode: (code: string) => void
  closeFile: (path: string) => void
  setActive: (path: string) => void
  markSaved: (path: string, code: string) => void
  setQuickOpen: (open: boolean) => void
}

export const useStudio = create<State>((set, get) => ({
  filePath: undefined,
  code: '',
  open: [],
  docs: {},
  dirty: {},
  quickOpen: false,
  setFile: (filePath, code) =>
    set((s) => ({
      filePath,
      code,
      docs: { ...s.docs, [filePath]: code },
      open: s.open.includes(filePath) ? s.open : [...s.open, filePath],
      dirty: { ...s.dirty, [filePath]: false },
    })),
  setCode: (code) =>
    set((s) => {
      const fp = s.filePath
      const baseline = (fp && s.docs[fp]) ?? ''
      const isDirty = fp ? code !== baseline : false
      return { code, dirty: fp ? { ...s.dirty, [fp]: isDirty } : s.dirty }
    }),
  closeFile: (path) =>
    set((s) => {
      const open = s.open.filter((p) => p !== path)
      const nextActive = s.filePath === path ? open[open.length - 1] : s.filePath
      const docs = { ...s.docs }
      const dirty = { ...s.dirty }
      delete docs[path]
      delete dirty[path]
      return {
        open,
        docs,
        dirty,
        filePath: nextActive,
        code: nextActive ? docs[nextActive] ?? '' : '',
      }
    }),
  setActive: (path) =>
    set((s) => ({ filePath: path, code: s.docs[path] ?? '' })),
  markSaved: (path, code) =>
    set((s) => ({ docs: { ...s.docs, [path]: code }, dirty: { ...s.dirty, [path]: false } })),
  setQuickOpen: (open) => set({ quickOpen: open }),
}))
