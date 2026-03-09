import { useState, useEffect, useMemo } from 'react'
import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Button, Text, makeStyles, tokens,
} from '@fluentui/react-components'
import { Delete24Regular } from '@fluentui/react-icons'
import { useSessionStore } from '../stores/useSessionStore'

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
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
})

export function TrashDialog() {
  const styles = useStyles()
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [result, setResult] = useState<{ moved: number; failed: number } | null>(null)

  const images = useSessionStore(s => s.images)
  const trashedImages = useMemo(() => images.filter(i => i.trashed), [images])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('cullno:trash', handler)
    return () => window.removeEventListener('cullno:trash', handler)
  }, [])

  const handleMoveToTrash = async () => {
    setMoving(true)
    const results = await window.electronAPI.moveToTrash(trashedImages.map(i => i.filePath))
    const moved = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    setResult({ moved, failed })
    setMoving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open); setResult(null) }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>ゴミ箱管理</DialogTitle>
          <DialogContent>
            <div className={styles.info}>
              <Text>ゴミ箱マーク済み: {trashedImages.length} 枚</Text>
              <Text size={200}>
                trash/ フォルダへ移動します（元フォルダ内）
              </Text>
            </div>
            {result && (
              <Text className={result.failed > 0 ? styles.error : styles.success}>
                {result.moved} 枚を移動{result.failed > 0 ? ` (${result.failed} 枚失敗)` : ''}
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>閉じる</Button>
            {!result && (
              <Button
                appearance="primary"
                icon={<Delete24Regular />}
                onClick={handleMoveToTrash}
                disabled={moving || trashedImages.length === 0}
              >
                {moving ? '移動中...' : 'ゴミ箱へ移動'}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
