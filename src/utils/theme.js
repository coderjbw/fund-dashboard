import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'app-theme'

/**
 * 获取保存的主题设置，默认 'light'
 */
export function getSavedTheme() {
    try {
        return localStorage.getItem(THEME_KEY) || 'light'
    } catch {
        return 'light'
    }
}

/**
 * 根据模式决定是否应该使用深色
 * system 模式：18:00 之后为深色
 */
function shouldBeDark(mode) {
    if (mode === 'dark') return true
    if (mode === 'light') return false
    // system 模式：晚上 6 点后自动切换为深色
    return new Date().getHours() >= 18
}

/**
 * 将 dark class 应用到 <html> 元素
 */
function applyThemeClass(mode) {
    const html = document.documentElement
    if (shouldBeDark(mode)) {
        html.classList.add('dark')
    } else {
        html.classList.remove('dark')
    }
}

/**
 * 初始化主题（在 React 渲染前调用，防闪烁）
 */
export function initTheme() {
    applyThemeClass(getSavedTheme())
}

/**
 * React Hook：管理主题状态
 * 返回 [mode, setMode, isDark]
 *   mode: 'light' | 'dark' | 'system'
 *   setMode: 切换主题
 *   isDark: 当前是否为深色
 */
export function useTheme() {
    const [mode, setModeState] = useState(getSavedTheme)
    const [isDark, setIsDark] = useState(() => shouldBeDark(getSavedTheme()))

    const setMode = useCallback((newMode) => {
        setModeState(newMode)
        localStorage.setItem(THEME_KEY, newMode)
        applyThemeClass(newMode)
        setIsDark(shouldBeDark(newMode))
    }, [])

    // system 模式下每分钟检查一次时间是否跨过 18:00
    useEffect(() => {
        if (mode !== 'system') return

        const check = () => {
            const dark = shouldBeDark('system')
            setIsDark(dark)
            applyThemeClass('system')
        }

        const timer = setInterval(check, 60000)
        return () => clearInterval(timer)
    }, [mode])

    return [mode, setMode, isDark]
}
