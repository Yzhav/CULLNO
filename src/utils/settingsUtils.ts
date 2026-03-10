import type { AppSettings } from '../types'

/** 設定を部分更新して保存する */
export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const settings = await window.electronAPI.loadSettings()
  await window.electronAPI.saveSettings({ ...settings, ...patch })
}
