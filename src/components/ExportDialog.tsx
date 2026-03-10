import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Button, ProgressBar, Text, Input, Label, Switch, Slider, Dropdown, Option, makeStyles, tokens,
} from '@fluentui/react-components'
import { ArrowExportUp24Regular, FolderOpen20Regular } from '@fluentui/react-icons'
import { useSessionStore } from '../stores/useSessionStore'
import type { ExportFormat, ExportProgress } from '../types'
import { getBaseName } from '../utils/fileUtils'

const useStyles = makeStyles({
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  pathInput: {
    flex: 1,
  },
  preview: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
    marginTop: '4px',
    wordBreak: 'break-all',
  },
  success: {
    color: tokens.colorPaletteGreenForeground1,
  },
})

export function ExportDialog() {
  const styles = useStyles()
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [done, setDone] = useState(false)

  // 設定
  const [subfolderName, setSubfolderName] = useState('export')
  const [useSubfolder, setUseSubfolder] = useState(true)
  const [suffix, setSuffix] = useState('')
  const [customBasePath, setCustomBasePath] = useState('')
  const [format, setFormat] = useState<ExportFormat>('png')
  const [jpegQuality, setJpegQuality] = useState(90)

  const images = useSessionStore(s => s.images)
  const folderPath = useSessionStore(s => s.folderPath)
  const pickedImages = useMemo(() => images.filter(i => i.picked), [images])

  // ダイアログが開くたびにベースパスをリセット
  useEffect(() => {
    if (open && folderPath) {
      setCustomBasePath(folderPath.replace(/[/\\]$/, ''))
      setDone(false)
      setProgress(null)
    }
  }, [open, folderPath])

  const openRef = useRef(false)
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    const handler = () => { if (!openRef.current) setOpen(true) }
    window.addEventListener('cullno:export', handler)
    return () => window.removeEventListener('cullno:export', handler)
  }, [])

  useEffect(() => {
    if (!exporting) return
    const cleanup = window.electronAPI.onExportProgress(setProgress)
    return () => { cleanup() }
  }, [exporting])

  // 出力先パスの計算
  const outputDir = useMemo(() => {
    const base = customBasePath || folderPath?.replace(/[/\\]$/, '') || ''
    return useSubfolder ? `${base}/${subfolderName}` : base
  }, [customBasePath, folderPath, useSubfolder, subfolderName])

  // ファイル名プレビュー
  const ext = format === 'jpeg' ? '.jpg' : '.png'
  const fileNamePreview = useMemo(() => {
    if (pickedImages.length === 0) return ''
    const first = pickedImages[0]
    const baseName = getBaseName(first.filePath)
    return `${baseName}${suffix}${ext}`
  }, [pickedImages, suffix, ext])

  const handleSelectFolder = useCallback(async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setCustomBasePath(path.replace(/[/\\]$/, ''))
      setUseSubfolder(false)
    }
  }, [])

  const handleExport = async () => {
    if (!outputDir || pickedImages.length === 0) return
    setExporting(true)
    setDone(false)

    await window.electronAPI.exportPng(
      pickedImages.map(i => i.filePath),
      outputDir,
      suffix || undefined,
      format,
      format === 'jpeg' ? jpegQuality : undefined,
    )
    setExporting(false)
    setDone(true)
  }

  const handleOpenFolder = () => {
    if (outputDir) {
      window.electronAPI.openInExplorer(outputDir)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open) }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>エクスポート</DialogTitle>
          <DialogContent>
            <div className={styles.info}>
              <Text>ピック済み: {pickedImages.length} 枚</Text>

              {/* 出力形式 */}
              <div className={styles.field}>
                <Label size="small">出力形式</Label>
                <Dropdown
                  size="small"
                  value={format === 'jpeg' ? 'JPEG' : 'PNG'}
                  selectedOptions={[format]}
                  onOptionSelect={(_, d) => setFormat(d.optionValue as ExportFormat)}
                >
                  <Option value="png">PNG</Option>
                  <Option value="jpeg">JPEG</Option>
                </Dropdown>
              </div>

              {/* JPEG品質 */}
              {format === 'jpeg' && (
                <div className={styles.field}>
                  <Label size="small">JPEG品質: {jpegQuality}%</Label>
                  <Slider
                    min={10}
                    max={100}
                    step={5}
                    value={jpegQuality}
                    onChange={(_, d) => setJpegQuality(d.value)}
                    size="small"
                    aria-label="JPEG品質"
                  />
                </div>
              )}

              {/* サブフォルダ設定 */}
              <div className={styles.field}>
                <Switch
                  checked={useSubfolder}
                  onChange={(_, d) => setUseSubfolder(d.checked)}
                  label="サブフォルダに出力"
                />
                {useSubfolder && (
                  <Input
                    size="small"
                    value={subfolderName}
                    onChange={(_, d) => setSubfolderName(d.value)}
                    placeholder="export"
                  />
                )}
              </div>

              {/* 保存先 */}
              <div className={styles.field}>
                <Label size="small">保存先</Label>
                <div className={styles.pathRow}>
                  <Input
                    className={styles.pathInput}
                    size="small"
                    value={customBasePath}
                    onChange={(_, d) => setCustomBasePath(d.value)}
                  />
                  <Button
                    size="small"
                    icon={<FolderOpen20Regular />}
                    onClick={handleSelectFolder}
                  />
                </div>
                <Text className={styles.preview}>{outputDir}/</Text>
              </div>

              {/* ファイル名suffix */}
              <div className={styles.field}>
                <Label size="small">ファイル名サフィックス</Label>
                <Input
                  size="small"
                  value={suffix}
                  onChange={(_, d) => setSuffix(d.value)}
                  placeholder="例: _picked"
                />
                {fileNamePreview && (
                  <Text className={styles.preview}>{fileNamePreview}</Text>
                )}
              </div>
            </div>

            {exporting && progress && (
              <>
                <ProgressBar value={progress.current / progress.total} />
                <Text size={200}>
                  {progress.current} / {progress.total} — {progress.currentFile}
                </Text>
              </>
            )}
            {done && (
              <Text className={styles.success}>
                エクスポート完了
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            {done ? (
              <>
                <Button onClick={handleOpenFolder}>フォルダを開く</Button>
                <Button appearance="primary" onClick={() => setOpen(false)}>閉じる</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setOpen(false)}>キャンセル</Button>
                <Button
                  appearance="primary"
                  icon={<ArrowExportUp24Regular />}
                  onClick={handleExport}
                  disabled={exporting || pickedImages.length === 0}
                >
                  {exporting ? '変換中...' : 'エクスポート'}
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
