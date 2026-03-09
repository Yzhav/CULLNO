## Cullno 開発ルール

### 開発方針: Team Lead 方式

このプロジェクトはTeam Lead方式で開発する。メインのClaudeがTeam Leadとして統括し、サブエージェントに実装・検証を分担する。

**役割分担:**
| 役割 | エージェント | 担当 |
|------|------------|------|
| Team Lead | メインClaude | 設計判断・タスク分解・Catyさんとの対話 |
| 実装担当 | electron-dev | コード実装・修正 |
| UI検証担当 | ui-tester | agent-browser で画面確認・操作テスト |

**重要ルール:**
- 実装した人と検証する人は必ず分ける（堂々巡り防止）
- 同じバグで3回失敗したら立ち止まって再設計する
- preload.ts の変更後は必ず ui-tester で基本機能の動作確認を行う

---

### dev server の管理

- `npm run dev` はClaude自身がBashツールで起動・管理すること
- **ユーザーに「再起動してください」と頼むのは禁止**
- renderer（src/配下）の変更はHMRで自動反映されるため再起動不要

#### 起動手順（CDP対応）

```bash
# 1. 既存プロセスを停止
taskkill //f //im electron.exe 2>/dev/null

# 2. dev server 起動（バックグラウンド）
# vite.config.ts で --remote-debugging-port=9223 が自動付与される
cd G:/ClaudeCode/tools/cullno && npm run dev &

# 3. 少し待ってから agent-browser を接続
sleep 3
agent-browser connect 9223
```

CDP ポート 9223 は `vite.config.ts` の `onstart` で設定済み。`npm run dev` するだけで自動的に CDP が有効になる。

---

### 画面確認: agent-browser（CDP方式）

Playwright MCP ではなく **agent-browser** を使う。Electron アプリそのものに CDP で接続して UI 確認・操作テストができる。

```bash
# 接続（dev server 起動後）
agent-browser connect 9223

# スナップショット（UI要素一覧取得）
agent-browser snapshot -i

# スクリーンショット
agent-browser screenshot cullno-state.png

# 要素クリック
agent-browser click @eN

# ダークモード保持
agent-browser --color-scheme dark snapshot -i
```

---

### preload.ts 変更ルール（最重要）

preload.ts は **アプリ全機能の生命線**。変更時は以下を厳守:

1. **変更前**: 現在の dist-electron/preload.js をバックアップ
2. **変更内容**: 新機能コードは `contextBridge.exposeInMainWorld()` の **後** に配置
3. **変更後**: ビルド → ui-tester で `window.electronAPI` が undefined でないことを確認
4. **壊れたら即ロールバック**: バックアップから復元

**やってはいけないこと:**
- preload.ts で `import * as path from 'path'` 等のNode.jsモジュールインポート（Viteビルドが壊れる）
- contextBridge.exposeInMainWorld() 内に D&D 関連コードを混ぜる
- contextBridge 経由で File オブジェクトを渡す（proxy化されて壊れる）

**D&D の正しい実装パターン:**
```typescript
// contextBridge.exposeInMainWorld() の後に配置
document.addEventListener('drop', (e) => {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files) {
    const paths = Array.from(files).map(f =>
      require('electron').webUtils.getPathForFile(f)
    )
    require('electron').ipcRenderer.send('folder-dropped', paths[0])
  }
})
```

---

### 技術スタック

- Electron 33 + Vite 5 + React 18 + Fluent UI v9 + Sharp
- 状態管理: Zustand 5
- TGAデコーダ: 自前実装（Sharpは TGA非対応）
- ビルド: vite-plugin-electron + electron-builder

### よくあるハマりポイント

- **Zustandセレクタで新しい配列/オブジェクトを返すと無限レンダーループ**
- **Fluent UI makeStyles（Griffel）は非標準CSSプロパティを無視する**
- **Sharp は TGA を読めない** → tga-decoder.ts を経由する
- **React の onWheel は passive** → ネイティブ addEventListener + { passive: false } を使う
- **FluentProvider に height:100% を直指定しないと黒画面になる**

### 仕様書・リソース

- プロジェクト概要・UI仕様: `G:\Obsidian\柚ノ葉図書館\Projects\Cullno\Cullno プロジェクト概要.md`
- 開発ログ: `G:\Obsidian\柚ノ葉図書館\Projects\Cullno\Cullno - 開発ログ.md`
- フィードバック: `G:\Obsidian\柚ノ葉図書館\Projects\Cullno\Cullno - フィードバック.md`
- 全体の教訓: `tasks/lessons.md`
