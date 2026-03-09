import { useState, useEffect, useMemo } from 'react'
import {
  Dialog, DialogTrigger, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Button, ProgressBar, Text, makeStyles, tokens,
} from '@fluentui/react-components'
import { ArrowExportUp24Regular } from '@fluentui/react-icons'
import { useSessionStore } from '../stores/useSessionStore'
import type { ExportProgress } from '../types'

const useStyles = makeStyles({
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
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

  const images = useSessionStore(s => s.images)
  const folderPath = useSessionStore(s => s.folderPath)
  const pickedImages = useMemo(() => images.filter(i => i.picked), [images])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('cullno:export', handler)
    return () => window.removeEventListener('cullno:export', handler)
  }, [])

  useEffect(() => {
    if (!exporting) return
    const cleanup = window.electronAPI.onExportProgress(setProgress)
    return () => { cleanup() }
  }, [exporting])

  const handleExport = async () => {
    if (!folderPath || pickedImages.length === 0) return
    setExporting(true)
    setDone(false)

    const outputDir = folderPath.replace(/[/\\]$/, '') + '/export'
    await window.electronAPI.exportPng(
      pickedImages.map(i => i.filePath),
      outputDir
    )
    setExporting(false)
    setDone(true)
  }

  const handleOpenFolder = () => {
    if (folderPath) {
      window.electronAPI.openInExplorer(folderPath.replace(/[/\\]$/, '') + '/export')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open); setDone(false); setProgress(null) }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>PNG エクスポート</DialogTitle>
          <DialogContent>
            <div className={styles.info}>
              <Text>ピック済み: {pickedImages.length} 枚</Text>
              <Text size={200}>出力先: {folderPath}/export/</Text>
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
                <DialogTrigger disableButtonEnhancement>
                  <Button>キャンセル</Button>
                </DialogTrigger>
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
