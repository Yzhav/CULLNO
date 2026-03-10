import { useState, useCallback } from 'react'
import {
  makeStyles, tokens,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
  Button, Text,
} from '@fluentui/react-components'
import type { KeyAction, KeybindConfig } from '../types'
import { useKeybindStore, ALL_KEY_ACTIONS } from '../stores/useKeybindStore'
import { getKeyDisplay } from '../utils/keybindUtils'

const ACTION_LABELS: Record<KeyAction, string> = {
  navigatePrev: '前へ移動',
  navigateNext: '次へ移動',
  navigateUp: '上へ移動（グリッド）',
  navigateDown: '下へ移動（グリッド）',
  pick: 'ピック',
  modeTransition: 'モード切替',
  burstToggle: '連射展開/折畳',
  trash: 'ゴミ箱',
  fullscreen: 'フルスクリーン',
  pickedFilter: 'ピック済みフィルタ',
  compare: '比較モード',
}

const useStyles = makeStyles({
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '6px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  tr: {
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  tdAction: {
    padding: '8px 12px',
    fontSize: tokens.fontSizeBase300,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  tdKey: {
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    width: '160px',
  },
  keyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '80px',
    padding: '4px 10px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    fontFamily: 'monospace',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  keyButtonCapturing: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '80px',
    padding: '4px 10px',
    border: `2px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase300,
    fontFamily: 'monospace',
    cursor: 'pointer',
    animation: 'pulse 1s infinite',
  },
  warningText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteYellowForeground1,
    marginTop: '2px',
    display: 'block',
  },
  dialogContent: {
    padding: '0',
    overflowY: 'auto',
    maxHeight: '60vh',
  },
  footer: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    width: '100%',
  },
})

interface KeybindDialogProps {
  open: boolean
  onClose: () => void
}

export function KeybindDialog({ open, onClose }: KeybindDialogProps) {
  const styles = useStyles()
  const { keybinds, saveKeybinds, resetToDefault } = useKeybindStore()
  const [capturingAction, setCapturingAction] = useState<KeyAction | null>(null)
  const [warningInfo, setWarningInfo] = useState<{ action: KeyAction; conflictWith: KeyAction } | null>(null)

  const handleKeyButtonClick = useCallback((action: KeyAction) => {
    setCapturingAction(action)
    setWarningInfo(null)
  }, [])

  const handleKeyCapture = useCallback((e: React.KeyboardEvent, action: KeyAction) => {
    // Escapeはキャンセル（ダイアログは閉じない）
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setCapturingAction(null)
      return
    }

    // 修飾キー単体は無視
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

    e.preventDefault()
    e.stopPropagation()

    // Deleteキーで未設定にクリア
    if (e.key === 'Delete') {
      const newConfig: KeybindConfig = { ...keybinds, [action]: '' }
      saveKeybinds(newConfig)
      setCapturingAction(null)
      setWarningInfo(null)
      return
    }

    const newKey = e.key

    // 重複チェック（空文字列は除外）
    const conflictAction = (Object.entries(keybinds) as [KeyAction, string][]).find(
      ([act, key]) => act !== action && key !== '' && key === newKey
    )

    setWarningInfo(conflictAction
      ? { action, conflictWith: conflictAction[0] }
      : null
    )

    // 割り当て（重複でも保存）
    const newConfig: KeybindConfig = { ...keybinds, [action]: newKey }
    saveKeybinds(newConfig)
    setCapturingAction(null)
  }, [keybinds, saveKeybinds])

  const handleReset = useCallback(async () => {
    await resetToDefault()
    setCapturingAction(null)
    setWarningInfo(null)
  }, [resetToDefault])

  return (
    <Dialog open={open} onOpenChange={(_e, data) => { if (!data.open) onClose() }}>
      <DialogSurface style={{ minWidth: '480px' }}>
        <DialogBody>
          <DialogTitle>キーバインド設定</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>操作</th>
                  <th className={styles.th}>キー</th>
                </tr>
              </thead>
              <tbody>
                {ALL_KEY_ACTIONS.map(action => {
                  const isCapturing = capturingAction === action
                  const currentKey = keybinds[action]
                  const warning = warningInfo?.action === action ? warningInfo : null

                  return (
                    <tr key={action} className={styles.tr}>
                      <td className={styles.tdAction}>
                        <Text>{ACTION_LABELS[action]}</Text>
                      </td>
                      <td className={styles.tdKey}>
                        <div
                          className={isCapturing ? styles.keyButtonCapturing : styles.keyButton}
                          tabIndex={0}
                          onClick={() => handleKeyButtonClick(action)}
                          onKeyDown={isCapturing ? (e) => handleKeyCapture(e, action) : undefined}
                          role="button"
                          aria-label={`${ACTION_LABELS[action]}のキー: ${getKeyDisplay(currentKey)}。クリックして変更`}
                        >
                          {isCapturing ? 'キーを入力…' : getKeyDisplay(currentKey)}
                        </div>
                        {warning && (
                          <span className={styles.warningText}>
                            「{ACTION_LABELS[warning.conflictWith]}」にも割り当てられています
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DialogContent>
          <DialogActions>
            <div className={styles.footer}>
              <Button appearance="subtle" onClick={handleReset}>
                デフォルトに戻す
              </Button>
              <Button appearance="primary" onClick={onClose}>
                閉じる
              </Button>
            </div>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
