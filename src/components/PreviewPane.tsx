import { makeStyles, tokens, Spinner } from '@fluentui/react-components'
import { useProgressiveThumbnail } from '../hooks/useThumbnail'
import { getBaseName } from '../utils/fileUtils'

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
  onClickImage?: () => void
  'aria-label'?: string
}

export function PreviewPane({ filePath, onClickImage, 'aria-label': ariaLabel }: PreviewPaneProps) {
  const styles = useStyles()
  const { dataUrl, loading } = useProgressiveThumbnail(filePath)
  const fileName = filePath ? getBaseName(filePath) : ''

  return (
    <div className={styles.root} onClick={onClickImage} role="img" aria-label={ariaLabel ?? fileName}>
      <div className={styles.imageContainer}>
        {filePath && !dataUrl && (
          <div className={styles.placeholder}>
            <Spinner size="medium" aria-label="読み込み中" />
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
            alt={fileName}
          />
        )}
      </div>
      {loading && (
        <div className={styles.loadingIndicator}>
          <Spinner size="tiny" />
        </div>
      )}
    </div>
  )
}
