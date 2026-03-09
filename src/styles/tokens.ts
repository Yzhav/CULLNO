import { webDarkTheme, type Theme } from '@fluentui/react-components'

/**
 * Cullno カスタムテーマ
 * webDarkTheme をベースに、アプリ固有の色をオーバーライド。
 * コンポーネントでは tokens.* を参照するだけで正しい色が適用される。
 */
export const cullnoTheme: Theme = {
  ...webDarkTheme,
  // Background（ウィンドウフレームとのコントラスト軽減）
  colorNeutralBackground1: '#1e1e1e',   // キャンバス（プレビュー背景）
  colorNeutralBackground3: '#252525',   // ツールバー・フィルムストリップ・ステータスバー
  colorNeutralBackground4: '#2a2a2a',   // バーストスタック・プレースホルダ
  // Brand accent
  colorBrandForeground1: '#3b82f6',     // アクティブ・選択枠
  colorBrandForeground2: '#3b82f6',
  // Palette overrides
  colorPaletteYellowForeground1: '#fbbf24',  // ピック済みマーク
  colorPaletteGreenForeground1: '#22c55e',   // 成功メッセージ
  colorPaletteRedForeground1: '#ef4444',     // エラー・ゴミ箱
}

/** コンポーネント間で共有するカスタムカラー（Fluent トークンに該当がないもの） */
export const cullnoColors = {
  /** バーストグループ背景（半透明。GridView burstChild / FilmStrip burstGroup 共通） */
  burstGroupBg: 'rgba(255, 255, 255, 0.12)',
}
