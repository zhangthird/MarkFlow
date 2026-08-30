'use client'

import { useEffect } from 'react'
import { useEditorStore } from '@/store/editor-store'

export function useAppPreferences() {
  const setTheme = useEditorStore(state => state.setTheme)
  const setLanguage = useEditorStore(state => state.setLanguage)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
    if (savedTheme) setTheme(savedTheme)
    else setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

    const savedLanguage = localStorage.getItem('language') as 'zh' | 'en' | null
    if (savedLanguage) setLanguage(savedLanguage)
    else setLanguage(navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
  }, [setLanguage, setTheme])
}
