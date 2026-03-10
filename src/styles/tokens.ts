import { webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-components'

/**
 * Cullno カスタムテーマ（ダーク）
 */
export const cullnoTheme: Theme = {
  ...webDarkTheme,
  colorNeutralBackground1: '#1e1e1e',
  colorNeutralBackground3: '#252525',
  colorNeutralBackground4: '#2a2a2a',
  colorBrandForeground1: '#3b82f6',
  colorBrandForeground2: '#3b82f6',
  colorPaletteYellowForeground1: '#fbbf24',
  colorPaletteGreenForeground1: '#22c55e',
  colorPaletteRedForeground1: '#ef4444',
}

/**
 * Cullno カスタムテーマ（ライト）
 */
export const cullnoLightTheme: Theme = {
  ...webLightTheme,
  colorNeutralBackground1: '#f5f5f5',   // 優しいオフホワイト（眩しさ軽減）
  colorNeutralBackground3: '#ebebeb',   // ツールバー・ステータスバー
  colorNeutralBackground4: '#e0e0e0',   // プレースホルダ
  colorBrandForeground1: '#2563eb',
  colorBrandForeground2: '#2563eb',
  colorPaletteYellowForeground1: '#b8860b',
  colorPaletteGreenForeground1: '#16a34a',
  colorPaletteRedForeground1: '#dc2626',
}

/** コンポーネント間で共有するカスタムカラー（CSS変数参照） */
export const cullnoColors = {
  // === プリミティブ ===
  selectionBlue: 'var(--cullno-selection-blue)',
  pickedGold: 'var(--cullno-picked-gold)',

  // === バースト装飾 ===
  burstGroupBg: 'var(--cullno-burst-group-bg)',
  burstLineBright: 'var(--cullno-burst-line-bright)',
  burstLineGlow: 'var(--cullno-burst-line-glow)',
  burstLineSoft: 'var(--cullno-burst-line-soft)',

  // === Welcome / サーフェス ===
  welcomeBgDark: 'var(--cullno-welcome-bg-dark)',
  welcomeAccent: 'var(--cullno-welcome-accent)',
  dropzoneActiveBg: 'var(--cullno-dropzone-active-bg)',
  surfaceHover: 'var(--cullno-surface-hover)',
  surfaceSubtle: 'var(--cullno-surface-subtle)',
  surfaceSubtleHover: 'var(--cullno-surface-subtle-hover)',
  scrollbarThumb: 'var(--cullno-scrollbar-thumb)',

  // === 合成シャドウ ===
  selectionShadow: 'var(--cullno-selection-shadow)',
  pickedShadow: 'var(--cullno-picked-shadow)',
  selectedPickedShadow: 'var(--cullno-selected-picked-shadow)',
  pickFlashShadow: 'var(--cullno-pick-flash-shadow)',
}
