import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Activity, Menu, X, Lightbulb, Smartphone, Monitor } from 'lucide-react'
import FundList from './components/FundList'
import FundChart from './components/FundChart'
import RealtimeBoard from './components/RealtimeBoard'
import InvestAdvice from './components/InvestAdvice'
import ThemeToggle from '@/components/ThemeToggle'
import { batchGetRealtimeEstimates } from '@utils/fundApi'
import { isTradeTime } from '@utils/tradeTime'

const POLL_INTERVAL = 60000 // 60 秒
const STORAGE_KEY = 'fund-realtime-history'
const FUNDS_STORAGE_KEY = 'fund-selected-list'
const MOBILE_BREAKPOINT = 768 // 移动端断点

// 从 localStorage 恢复当日数据
function loadRealtimeHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        const today = new Date().toISOString().slice(0, 10)
        // 跨日清理
        if (parsed._date !== today) {
            localStorage.removeItem(STORAGE_KEY)
            return {}
        }
        const { _date, ...rest } = parsed
        return rest
    } catch {
        return {}
    }
}

function saveRealtimeHistory(history) {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ _date: today, ...history }))
}

export default function Home() {
    const [funds, setFunds] = useState(() => {
        try {
            const raw = localStorage.getItem(FUNDS_STORAGE_KEY)
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })
    const [activeTab, setActiveTab] = useState('history')

    const [realtimeData, setRealtimeData] = useState([])
    const [realtimeHistory, setRealtimeHistory] = useState(loadRealtimeHistory)
    const [lastUpdateTime, setLastUpdateTime] = useState('')
    const [realtimeLoading, setRealtimeLoading] = useState(false)
    const pollRef = useRef(null)

    // 移动端适配状态 - 初始化时就检测屏幕宽度
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < MOBILE_BREAKPOINT
        }
        return false
    })
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
    const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
    const [isLandscape, setIsLandscape] = useState(false)

    // 监听屏幕宽度变化
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        }
        // 立即检测一次
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // 点击遮罩层关闭侧边栏
    const closeAllSidebars = () => {
        setLeftSidebarOpen(false)
        setRightSidebarOpen(false)
    }

    const handleAddFund = fund => {
        setFunds(prev => {
            const next = [...prev, fund]
            localStorage.setItem(FUNDS_STORAGE_KEY, JSON.stringify(next))
            return next
        })
    }

    const handleRemoveFund = id => {
        setFunds(prev => {
            const removed = prev.find(f => f.id === id)
            if (removed) {
                setRealtimeHistory(h => {
                    const next = { ...h }
                    delete next[removed.code]
                    saveRealtimeHistory(next)
                    return next
                })
                setRealtimeData(d => d.filter(r => r.code !== removed.code))
            }
            const next = prev.filter(f => f.id !== id)
            localStorage.setItem(FUNDS_STORAGE_KEY, JSON.stringify(next))
            return next
        })
    }

    const fetchRealtime = useCallback(async () => {
        if (funds.length === 0) return
        setRealtimeLoading(true)
        try {
            const codes = funds.map(f => f.code)
            const results = await batchGetRealtimeEstimates(codes)
            setRealtimeData(results)

            // 取 API 返回的日期和时间
            const apiDatetime = results[0]?.updateTime || ''
            const today = new Date().toISOString().slice(0, 10)

            if (results.length > 0 && apiDatetime) {
                const timeOnly = apiDatetime.split(' ')[1] || apiDatetime
                setLastUpdateTime(timeOnly)
            }

            setRealtimeHistory(prev => {
                // 跨日检测：如果 API 日期不是今天，或缓存日期不是今天，清空旧数据
                const cachedRaw = localStorage.getItem(STORAGE_KEY)
                const cachedDate = cachedRaw ? JSON.parse(cachedRaw)?._date : null
                if (cachedDate && cachedDate !== today) {
                    localStorage.removeItem(STORAGE_KEY)
                    prev = {}
                }

                const next = { ...prev }
                results.forEach(item => {
                    if (!item.updateTime) return
                    const [itemDate, timeStr] = item.updateTime.split(' ')
                    if (!timeStr) return
                    // 只保留今天的数据点
                    if (itemDate !== today) return

                    if (!next[item.code]) next[item.code] = []
                    const points = next[item.code]
                    const val = parseFloat(item.estimatedChange)
                    if (isNaN(val)) return

                    const lastIdx = points.findIndex(p => p.time === timeStr)
                    if (lastIdx >= 0) {
                        const updated = [...points]
                        updated[lastIdx] = { time: timeStr, value: val }
                        next[item.code] = updated
                    } else {
                        next[item.code] = [...points, { time: timeStr, value: val }]
                    }
                })
                saveRealtimeHistory(next)
                return next
            })
        } catch {
            // 静默
        } finally {
            setRealtimeLoading(false)
        }
    }, [funds])

    useEffect(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }

        if (activeTab === 'realtime' && funds.length > 0) {
            fetchRealtime() // 始终拉一次最新数据
            // 仅交易时段（工作日 9:30~15:00）持续轮询
            if (isTradeTime()) {
                pollRef.current = setInterval(fetchRealtime, POLL_INTERVAL)
            }
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [activeTab, fetchRealtime])

    const tabs = [
        { key: 'history', label: '历史走势', icon: BarChart3 },
        { key: 'realtime', label: '实时估值', icon: Activity },
    ]

    return (
        <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 overflow-x-hidden ${isLandscape && isMobile ? 'landscape-chart-mode' : ''}`}>
            <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-border sticky top-0 z-20">
                <div className="px-3 md:px-6 h-14 flex items-center gap-2 md:gap-3 max-w-full">
                    {/* 移动端左侧菜单按钮 */}
                    {isMobile && (
                        <button
                            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                            className="p-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex-none"
                            aria-label="自选基金"
                        >
                            <Menu className="w-5 h-5 text-foreground" />
                        </button>
                    )}
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-none">
                        <span className="text-white text-xs md:text-sm font-bold">F</span>
                    </div>
                    <h1 className="text-sm md:text-base font-bold text-foreground truncate">基金看板</h1>
                    <span className="text-xs text-muted-foreground hidden md:inline flex-none">Fund Dashboard</span>
                    <div className="ml-auto flex items-center gap-1 flex-none">
                        {/* 横屏切换按钮（仅移动端） */}
                        {isMobile && (
                            <button
                                onClick={() => setIsLandscape(!isLandscape)}
                                className={`p-1.5 rounded-lg transition-colors ${isLandscape 
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' 
                                    : 'hover:bg-muted active:bg-muted/80 text-muted-foreground'}`}
                                aria-label={isLandscape ? '竖屏模式' : '横屏模式'}
                            >
                                {isLandscape ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                            </button>
                        )}
                        <ThemeToggle isMobile={isMobile} />
                        {/* 移动端右侧投资建议按钮 */}
                        {isMobile && (
                            <button
                                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                                className="p-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
                                aria-label="投资建议"
                            >
                                <Lightbulb className="w-5 h-5 text-foreground" />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-6 h-[calc(100vh-56px)]">
                <div className="flex gap-4 md:gap-6 h-full relative">
                    {/* 移动端遮罩层 */}
                    <AnimatePresence>
                        {isMobile && (leftSidebarOpen || rightSidebarOpen) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 bg-black/40 z-35"
                                style={{ zIndex: 35 }}
                                onClick={closeAllSidebars}
                            />
                        )}
                    </AnimatePresence>

                    {/* 左侧边栏 - 自选基金列表 */}
                    <AnimatePresence>
                        {(!isMobile || leftSidebarOpen) && (
                            <motion.div
                                initial={isMobile ? { x: '-100%' } : { opacity: 0, x: -20 }}
                                animate={isMobile ? { x: 0 } : { opacity: 1, x: 0 }}
                                exit={isMobile ? { x: '-100%' } : { opacity: 0, x: -20 }}
                                transition={{ duration: isMobile ? 0.3 : 0.4, ease: 'easeOut' }}
                                className={`
                                    ${isMobile 
                                        ? 'fixed left-0 top-0 bottom-0 w-[85vw] max-w-[360px] z-40 flex flex-col' 
                                        : 'w-[380px] shrink-0'}
                                    bg-white/90 dark:bg-slate-900/90
                                    backdrop-blur rounded-r-2xl md:rounded-2xl shadow-sm
                                    border border-border overflow-hidden
                                `}
                            >
                                {isMobile && (
                                    <div className="flex items-center justify-between p-4 pb-0 flex-none">
                                        <h2 className="text-lg font-semibold text-foreground">自选基金</h2>
                                        <button
                                            onClick={() => setLeftSidebarOpen(false)}
                                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                        >
                                            <X className="w-5 h-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                )}
                                <div className={`${isMobile ? 'flex-1 overflow-hidden p-4 pt-2' : 'p-5 h-full'}`}>
                                    <FundList
                                        funds={funds}
                                        onAddFund={handleAddFund}
                                        onRemoveFund={handleRemoveFund}
                                    />
                                </div>
                                {/* 移动端底部安全区域 */}
                                {isMobile && <div className="h-6 flex-none" />}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 主内容区 */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className={`
                            flex-1 bg-white/90 dark:bg-slate-900/90
                            backdrop-blur rounded-2xl shadow-sm
                            border border-border p-4 md:p-5 overflow-hidden
                            flex flex-col min-w-0
                            ${isLandscape && isMobile ? 'landscape-chart-container' : ''}
                        `}
                    >
                        <div className="flex items-center gap-1 mb-4 md:mb-5 bg-muted rounded-xl p-1 self-start">
                            {tabs.map(tab => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`
                                            flex items-center gap-1.5
                                            px-3 md:px-4 py-2 rounded-lg
                                            text-sm font-medium transition-all
                                            ${
                                            isActive
                                                ? `bg-white dark:bg-slate-800
                                                   text-primary-700 dark:text-primary-400
                                                   shadow-sm`
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex-1 min-h-0">
                            {activeTab === 'history' ? (
                                <FundChart funds={funds} isLandscape={isLandscape && isMobile} />
                            ) : (
                                <RealtimeBoard
                                    funds={funds}
                                    realtimeData={realtimeData}
                                    realtimeHistory={realtimeHistory}
                                    lastUpdateTime={lastUpdateTime}
                                    loading={realtimeLoading}
                                    isLandscape={isLandscape && isMobile}
                                />
                            )}
                        </div>
                    </motion.div>

                    {/* 右侧边栏 - 投资建议 */}
                    <AnimatePresence>
                        {(!isMobile || rightSidebarOpen) && (
                            <motion.div
                                initial={isMobile ? { x: '100%' } : { opacity: 0, x: 20 }}
                                animate={isMobile ? { x: 0 } : { opacity: 1, x: 0 }}
                                exit={isMobile ? { x: '100%' } : { opacity: 0, x: 20 }}
                                transition={{ duration: isMobile ? 0.3 : 0.4, delay: isMobile ? 0 : 0.2, ease: 'easeOut' }}
                                className={`
                                    ${isMobile 
                                        ? 'fixed right-0 top-0 bottom-0 w-[85vw] max-w-[320px] z-40 flex flex-col' 
                                        : 'w-[320px] shrink-0'}
                                    bg-white/90 dark:bg-slate-900/90
                                    backdrop-blur rounded-l-2xl md:rounded-2xl shadow-sm
                                    border border-border overflow-hidden
                                `}
                            >
                                {isMobile && (
                                    <div className="flex items-center justify-between p-4 pb-0 flex-none">
                                        <h2 className="text-lg font-semibold text-foreground">投资建议</h2>
                                        <button
                                            onClick={() => setRightSidebarOpen(false)}
                                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                        >
                                            <X className="w-5 h-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                )}
                                <div className={`${isMobile ? 'flex-1 overflow-y-auto p-4 pt-2' : 'p-5 h-full'}`}>
                                    <InvestAdvice funds={funds} />
                                </div>
                                {/* 移动端底部安全区域 */}
                                {isMobile && <div className="h-6 flex-none" />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}
