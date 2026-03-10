import { useMemo, useState, useEffect } from 'react'
import {
  makeStyles, tokens,
  ToolbarButton, ToolbarDivider, Tooltip,
  TabList, Tab, Text,
  Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, MenuItemCheckbox, MenuItemRadio, MenuDivider,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Button,
} from '@fluentui/react-components'
import {
  Home24Regular, FolderOpen24Regular,
  DualScreen24Regular, ArrowExportUp24Regular, Delete24Regular,
  Star24Filled, Star24Regular,
  Grid24Regular, Image24Regular, Filter24Regular, Filter24Filled,
  ArrowUndo24Regular, ArrowRedo24Regular,
  Settings24Regular,
} from '@fluentui/react-icons'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'
import { useSelectionStore } from '../stores/useSelectionStore'
import { useKeybindStore } from '../stores/useKeybindStore'
import { getBaseName } from '../utils/fileUtils'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import type { ViewMode, UpdateCheckResult } from '../types'
import { KeybindDialog } from './KeybindDialog'

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    paddingLeft: '8px',
    paddingRight: '8px',
    display: 'flex',
    alignItems: 'center',
    height: '44px',
    flexShrink: 0,
    gap: '6px',
  },
  homeButton: {
    display: 'flex',
    justifyContent: 'center',
    width: '40px',
  },
  tabs: {
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center',
    paddingLeft: '8px',
    paddingRight: '8px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  starActive: {
    color: tokens.colorPaletteYellowForeground1,
  },
  starInactive: {
    color: tokens.colorNeutralForeground3,
  },
  filterActive: {
    color: tokens.colorBrandForeground1,
  },
})

export function CullnoToolbar() {
  const styles = useStyles()
  const [keybindDialogOpen, setKeybindDialogOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [autoExpandBurst, setAutoExpandBurst] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [uiScale, setUiScale] = useState(100)
  const showShortcutNav = useKeybindStore(s => s.showShortcutNav)

  // 設定読み込み
  useEffect(() => {
    window.electronAPI?.loadSettings().then(settings => {
      if (settings.autoExpandBurst) setAutoExpandBurst(true)
      if (settings.theme) setTheme(settings.theme)
      if (settings.uiScale) setUiScale(settings.uiScale)
    })
  }, [])
  const showFilmStrip = useSessionStore(s => s.showFilmStrip)
  const viewMode = useSessionStore(s => s.viewMode)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupId = useSessionStore(s => s.expandedGroupId)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const extensionFilter = useSessionStore(s => s.extensionFilter)
  const images = useSessionStore(s => s.images)
  const temporalStore = useSessionStore.temporal
  const canUndo = useStoreWithEqualityFn(temporalStore, s => s.pastStates.length > 0)
  const canRedo = useStoreWithEqualityFn(temporalStore, s => s.futureStates.length > 0)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupId, filterPickedOnly, extensionFilter),
    [groups, expandedGroupId, filterPickedOnly, extensionFilter],
  )
  const pickedCount = useMemo(() => images.filter(i => i.picked).length, [images])

  const currentItem = flatItems[currentIndex]
  const currentFileName = currentItem ? getBaseName(currentItem.image.filePath) : ''

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) useSessionStore.getState().setFolderPath(path)
  }

  const handleTabSelect = (_: unknown, data: { value: unknown }) => {
    const mode = data.value as ViewMode
    if (mode === 'compare') {
      useSessionStore.getState().enterCompare()
    } else {
      useSessionStore.getState().setViewMode(mode)
    }
  }

  const hasImages = images.length > 0

  return (
    <div className={styles.root}>
      {/* ホーム（最左） */}
      <div className={styles.homeButton}>
        <Tooltip content="ホーム" relationship="description">
          <ToolbarButton
            icon={<Home24Regular />}
            onClick={() => useSessionStore.getState().clearSession()}
            disabled={!hasImages}
          />
        </Tooltip>
      </div>

      <ToolbarDivider />

      {hasImages ? (
        <>
          {/* モード切替タブ */}
          <TabList
            className={styles.tabs}
            size="small"
            appearance="subtle"
            selectedValue={viewMode}
            onTabSelect={handleTabSelect}
          >
            <Tab icon={<Grid24Regular />} value="grid">
              グリッド
            </Tab>
            <Tab icon={<Image24Regular />} value="preview">
              プレビュー
            </Tab>
            <Tab icon={<DualScreen24Regular />} value="compare">
              比較
            </Tab>
          </TabList>

          {/* ファイル名 */}
          <Text className={styles.fileName} title={currentFileName}>
            {currentFileName}
          </Text>

          {/* ピック・ゴミ箱ボタン */}
          <div className={styles.actions}>
            <Tooltip content="ピック (Space)" relationship="description">
              <ToolbarButton
                icon={currentItem?.image.picked
                  ? <Star24Filled className={styles.starActive} />
                  : <Star24Regular className={styles.starInactive} />}
                onClick={() => useSessionStore.getState().togglePick()}
                aria-pressed={currentItem?.image.picked}
                disabled={!currentItem}
              />
            </Tooltip>
            <Tooltip content="削除 (Del)" relationship="description">
              <ToolbarButton
                icon={<Delete24Regular />}
                onClick={() => {
                  const sel = useSelectionStore.getState()
                  if (sel.getSelectedCount() > 0) {
                    useSessionStore.getState().requestDelete(sel.getSelectedKeys())
                    sel.clearSelection()
                  } else {
                    useSessionStore.getState().requestDelete()
                  }
                }}
                disabled={!currentItem}
              />
            </Tooltip>

            <ToolbarDivider />

            {/* Undo/Redo・フィルタ */}
            <Tooltip content="元に戻す (Ctrl+Z)" relationship="description">
              <ToolbarButton
                icon={<ArrowUndo24Regular />}
                onClick={() => useSessionStore.temporal.getState().undo()}
                disabled={!canUndo}
              />
            </Tooltip>
            <Tooltip content="やり直す (Ctrl+Y)" relationship="description">
              <ToolbarButton
                icon={<ArrowRedo24Regular />}
                onClick={() => useSessionStore.temporal.getState().redo()}
                disabled={!canRedo}
              />
            </Tooltip>
            <Tooltip content="ピック済みフィルタ (Q)" relationship="description">
              <ToolbarButton
                icon={filterPickedOnly
                  ? <Filter24Filled className={styles.filterActive} />
                  : <Filter24Regular />}
                onClick={() => useSessionStore.getState().togglePickedFilter()}
                aria-pressed={filterPickedOnly}
                disabled={pickedCount === 0 && !filterPickedOnly}
              />
            </Tooltip>

            <ToolbarDivider />

            {/* フォルダ・エクスポート・ゴミ箱管理 */}
            <Tooltip content="フォルダを開く (Ctrl+O)" relationship="description">
              <ToolbarButton
                icon={<FolderOpen24Regular />}
                onClick={handleSelectFolder}
              />
            </Tooltip>
            <Tooltip content="エクスポート (Ctrl+E)" relationship="description">
              <ToolbarButton
                icon={<ArrowExportUp24Regular />}
                onClick={() => window.dispatchEvent(new CustomEvent('cullno:export'))}
                disabled={pickedCount === 0}
              />
            </Tooltip>
          </div>
        </>
      ) : (
        /* Home画面時: 中央にアプリ名 */
        <Text className={styles.fileName} style={{ fontWeight: 600 }}>
          Cullno
        </Text>
      )}

      {/* 歯車メニュー（常に表示・最右端） */}
      <Menu
        open={settingsMenuOpen}
        onOpenChange={(_, data) => setSettingsMenuOpen(data.open)}
        persistOnItemClick
        checkedValues={{
          settings: [
            ...(showShortcutNav ? ['shortcutNav'] : []),
            ...(showFilmStrip ? ['filmStrip'] : []),
            ...(autoExpandBurst ? ['autoExpand'] : []),
            ...(theme === 'light' ? ['lightMode'] : []),
          ],
          scale: [String(uiScale)],
        }}
      >
        <MenuTrigger>
          <Tooltip content="設定" relationship="description">
            <ToolbarButton icon={<Settings24Regular />} />
          </Tooltip>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem onClick={() => { setSettingsMenuOpen(false); setKeybindDialogOpen(true) }}>
              キーバインド設定
            </MenuItem>
            <MenuItem onClick={async () => {
              setSettingsMenuOpen(false)
              const filePath = await window.electronAPI.selectImageFile()
              if (filePath) {
                const settings = await window.electronAPI.loadSettings()
                await window.electronAPI.saveSettings({ ...settings, homeBackground: filePath })
                window.dispatchEvent(new CustomEvent('cullno:home-bg-change', { detail: filePath }))
              }
            }}>
              背景画像を設定
            </MenuItem>
            <MenuItem onClick={async () => {
              setSettingsMenuOpen(false)
              const settings = await window.electronAPI.loadSettings()
              await window.electronAPI.saveSettings({ ...settings, homeBackground: undefined })
              window.dispatchEvent(new CustomEvent('cullno:home-bg-change', { detail: null }))
            }}>
              背景画像をクリア
            </MenuItem>
            <MenuItemCheckbox name="settings" value="shortcutNav"
              onClick={() => useKeybindStore.getState().toggleShortcutNav()}>
              ショートカットナビ
            </MenuItemCheckbox>
            <MenuItemCheckbox name="settings" value="filmStrip"
              onClick={() => useSessionStore.getState().setShowFilmStrip(!showFilmStrip)}>
              フィルムストリップ
            </MenuItemCheckbox>
            <MenuItemCheckbox name="settings" value="autoExpand"
              onClick={async () => {
                const newVal = !autoExpandBurst
                setAutoExpandBurst(newVal)
                const settings = await window.electronAPI.loadSettings()
                await window.electronAPI.saveSettings({ ...settings, autoExpandBurst: newVal })
                const s = useSessionStore.getState()
                if (newVal) {
                  if (!s.expandedGroupId) {
                    useSessionStore.setState({ expandedGroupId: '__all__' })
                  }
                } else if (s.expandedGroupId) {
                  useSessionStore.setState({ expandedGroupId: null, currentIndex: 0 })
                }
              }}>
              連射自動展開
            </MenuItemCheckbox>
            <MenuItemCheckbox name="settings" value="lightMode"
              onClick={async () => {
                const newTheme = theme === 'dark' ? 'light' : 'dark'
                setTheme(newTheme)
                const settings = await window.electronAPI.loadSettings()
                await window.electronAPI.saveSettings({ ...settings, theme: newTheme })
                window.dispatchEvent(new CustomEvent('cullno:theme-change', { detail: newTheme }))
              }}>
              ライトモード
            </MenuItemCheckbox>
            <Menu persistOnItemClick>
              <MenuTrigger disableButtonEnhancement>
                <MenuItem>UIスケール: {uiScale}%</MenuItem>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {[80, 90, 100, 110, 120, 130, 140, 150].map(v => (
                    <MenuItemRadio key={v} name="scale" value={String(v)}
                      onClick={async () => {
                        setUiScale(v)
                        const settings = await window.electronAPI.loadSettings()
                        await window.electronAPI.saveSettings({ ...settings, uiScale: v })
                        window.dispatchEvent(new CustomEvent('cullno:scale-change', { detail: v }))
                      }}>
                      {v}%
                    </MenuItemRadio>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
            <MenuDivider />
            <MenuItem onClick={async () => {
              setSettingsMenuOpen(false)
              setUpdateChecking(true)
              const result = await window.electronAPI.checkForUpdates()
              setUpdateChecking(false)
              setUpdateResult(result)
            }}>
              アップデート確認
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <KeybindDialog open={keybindDialogOpen} onClose={() => setKeybindDialogOpen(false)} />

      {/* アップデート確認ダイアログ */}
      <Dialog open={updateChecking || updateResult !== null} onOpenChange={() => { if (!updateChecking) setUpdateResult(null) }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>アップデート確認</DialogTitle>
            <DialogContent>
              {updateChecking ? (
                <Text>確認中...</Text>
              ) : updateResult?.error ? (
                <Text>確認に失敗しました: {updateResult.error}</Text>
              ) : updateResult?.hasUpdate ? (
                <>
                  <Text block>新しいバージョンがあります！</Text>
                  <Text block style={{ marginTop: 8 }}>
                    現在: v{updateResult.currentVersion} → 最新: v{updateResult.latestVersion}
                  </Text>
                </>
              ) : (
                <Text>最新バージョン（v{updateResult?.currentVersion}）を使用中です。</Text>
              )}
            </DialogContent>
            <DialogActions>
              {updateResult?.hasUpdate && updateResult.releaseUrl && (
                <Button appearance="primary" onClick={() => {
                  window.electronAPI.openExternal(updateResult.releaseUrl!)
                  setUpdateResult(null)
                }}>
                  ダウンロードページを開く
                </Button>
              )}
              <Button appearance="secondary" onClick={() => setUpdateResult(null)} disabled={updateChecking}>
                閉じる
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
