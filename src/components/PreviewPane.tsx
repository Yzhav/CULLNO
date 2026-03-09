import { makeStyles, tokens, Spinner } from '@fluentui/react-components'
import { useProgressiveThumbnail } from '../hooks/useThumbnail'

const useStyles = makeStyles({
  root: {
    flex: 1,
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    cursor: 'pointer',
    userSelect: 'none',
  },
  imageContainer: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: tokens.colorNeutralForeground4,
  },
  trashedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: '8px',
    right: '12px',
    zIndex: 10,
    pointerEvents: 'none',
    opacity: 0.5,
  },
})

interface PreviewPaneProps {
  filePath: string | null
  trashed?: boolean
  onClickImage?: () => void
}

export function PreviewPane({ filePath, trashed, onClickImage }: PreviewPaneProps) {
  const styles = useStyles()
  const { dataUrl, loading } = useProgressiveThumbnail(filePath)

  return (
    <div className={styles.root} onClick={onClickImage}>
      <div className={styles.imageContainer}>
        {filePath && !dataUrl && (
          <div className={styles.placeholder}>
            <Spinner size="medium" />
          </div>
        )}
        {!filePath && (
          <div className={styles.placeholder}>
            <span style={{ fontSize: 14 }}>画像なし</span>
          </div>
        )}
        {dataUrl && (
          <img
            src={dataUrl}
            className={styles.image}
            draggable={false}
          />
        )}
      </div>
      {trashed && <div className={styles.trashedOverlay} />}
      {loading && (
        <div className={styles.loadingIndicator}>
          <Spinner size="tiny" />
        </div>
      )}
    </div>
  )
}
