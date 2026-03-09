import { useMemo } from 'react'
import {
  makeStyles, tokens,
  ToolbarButton, ToolbarDivider, Tooltip,
  TabList, Tab, Text,
} from '@fluentui/react-components'
import {
  Home24Regular, FolderOpen24Regular,
  DualScreen24Regular, ArrowExportUp24Regular, Delete24Regular,
  Star24Filled, Star24Regular, Delete24Filled,
  Grid24Regular, Image24Regular, Filter24Regular, Filter24Filled,
} from '@fluentui/react-icons'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'
import type { ViewMode } from '../types'

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
  trashIcon: {
    color: tokens.colorPaletteRedForeground1,
  },
  filterActive: {
    color: tokens.colorBrandForeground1,
  },
})

export function CullnoToolbar() {
  const styles = useStyles()
  const viewMode = useSessionStore(s => s.viewMode)
  const currentIndex = useSessionStore(s => s.currentIndex)
  const groups = useSessionStore(s => s.groups)
  const expandedGroupId = useSessionStore(s => s.expandedGroupId)
  const filterPickedOnly = useSessionStore(s => s.filterPickedOnly)
  const images = useSessionStore(s => s.images)

  const flatItems = useMemo(
    () => buildFlatItems(groups, expandedGroupId, filterPickedOnly),
    [groups, expandedGroupId, filterPickedOnly],
  )
  const pickedCount = useMemo(() => images.filter(i => i.picked).length, [images])

  const currentItem = flatItems[currentIndex]
  const currentFileName = currentItem?.image.filePath.split(/[/\\]/).pop()?.replace('.tga', '') ?? ''

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) useSessionStore.getState().setFolderPath(path)
  }

  const handleTabSelect = (_: unknown, data: { value: unknown }) => {
    useSessionStore.getState().setViewMode(data.value as ViewMode)
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
            selectedValue={viewMode === 'compare' ? 'preview' : viewMode}
            onTabSelect={handleTabSelect}
          >
            <Tab icon={<Grid24Regular />} value="grid">
              グリッド
            </Tab>
            <Tab icon={<Image24Regular />} value="preview">
              プレビュー
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
            <Tooltip content="ゴミ箱 (Del)" relationship="description">
              <ToolbarButton
                icon={currentItem?.image.trashed
                  ? <Delete24Filled className={styles.trashIcon} />
                  : <Delete24Regular />}
                onClick={() => useSessionStore.getState().toggleTrash()}
                aria-pressed={currentItem?.image.trashed}
                disabled={!currentItem}
              />
            </Tooltip>

            <ToolbarDivider />

            {/* 比較・フィルタ */}
            <Tooltip content="比較モード (Tab)" relationship="description">
              <ToolbarButton
                icon={<DualScreen24Regular />}
                onClick={() => useSessionStore.getState().enterCompare()}
                disabled={flatItems.length === 0 || viewMode === 'grid'}
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
            <Tooltip content="ゴミ箱管理" relationship="description">
              <ToolbarButton
                icon={<Delete24Regular />}
                onClick={() => window.dispatchEvent(new CustomEvent('cullno:trash'))}
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
    </div>
  )
}
