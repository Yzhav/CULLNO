import { useEffect } from 'react'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'

export function useKeyBindings() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const s = useSessionStore.getState()

      // --- グローバルショートカット（全モード共通）---

      // Ctrl+O: フォルダ選択
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        window.electronAPI.selectFolder().then(path => {
          if (path) s.setFolderPath(path)
        })
        return
      }

      // Ctrl+E: エクスポート
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('cullno:export'))
        return
      }

      // F: フルスクリーン
      if (e.key === 'f' && !e.ctrlKey && !e.altKey) {
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('cullno:fullscreen'))
        return
      }

      // Q: ピック済みフィルタトグル（全モード）
      if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.altKey) {
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        e.preventDefault()
        s.togglePickedFilter()
        return
      }

      // --- 比較モード ---
      if (s.viewMode === 'compare') {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            s.navigateBy(-1)
            break
          case 'ArrowRight':
            e.preventDefault()
            s.navigateBy(1)
            break
          case ' ':
            e.preventDefault()
            s.compareSwapPick()
            break
          case 'Tab':
          case 'Escape':
            e.preventDefault()
            s.exitCompare()
            break
        }
        return
      }

      // --- グリッドモード ---
      if (s.viewMode === 'grid') {
        const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            s.navigateBy(-1)
            break
          case 'ArrowRight':
            e.preventDefault()
            s.navigateBy(1)
            break
          case 'ArrowUp':
            e.preventDefault()
            s.navigateBy(-s.gridColumnCount)
            break
          case 'ArrowDown':
            e.preventDefault()
            s.navigateBy(s.gridColumnCount)
            break
          case ' ':
            e.preventDefault()
            s.togglePick()
            break
          case 'e':
          case 'E':
          case 'Enter': {
            e.preventDefault()
            const item = flat[s.currentIndex]
            if (item?.type === 'burst-rep' && item.group) {
              s.toggleBurstExpand(item.group.id)
            } else if (item?.type === 'burst-child') {
              s.collapseBurst()
            } else if (e.key === 'Enter') {
              s.setViewMode('preview')
            }
            break
          }
          case 'Escape':
            e.preventDefault()
            if (s.expandedGroupId) {
              s.collapseBurst()
            }
            break
          case 'Delete':
          case 'Backspace':
            e.preventDefault()
            s.toggleTrash()
            break
        }
        return
      }

      // --- プレビューモード ---
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          s.navigateBy(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          s.navigateBy(1)
          break
        case ' ':
          e.preventDefault()
          s.togglePick()
          break
        case 'Tab':
          e.preventDefault()
          s.enterCompare()
          break
        case 'e':
        case 'E':
        case 'Enter': {
          e.preventDefault()
          const flat = buildFlatItems(s.groups, s.expandedGroupId, s.filterPickedOnly)
          const item = flat[s.currentIndex]
          if (item?.type === 'burst-rep' && item.group) {
            s.toggleBurstExpand(item.group.id)
          } else if (item?.type === 'burst-child') {
            s.collapseBurst()
          }
          break
        }
        case 'Escape':
          e.preventDefault()
          if (s.expandedGroupId) {
            s.collapseBurst()
          } else {
            s.setViewMode('grid')
          }
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          s.toggleTrash()
          break
      }
    }

    // 右クリックで比較モード/バースト展開から戻る
    const handleContextMenu = (e: MouseEvent) => {
      const s = useSessionStore.getState()
      if (s.viewMode === 'compare') {
        e.preventDefault()
        s.exitCompare()
      } else if (s.expandedGroupId) {
        e.preventDefault()
        s.collapseBurst()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])
}
