/** TGA画像1枚の情報 */
export interface TgaImage {
  /** フルパス */
  filePath: string
  /** ファイル名（拡張子なし） */
  baseName: string
  /** ファイルサイズ(bytes) */
  fileSize: number
  /** パースしたタイムスタンプ */
  timestamp: Date
  /** バースト連番（_0, _1, ...） */
  burstIndex: number
  /** ピック済みか */
  picked: boolean
  /** ゴミ箱行きか */
  trashed: boolean
}

/** バーストグループ */
export interface BurstGroup {
  /** グループID（先頭画像のbaseName） */
  id: string
  /** グループ内の画像リスト */
  images: TgaImage[]
  /** 代表画像（_0） */
  representative: TgaImage
  /** シングルショットか */
  isSingle: boolean
}

/** フィルムストリップに表示する1アイテム */
export interface FilmStripItem {
  /** BurstGroupのidまたはシングル画像のbaseName */
  id: string
  /** 代表画像 */
  image: TgaImage
  /** バーストなら枚数 */
  burstCount: number
  /** グループ展開中か */
  expanded: boolean
}

/** サムネイルサイズ */
export type ThumbnailSize = 'micro' | 'preview' | 'full'

/** サムネイル生成リクエスト */
export interface ThumbnailRequest {
  filePath: string
  size: ThumbnailSize
  priority: number
}

/** サムネイル生成結果 */
export interface ThumbnailResult {
  filePath: string
  size: ThumbnailSize
  /** data URL (jpeg) */
  dataUrl: string
}

/** セッション永続化データ */
export interface SessionData {
  folderPath: string
  pickedFiles: string[]
  trashedFiles: string[]
  currentIndex: number
  expandedGroups: string[]
  viewMode: ViewMode
  savedAt: string
}

/** アプリ設定 */
export interface AppSettings {
  defaultFolder: string
  exportFolder: string
  gridThumbSize?: number
  showFilmStrip?: boolean
  autoExpandBurst?: boolean
  mruMaxCount?: number
  theme?: 'dark' | 'light'
  uiScale?: number  // 80-150, デフォルト100
  homeBackground?: string  // Home背景画像のファイルパス
}

/** 表示モード */
export type ViewMode = 'grid' | 'preview' | 'compare'

/** スキャン結果 */
export interface ScanResult {
  images: TgaImage[]
  groups: BurstGroup[]
  totalSize: number
}

/** エクスポート形式 */
export type ExportFormat = 'png' | 'jpeg'

/** エクスポートオプション */
export interface ExportOptions {
  format: ExportFormat
  quality: number  // JPEG品質 1-100（PNGでは無視）
}

/** エクスポート進捗 */
export interface ExportProgress {
  current: number
  total: number
  currentFile: string
}

/** 最近使ったフォルダのエントリ */
export interface MRUEntry {
  folderPath: string
  folderName: string
  tgaCount: number
  lastOpened: string  // ISO 8601
}

/** キーバインドアクション */
export type KeyAction =
  | 'navigatePrev'     // 前へ
  | 'navigateNext'     // 次へ
  | 'navigateUp'       // 上へ（グリッドのみ）
  | 'navigateDown'     // 下へ（グリッドのみ）
  | 'pick'             // ピックトグル
  | 'modeTransition'   // モード遷移（Tab）
  | 'burstToggle'      // バースト展開/折畳
  | 'trash'            // ゴミ箱トグル
  | 'fullscreen'       // フルスクリーン
  | 'pickedFilter'     // ピック済みフィルタ
  | 'compare'          // 比較モード直接移行

/** キーバインド設定 */
export type KeybindConfig = Record<KeyAction, string>

/** キーバインドのデフォルト値 */
export const DEFAULT_KEYBINDS: KeybindConfig = {
  navigatePrev: 'ArrowLeft',
  navigateNext: 'ArrowRight',
  navigateUp: 'ArrowUp',
  navigateDown: 'ArrowDown',
  pick: ' ',
  modeTransition: 'Tab',
  burstToggle: 'e',
  trash: 'Delete',
  fullscreen: 'f',
  pickedFilter: 'q',
  compare: '',
}
