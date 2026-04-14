import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react'
import { useTheme } from '@utils/theme'

const modes = [
    { key: 'light', icon: Sun, label: '日间' },
    { key: 'dark', icon: Moon, label: '夜间' },
    { key: 'system', icon: Monitor, label: '跟随系统' },
]

export default function ThemeToggle({ isMobile = false }) {
    const [mode, setMode] = useTheme()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false)
            }
        }
        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [dropdownOpen])

    const currentMode = modes.find(m => m.key === mode) || modes[0]
    const CurrentIcon = currentMode.icon

    // 移动端下拉菜单
    if (isMobile) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="p-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-1"
                    aria-label="切换主题"
                >
                    <CurrentIcon className="w-5 h-5 text-foreground" />
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-border py-1 min-w-[100px] z-50">
                        {modes.map(({ key, icon: Icon, label }) => {
                            const active = mode === key
                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setMode(key)
                                        setDropdownOpen(false)
                                    }}
                                    className={`w-full px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                                        active
                                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                            : 'text-foreground hover:bg-muted'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{label}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    // 桌面端按钮组
    return (
        <div className="flex items-center gap-0.5 bg-muted dark:bg-slate-800 rounded-lg p-0.5 border border-border">
            {modes.map(({ key, icon: Icon, label }) => {
                const active = mode === key
                return (
                    <button
                        key={key}
                        onClick={() => setMode(key)}
                        title={label}
                        className={`p-1.5 rounded-md transition-all ${
                            active
                                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                    </button>
                )
            })}
        </div>
    )
}
