import { makeStyles, tokens, Text, Badge } from '@fluentui/react-components'
import type { BurstGroup } from '../types'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '4px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  label: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
})

interface BurstStackProps {
  group: BurstGroup
  isExpanded: boolean
  onClick: () => void
}

export function BurstStack({ group, isExpanded, onClick }: BurstStackProps) {
  const styles = useStyles()

  if (group.isSingle) return null

  return (
    <div className={styles.root} onClick={onClick}>
      <Badge size="small" appearance="filled" color="informative">
        {group.images.length}
      </Badge>
      <Text className={styles.label}>
        {isExpanded ? '折り畳む (Esc)' : 'バースト展開 (Enter)'}
      </Text>
    </div>
  )
}
