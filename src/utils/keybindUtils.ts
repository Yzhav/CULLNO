const KEY_DISPLAY_NAMES: Record<string, string> = {
  'ArrowLeft': '←',
  'ArrowRight': '→',
  'ArrowUp': '↑',
  'ArrowDown': '↓',
  ' ': 'Space',
  'Tab': 'Tab',
  'Delete': 'Delete',
  'Backspace': 'Backspace',
  'Enter': 'Enter',
  'Escape': 'Escape',
}

export function getKeyDisplay(key: string): string {
  if (key === '') return '未設定'
  if (KEY_DISPLAY_NAMES[key]) return KEY_DISPLAY_NAMES[key]
  return key.length === 1 ? key.toUpperCase() : key
}
