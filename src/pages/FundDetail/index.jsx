import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Clock, Database } from 'lucide-react'
import { getRealtimeEstimate } from '@utils/fundApi'
import { isTradeTime } from '@utils/tradeTime'
import ThemeToggle from '@/components/ThemeToggle'
import DetailChart from './components/DetailChart'

const POLL_INTERVAL = 60000
const STORAGE_KEY = 'fund-realtime-history'
const FUNDS_STORAGE_KEY = 'fund-selected-list'
const MOBILE_BREAKPOINT = 768

function loadRealtimeHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        const today = new Date().toISOString().slice(0, 10)
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

export default function FundDetail() {
    const { code } = useParams()
    const navigate = useNavigate()

    // 移动端检测
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < MOBILE_BREAKPOINT
        }
        return false
    })

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // 从 localStorage 读取基金信息
    const fund = (() => {
        try {
            const raw = localStorage.getItem(FUNDS_STORAGE_KEY)
            const list = raw ? JSON.parse(raw) : []
            return list.find(f => f.code === code) || { code, name: code, type: '基金' }
        } catch {
            return { code, name: code, type: '基金' }
        }
    })()

    const [estimate, setEstimate] = useState(null)
    const [realtimeHistory, setRealtimeHistory] = useState(loadRealtimeHistory)
    const [loading, setLoading] = useState(false)
    const pollRef = useRef(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getRealtimeEstimate(code)
            setEstimate(result)

            const today = new Date().toISOString().slice(0, 10)

            setRealtimeHistory(prev => {
                // 跨日清理
                const cachedRaw = localStorage.getItem(STORAGE_KEY)
                const cachedDate = cachedRaw ? JSON.parse(cachedRaw)?._date : null
                if (cachedDate && cachedDate !== today) {
                    localStorage.removeItem(STORAGE_KEY)
                    prev = {}
                }

                const next = { ...prev }
                if (!result.updateTime) { return prev }
                const [itemDate, timeStr] = result.updateTime.split(' ')
                if (!timeStr || itemDate !== today) { return prev }

                if (!next[code]) next[code] = []
                const points = next[code]
                const val = parseFloat(result.estimatedChange)
                if (isNaN(val)) { return prev }

                const existIdx = points.findIndex(p => p.time === timeStr)
                if (existIdx >= 0) {
                    const updated = [...points]
                    updated[existIdx] = { time: timeStr, value: val }
                    next[code] = updated
                } else {
                    next[code] = [...points, { time: timeStr, value: val }]
                }
                saveRealtimeHistory(next)
                return next
            })
        } catch {
            /* 静默 */
        } finally {
            setLoading(false)
        }
    }, [code])

    useEffect(() => {
        fetchData() // 始终拉一次最新数据
        // 仅交易时段（工作日 9:30~15:00）持续轮询
        if (isTradeTime()) {
            pollRef.current = setInterval(fetchData, POLL_INTERVAL)
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [fetchData])

    const change = estimate ? parseFloat(estimate.estimatedChange) : NaN
    const isUp = !isNaN(change) && change >= 0
    const points = realtimeHistory[code] || []

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 overflow-x-hidden">
            {/* 顶部导航 */}
            <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-border sticky top-0 z-20">
                <div className="px-3 md:px-6 h-14 flex items-center gap-2 md:gap-3 max-w-full">
                    <button
                        onClick={() => navigate('/')}
                        className="p-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex-none flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        {!isMobile && <span className="text-sm">返回</span>}
                    </button>
                    <div className="w-px h-5 bg-border flex-none" />
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-none">
                        <span className="text-white text-xs md:text-sm font-bold">F</span>
                    </div>
                    <h1 className="text-sm md:text-base font-bold text-foreground truncate">{fund.name}</h1>
                    <span className="text-xs text-muted-foreground flex-none">{fund.code}</span>
                    <div className="ml-auto flex-none">
                        <ThemeToggle isMobile={isMobile} />
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-6 min-h-[calc(100vh-56px)]">
                <div className="flex flex-col gap-4 md:gap-5">
                    {/* 上方：信息卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        {/* 实时估值卡 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-2xl p-4 md:p-5 border ${
                                isUp
                                    ? 'bg-red-50/70 dark:bg-red-950/30 border-red-100 dark:border-red-900/40'
                                    : 'bg-green-50/70 dark:bg-green-950/30 border-green-100 dark:border-green-900/40'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {isUp
                                    ? <TrendingUp className="w-5 h-5 text-red-500" />
                                    : <TrendingDown className="w-5 h-5 text-secondary-500" />
                                }
                                <span className="text-sm font-medium text-foreground">实时估值涨幅</span>
                                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500 ml-auto" />}
                            </div>
                            <p className={`text-3xl md:text-4xl font-bold ${
                                isUp
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-secondary-600 dark:text-secondary-400'
                            }`}>
                                {estimate ? `${isUp ? '+' : ''}${estimate.estimatedChange}%` : '--'}
                            </p>
                        </motion.div>

                        {/* 估算净值卡 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className="rounded-2xl p-4 md:p-5 bg-white/90 dark:bg-slate-900/90 border border-border"
                        >
                            <p className="text-sm font-medium text-muted-foreground mb-2">估算净值</p>
                            <p className="text-3xl md:text-4xl font-bold text-foreground">
                                {estimate?.estimatedNav || '--'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                上一日净值 {estimate?.lastNav || '--'} ({estimate?.lastNavDate || '--'})
                            </p>
                        </motion.div>

                        {/* 数据采集卡 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-2xl p-4 md:p-5 bg-white/90 dark:bg-slate-900/90 border border-border"
                        >
                            <p className="text-sm font-medium text-muted-foreground mb-2">数据采集</p>
                            <p className="text-3xl md:text-4xl font-bold text-foreground">{points.length}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                    <Database className="w-3 h-3" />数据点
                                </span>
                                {estimate?.updateTime && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {estimate.updateTime.split(' ')[1]}
                                    </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded-full font-medium bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400">
                                    每分钟刷新
                                </span>
                            </div>
                        </motion.div>
                    </div>

                    {/* 下方：折线图 */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-border p-4 md:p-5"
                    >
                        <h2 className="text-base font-bold text-foreground mb-4">
                            当日实时估值走势
                        </h2>
                        <div className="h-[250px] md:h-[350px]">
                            <DetailChart fund={fund} realtimeHistory={realtimeHistory} />
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
