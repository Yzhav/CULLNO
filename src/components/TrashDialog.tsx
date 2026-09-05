import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
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
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const pendingDeletePaths = useSessionStore(s => s.pendingDeletePaths)
  const deleteError = useSessionStore(s => s.deleteError)
  const deleteKind = useSessionStore(s => s.deleteKind)
  const open = pendingDeletePaths !== null && pendingDeletePaths.length > 0

  useEffect(() => {
    if (open) {
      setOperationError(null)
      confirmRef.current?.focus()
    }
  }, [open])

  const handleConfirm = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setDeleting(true)
    setOperationError(null)
    try {
      await useSessionStore.getState().confirmDelete()
    } catch (error) {
      setOperationError(String(error))
    } finally {
      busyRef.current = false
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    if (busyRef.current) return
    setOperationError(null)
    useSessionStore.getState().cancelDelete()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (['ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(event.key)) {
      event.preventDefault()
      if (busyRef.current || event.repeat || event.nativeEvent.isComposing) return
      if (event.key === 'ArrowLeft') cancelRef.current?.focus()
      if (event.key === 'ArrowRight') confirmRef.current?.focus()
      if (event.key === 'Escape') handleCancel()
      if (event.key === 'Enter') {
        if (document.activeElement === cancelRef.current) handleCancel()
        else void handleConfirm()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) handleCancel() }}>
      <DialogSurface onKeyDown={handleKeyDown}>
        <DialogBody>
          <DialogTitle>{deleteKind === 'unpicked' ? '未ピックの写真を削除' : 'ファイル削除'}</DialogTitle>
          <DialogContent>
            <div className={styles.info}>
              <Text>{pendingDeletePaths?.length ?? 0} 枚の{deleteKind === 'unpicked' ? '未ピックの写真' : 'ファイル'}を削除しますか？</Text>
              {deleteKind === 'unpicked' && <Text>金色枠の写真は残します。確認後に追加された写真は対象に含みません。</Text>}
              <Text className={styles.warning}>
                元フォルダ内の trash/ に移動されます
              </Text>
              {(operationError || deleteError) && (
                <Text className={styles.warning}>{operationError || deleteError}</Text>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button ref={cancelRef} onClick={handleCancel} disabled={deleting}>キャンセル</Button>
            <Button
              ref={confirmRef}
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
