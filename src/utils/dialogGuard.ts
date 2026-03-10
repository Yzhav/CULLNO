/** フォルダ選択ダイアログの多重起動防止（アプリ全体で共有） */
export const folderDialogGuard = { locked: false }

/** ガード付きで非同期処理を実行（多重起動防止） */
export async function withDialogGuard<T>(
  guard: { locked: boolean },
  fn: () => Promise<T>,
): Promise<T | undefined> {
  if (guard.locked) return undefined
  guard.locked = true
  try {
    return await fn()
  } finally {
    guard.locked = false
  }
}
