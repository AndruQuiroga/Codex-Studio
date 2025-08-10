import { create } from 'zustand'

type State = {
  filePath?: string
  code: string
  setFile: (path: string, code: string) => void
  setCode: (code: string) => void
}

export const useStudio = create<State>((set) => ({
  filePath: undefined,
  code: '',
  setFile: (filePath, code) => set({ filePath, code }),
  setCode: (code) => set({ code }),
}))
