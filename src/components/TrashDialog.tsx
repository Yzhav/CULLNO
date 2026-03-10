import { useState } from 'react'
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
  },
  warning: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
  },
})

export function DeleteConfirmDialog() {
  const styles = useStyles()
  const [deleting, setDeleting] = useState(false)
  const pendingDeletePaths = useSessionStore(s => s.pendingDeletePaths)
  const open = pendingDeletePaths !== null && pendingDeletePaths.length > 0

  const handleConfirm = async () => {
    setDeleting(true)
    await useSessionStore.getState().confirmDelete()
    setDeleting(false)
  }

  const handleCancel = () => {
    useSessionStore.getState().cancelDelete()
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) handleCancel() }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>ファイル削除</DialogTitle>
          <DialogContent>
            <div className={styles.info}>
              <Text>{pendingDeletePaths?.length ?? 0} 枚のファイルを削除しますか？</Text>
              <Text className={styles.warning}>
                元フォルダ内の trash/ に移動されます
              </Text>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel} disabled={deleting}>キャンセル</Button>
            <Button
              appearance="primary"
              icon={<Delete24Regular />}
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? '削除中...' : '削除'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
