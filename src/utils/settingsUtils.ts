import type { AppSettings } from '../types'

let settingsUpdateQueue: Promise<void> = Promise.resolve()

/** 設定を部分更新して保存する */
export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const update = settingsUpdateQueue.then(async () => {
    const settings = await window.electronAPI.loadSettings()
    await window.electronAPI.saveSettings({ ...settings, ...patch })
  })
  // 1回の失敗で後続更新まで永久に失敗しないよう、内部キューだけ回復させる
  settingsUpdateQueue = update.catch(() => undefined)
  return update
}
