import { create } from 'zustand'
import type { KeyAction, KeybindConfig } from '../types'
import { DEFAULT_KEYBINDS } from '../types'

interface KeybindState {
  keybinds: KeybindConfig
  loaded: boolean
  showShortcutNav: boolean
  loadKeybinds: () => Promise<void>
  saveKeybinds: (config: KeybindConfig) => Promise<void>
  resetToDefault: () => Promise<void>
  toggleShortcutNav: () => void
}

export const useKeybindStore = create<KeybindState>()((set) => ({
  keybinds: DEFAULT_KEYBINDS,
  loaded: false,
  showShortcutNav: true,

  loadKeybinds: async () => {
    if (!window.electronAPI) return
    const config = await window.electronAPI.getKeybinds()
    set({ keybinds: config, loaded: true })
  },

  saveKeybinds: async (config: KeybindConfig) => {
    if (!window.electronAPI) return
    await window.electronAPI.saveKeybinds(config)
    set({ keybinds: config })
  },

  resetToDefault: async () => {
    if (!window.electronAPI) return
    await window.electronAPI.saveKeybinds(DEFAULT_KEYBINDS)
    set({ keybinds: DEFAULT_KEYBINDS })
  },

  toggleShortcutNav: () => {
    set(s => ({ showShortcutNav: !s.showShortcutNav }))
  },
}))

// KeyActionの全一覧（型から配列を生成するためのヘルパー）
export const ALL_KEY_ACTIONS: KeyAction[] = [
  'navigatePrev',
  'navigateNext',
  'navigateUp',
  'navigateDown',
  'pick',
  'modeTransition',
  'burstToggle',
  'trash',
  'fullscreen',
  'pickedFilter',
  'compare',
]
