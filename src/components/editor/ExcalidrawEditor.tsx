'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useEditorStore } from '@/store/editor-store'

interface ExcalidrawEditorProps {
  initialData?: string
}

export function ExcalidrawEditor({ initialData }: ExcalidrawEditorProps) {
  const [components, setComponents] = useState<{
    Excalidraw: React.ComponentType<any> | null
    MainMenu: any
    WelcomeScreen: any
  }>({ Excalidraw: null, MainMenu: null, WelcomeScreen: null })
  const [error, setError] = useState<string | null>(null)
  const theme = useEditorStore((state) => state.theme)
  const updateExcalidrawData = useEditorStore((state) => state.updateExcalidrawData)
  const saveCurrentFile = useEditorStore((state) => state.saveCurrentFile)
  
  const apiRef = useRef<any>(null)
  const isInitialLoad = useRef(true)
  const lastSavedData = useRef<string>('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const latestSceneRef = useRef<{ elements: readonly any[]; appState: any; files: any } | null>(null)

  // Dynamically import Excalidraw on client side only
  useEffect(() => {
    let mounted = true
    
    const loadExcalidraw = async () => {
      try {
        const excalidrawModule = await import('@excalidraw/excalidraw')
        
        if (!mounted) return
        
        setComponents({
          Excalidraw: excalidrawModule.Excalidraw,
          MainMenu: excalidrawModule.MainMenu,
          WelcomeScreen: excalidrawModule.WelcomeScreen
        })
        
        // Import CSS
        await import('@excalidraw/excalidraw/index.css')
      } catch (err) {
        console.error('Failed to load Excalidraw:', err)
        if (mounted) {
          setError('Failed to load Excalidraw. Please refresh the page.')
        }
      }
    }
    
    loadExcalidraw()
    
    return () => {
      mounted = false
    }
  }, [])

  // Parse initial data - memoized with stable reference
  const initialScene = useMemo(() => {
    if (!initialData) return undefined
    try {
      const parsed = JSON.parse(initialData)
      return {
        elements: parsed.elements || [],
        appState: {
          viewBackgroundColor: parsed.appState?.viewBackgroundColor || '#ffffff',
          ...parsed.appState
        },
        files: parsed.files || null
      }
    } catch {
      return undefined
    }
  }, [initialData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Handle API initialization - stable callback
  const handleAPIReady = useCallback((api: any) => {
    if (apiRef.current === api) return
    
    if (!apiRef.current) {
      apiRef.current = api
      
      // Mark initial load complete after a delay
      setTimeout(() => {
        isInitialLoad.current = false
      }, 1500)
    }
  }, [])

  // Internal save function
  const saveData = useCallback(() => {
    if (!apiRef.current || isInitialLoad.current || !latestSceneRef.current) return
    
    try {
      const { elements, appState, files } = latestSceneRef.current
      
      const data = JSON.stringify({
        type: 'excalidraw',
        version: 2,
        source: 'MarkFlow',
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: files || null
      })
      
      // Only update if data actually changed
      if (data !== lastSavedData.current) {
        lastSavedData.current = data
        updateExcalidrawData(data)
      }
    } catch (err) {
      console.error('Error saving Excalidraw data:', err)
    }
  }, [updateExcalidrawData])

  const flushSceneToStore = useCallback(() => {
    if (!apiRef.current || isInitialLoad.current) return false

    const sceneFromApi = {
      elements: apiRef.current.getSceneElements?.() ?? latestSceneRef.current?.elements,
      appState: apiRef.current.getAppState?.() ?? latestSceneRef.current?.appState,
      files: apiRef.current.getFiles?.() ?? latestSceneRef.current?.files,
    }

    if (!sceneFromApi.elements || !sceneFromApi.appState) return false

    latestSceneRef.current = {
      elements: sceneFromApi.elements,
      appState: sceneFromApi.appState,
      files: sceneFromApi.files,
    }

    saveData()
    return true
  }, [saveData])

  // Handle scene change - save to store with debounce
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    latestSceneRef.current = { elements, appState, files }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce the save
    saveTimeoutRef.current = setTimeout(() => {
      saveData()
    }, 300)
  }, [saveData])

  useEffect(() => {
    const onSaveShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return

      e.preventDefault()
      const didFlush = flushSceneToStore()
      if (didFlush) {
        void saveCurrentFile()
      }
    }

    window.addEventListener('keydown', onSaveShortcut, true)
    return () => window.removeEventListener('keydown', onSaveShortcut, true)
  }, [flushSceneToStore, saveCurrentFile])

  // Error state
  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (!components.Excalidraw || !components.MainMenu || !components.WelcomeScreen) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading Excalidraw...</p>
        </div>
      </div>
    )
  }

  const { Excalidraw: ExcalidrawComponent, MainMenu: MainMenuComponent, WelcomeScreen: WelcomeScreenComponent } = components

  return (
    <div className="h-full w-full excalidraw-container">
      <ExcalidrawComponent
        excalidrawAPI={handleAPIReady}
        initialData={initialScene}
        onChange={handleChange}
        theme={theme === 'dark' ? 'dark' : 'light'}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            saveToActiveFile: true,
            export: {
              saveFileToDisk: true,
            },
          },
        }}
      >
        <MainMenuComponent>
          <MainMenuComponent.DefaultItems.LoadScene />
          <MainMenuComponent.DefaultItems.SaveAs />
          <MainMenuComponent.DefaultItems.Export />
          <MainMenuComponent.DefaultItems.SaveAsImage />
          <MainMenuComponent.Separator />
          <MainMenuComponent.DefaultItems.ClearCanvas />
          <MainMenuComponent.Separator />
          <MainMenuComponent.DefaultItems.ToggleTheme />
          <MainMenuComponent.DefaultItems.ChangeCanvasBackground />
        </MainMenuComponent>
        <WelcomeScreenComponent>
          <WelcomeScreenComponent.Hints.MenuHint />
          <WelcomeScreenComponent.Hints.ToolbarHint />
          <WelcomeScreenComponent.Hints.HelpHint />
          <WelcomeScreenComponent.Center>
            <WelcomeScreenComponent.Center.Logo />
            <WelcomeScreenComponent.Center.Heading>
              Welcome to Excalidraw
            </WelcomeScreenComponent.Center.Heading>
            <WelcomeScreenComponent.Center.Menu>
              <WelcomeScreenComponent.Center.MenuItemLoadScene />
              <WelcomeScreenComponent.Center.MenuItemHelp />
            </WelcomeScreenComponent.Center.Menu>
          </WelcomeScreenComponent.Center>
        </WelcomeScreenComponent>
      </ExcalidrawComponent>
    </div>
  )
}
