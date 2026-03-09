# フィルムストリップ + バースト独立行表示

## タスク一覧

### Phase 1: 独立した修正（並列実行可能）

- [x] **T1: GridView ホバーの padding 修正**
  - hover時 `padding: 1px` → `outline` 方式に変更
  - FilmStrip と同じ outline アプローチで統一
  - レイアウトシフト防止

- [x] **T2: フィルムストリップのクリック飛ばない問題**
  - 原因: `setPointerCapture` が即座に発火 → click イベントがサムネイルに到達しない
  - 修正: ドラッグ閾値(3px)を超えてからキャプチャ開始に変更

### Phase 2: バースト独立行表示（順次実行）

- [x] **T3: グリッドのバースト独立行表示**
  - flatItems をセグメントに分割（cells / burst-row）
  - GridView で `grid-column: 1 / -1` の独立行をレンダリング
  - 背景色 `colorNeutralBackground4` (#2a2a2a) で区別
  - バースト行内セルは固定サイズ（flex レイアウト）

- [x] **T4: フィルムストリップのバースト視覚グループ化**
  - burst-child 群を背景色帯（`colorNeutralBackground4`）で囲んでグループ化
  - 個別 burstChild 背景色を除去

- [x] **T5: バースト枚数バッジの除去・再配置**
  - Badge コンポーネント除去（import 含む）
  - 折り畳み時: `×N` テキストラベル（右下、半透明背景）
  - 展開時: バースト行/グループのヘッダーに `×N` ラベル
  - 未使用 burstChild スタイル・コード削除（GridView）

## レビュー

全5タスク完了。変更ファイル:
- `src/components/GridView.tsx` - T1, T3, T5
- `src/components/FilmStrip.tsx` - T2, T4, T5
- `src/stores/useSessionStore.ts` - 変更なし
- `src/types/index.ts` - 変更なし

UI検証（ui-tester）が必要。
