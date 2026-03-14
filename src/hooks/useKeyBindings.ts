import { useEffect } from 'react'
import { useSessionStore, buildFlatItems } from '../stores/useSessionStore'
import { useSelectionStore } from '../stores/useSelectionStore'
import { useKeybindStore } from '../stores/useKeybindStore'
import { folderDialogGuard, withDialogGuard } from '../utils/dialogGuard'

export function useKeyBindings() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const s = useSessionStore.getState()
      const tag = (e.target as HTMLElement).tagName
      const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      // Input/Textarea にフォーカスがある場合、Ctrl系ショートカット以外は無視
      if (isInputFocused && !e.ctrlKey) return

      const kb = useKeybindStore.getState().keybinds

      // --- グローバルショートカット（全モード共通）---

      // Ctrl+O: フォルダ選択
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        if (e.repeat) return
        withDialogGuard(folderDialogGuard, async () => {
          const path = await window.electronAPI.selectFolder()
          if (path) s.setFolderPath(path)
        })
        return
      }

      // Ctrl+E: エクスポート
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        if (e.repeat) return
        window.dispatchEvent(new CustomEvent('cullno:export'))
        return
      }

      // Ctrl+Z: Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useSessionStore.temporal.getState().undo()
        return
      }

      // Ctrl+Y / Ctrl+Shift+Z: Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault()
        useSessionStore.temporal.getState().redo()
        return
      }

      // フルスクリーン（キーバインド設定可能）
      if (e.key === kb.fullscreen && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('cullno:fullscreen'))
        return
      }

      // ピック済みフィルタトグル（全モード、キーバインド設定可能）
      if ((e.key === kb.pickedFilter || e.key === kb.pickedFilter.toUpperCase()) && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        s.togglePickedFilter()
        return
      }

      // 比較モード直接移行（キーバインド設定時のみ有効）
      if (kb.compare && e.key === kb.compare && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (s.viewMode === 'compare') {
          s.exitCompare()  // 直前のモードに戻る
        } else {
          s.enterCompare()
        }
        return
      }

      // --- 比較モード ---
      if (s.viewMode === 'compare') {
        if (e.key === kb.navigatePrev) {
          e.preventDefault()
          s.navigateBy(-1)
          return
        }
        if (e.key === kb.navigateNext) {
          e.preventDefault()
          s.navigateBy(1)
          return
        }
        if (e.key === kb.pick) {
          e.preventDefault()
          s.compareSwapPick()
          return
        }
        // Tab: 比較→グリッドへサイクル（Tabは常にサイクル順）
        if (e.key === kb.modeTransition) {
          e.preventDefault()
          s.setViewMode('grid')
          return
        }
        // Escape: 比較終了（ハードコード）
        if (e.key === 'Escape') {
          e.preventDefault()
          s.exitCompare()
          return
        }
        return
      }

      // --- グリッドモード ---
      if (s.viewMode === 'grid') {
        const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)

        if (e.key === kb.navigatePrev) {
          e.preventDefault()
          useSelectionStore.getState().clearSelection()
          s.navigateBy(-1)
          return
        }
        if (e.key === kb.navigateNext) {
          e.preventDefault()
          useSelectionStore.getState().clearSelection()
          s.navigateBy(1)
          return
        }
        if (e.key === kb.navigateUp) {
          e.preventDefault()
          useSelectionStore.getState().clearSelection()
          s.navigateBy(-s.gridColumnCount)
          return
        }
        if (e.key === kb.navigateDown) {
          e.preventDefault()
          useSelectionStore.getState().clearSelection()
          s.navigateBy(s.gridColumnCount)
          return
        }
        if (e.key === kb.pick) {
          e.preventDefault()
          if (useSelectionStore.getState().getSelectedCount() > 0) {
            const keys = useSelectionStore.getState().getSelectedKeys()
            const allPicked = keys.every(idx => flat[idx]?.image.picked)
            if (allPicked) {
              s.unpickSelected(keys)
            } else {
              s.pickSelected(keys)
            }
            useSelectionStore.getState().clearSelection()
          } else {
            s.togglePick()
          }
          return
        }
        // Escape: 選択クリアのみ（ハードコード）
        if (e.key === 'Escape') {
          if (useSelectionStore.getState().getSelectedCount() > 0) {
            e.preventDefault()
            useSelectionStore.getState().clearSelection()
          }
          return
        }
        // 連射展開/折畳（burstToggleキーのみ）
        if (e.key === kb.burstToggle || e.key === kb.burstToggle.toUpperCase()) {
          e.preventDefault()
          const item = flat[s.currentIndex]
          if (item?.type === 'burst-rep' && item.group) {
            s.toggleBurstExpand(item.group.id)
          } else if (item?.type === 'burst-child') {
            s.collapseBurst()
          }
          return
        }
        // Tab: grid → preview へサイクル
        if (e.key === kb.modeTransition) {
          e.preventDefault()
          s.setViewMode('preview')
          return
        }
        if (e.key === kb.trash || e.key === 'Backspace') {
          e.preventDefault()
          if (useSelectionStore.getState().getSelectedCount() > 0) {
            const keys = useSelectionStore.getState().getSelectedKeys()
            s.requestDelete(keys)
            useSelectionStore.getState().clearSelection()
          } else {
            s.requestDelete()
          }
          return
        }
        return
      }

      // --- プレビューモード ---
      if (e.key === kb.navigatePrev) {
        e.preventDefault()
        s.navigateBy(-1)
        return
      }
      if (e.key === kb.navigateNext) {
        e.preventDefault()
        s.navigateBy(1)
        return
      }
      if (e.key === kb.pick) {
        e.preventDefault()
        s.togglePick()
        return
      }
      // Tab: preview → compare or grid
      if (e.key === kb.modeTransition) {
        e.preventDefault()
        if (kb.compare) {
          // 比較に専用キーがあるならTab循環から除外 → gridへ
          s.setViewMode('grid')
        } else {
          s.enterCompare()
        }
        return
      }
      // 連射展開/折畳（burstToggleキーのみ）
      if (e.key === kb.burstToggle || e.key === kb.burstToggle.toUpperCase()) {
        e.preventDefault()
        const flat = buildFlatItems(s.groups, s.expandedGroupIds, s.filterPickedOnly, s.extensionFilter)
        const item = flat[s.currentIndex]
        if (item?.type === 'burst-rep' && item.group) {
          s.toggleBurstExpand(item.group.id)
        } else if (item?.type === 'burst-child') {
          s.collapseBurst()
        }
        return
      }
      // Escape: プレビューモードでは何もしない（ハードコード・選択クリアのみ）
      if (e.key === 'Escape') {
        // プレビューモードのEscapeは何も実行しない（Tabサイクルに統一）
        return
      }
      if (e.key === kb.trash || e.key === 'Backspace') {
        e.preventDefault()
        s.requestDelete()
        return
      }
    }

    // 右クリックで比較モード/連射展開から戻る
    const handleContextMenu = (e: MouseEvent) => {
      const s = useSessionStore.getState()
      if (s.viewMode === 'compare') {
        e.preventDefault()
        s.exitCompare()
      } else if (s.expandedGroupIds.length > 0) {
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
