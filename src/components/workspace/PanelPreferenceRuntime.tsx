'use client'

import { useEffect } from 'react'
import { useEditorStore } from '@/store/editor-store'
import {
  DEFAULT_EXPLORER_WIDTH,
  MAX_EXPLORER_WIDTH,
  MIN_EXPLORER_WIDTH,
  PANEL_PREFERENCE_KEYS,
  parseStoredBoolean,
  parseStoredPanelWidth,
} from '@/lib/panel-preferences'

export function PanelPreferenceRuntime() {
  useEffect(() => {
    const initialState = useEditorStore.getState()
    const savedWidth = parseStoredPanelWidth(
      localStorage.getItem(PANEL_PREFERENCE_KEYS.explorerWidth),
      MIN_EXPLORER_WIDTH,
      MAX_EXPLORER_WIDTH,
      DEFAULT_EXPLORER_WIDTH
    )
    const savedOpen = parseStoredBoolean(
      localStorage.getItem(PANEL_PREFERENCE_KEYS.explorerOpen),
      initialState.sidebarOpen
    )

    if (savedWidth !== initialState.sidebarWidth) initialState.setSidebarWidth(savedWidth)
    if (savedOpen !== initialState.sidebarOpen) initialState.toggleSidebar()

    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (state.sidebarWidth !== previousState.sidebarWidth) {
        localStorage.setItem(PANEL_PREFERENCE_KEYS.explorerWidth, String(state.sidebarWidth))
      }
      if (state.sidebarOpen !== previousState.sidebarOpen) {
        localStorage.setItem(PANEL_PREFERENCE_KEYS.explorerOpen, String(state.sidebarOpen))
      }
    })

    return unsubscribe
  }, [])

  return null
}
