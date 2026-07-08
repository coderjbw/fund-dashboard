import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2, TrendingUp, Search, Loader2, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchFunds } from '@utils/fundApi'

export default function FundList({ funds, onAddFund, onRemoveFund }) {
    const navigate = useNavigate()
    const [searchText, setSearchText] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [searching, setSearching] = useState(false)
    const [adding, setAdding] = useState(null) // 正在添加的基金代码
    const debounceRef = useRef(null)

    // 防抖搜索
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)

        if (!searchText.trim()) {
            setSuggestions([])
            setShowDropdown(false)
            return
        }

        setSearching(true)
        debounceRef.current = setTimeout(async () => {
            try {
                const results = await searchFunds(searchText)
                // 排除已添加的基金
                const filtered = results
                    .filter(f => !funds.find(existing => existing.code === f.code))
                    .slice(0, 8)
                setSuggestions(filtered)
                setShowDropdown(true)
            } catch {
                setSuggestions([])
            } finally {
                setSearching(false)
            }
        }, 400)

        return () => clearTimeout(debounceRef.current)
    }, [searchText, funds])

    const handleAddFund = async fund => {
        setAdding(fund.code)
        try {
            // 仅添加元数据，history / dailyChange 由首页统一拉取
            onAddFund({
                ...fund,
                id: Date.now(),
                dailyChange: '--',
                history: [],
            })
            setSearchText('')
            setShowDropdown(false)
            setSuggestions([])
        } finally {
            setAdding(null)
        }
    }

    return (
        <div className="h-full flex flex-col">
            {/* 标题栏 */}
            <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-foreground">自选基金</h2>
                <span className="ml-auto text-sm text-muted-foreground">
                    {funds.length} 只
                </span>
            </div>

            {/* 搜索添加区域 */}
            <div className="relative mb-4">
                <div className={`
                    flex items-center gap-2 bg-muted rounded-xl
                    px-3 py-2.5 border border-border
                    focus-within:border-primary-400
                    focus-within:ring-2 focus-within:ring-primary-100
                    transition-all
                `}>
                    {searching
                        ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                        : <Search className="w-4 h-4 text-muted-foreground" />
                    }
                    <input
                        type="text"
                        placeholder="搜索基金代码或名称..."
                        className={`
                            flex-1 bg-transparent text-sm
                            text-foreground placeholder-muted-foreground
                            outline-none
                        `}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    />
                </div>

                {/* 搜索下拉建议 */}
                <AnimatePresence>
                    {showDropdown && suggestions.length > 0 && (
                        <motion.div
                            initial={{opacity: 0, y: -8}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -8}}
                            className={`
                                absolute z-10 top-full left-0 right-0 mt-1
                                bg-white dark:bg-slate-800 rounded-xl shadow-lg
                                border border-border overflow-hidden
                                max-h-80 overflow-y-auto
                            `}
                        >
                            {suggestions.map(fund => (
                                <button
                                    key={fund.code}
                                    disabled={adding === fund.code}
                                    className={`
                                        w-full flex items-center gap-3
                                        px-4 py-3 text-left
                                        hover:bg-primary-50
                                        dark:hover:bg-primary-900/20
                                        transition-colors disabled:opacity-60
                                    `}
                                    onMouseDown={() => handleAddFund(fund)}
                                >
                                    <div className={`
                                        w-8 h-8 rounded-lg
                                        bg-primary-100 dark:bg-primary-900/30
                                        flex items-center justify-center
                                    `}>
                                        {adding === fund.code
                                            ? <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                                            : <Plus className="w-4 h-4 text-primary-600" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{fund.name}</p>
                                        <p className="text-xs text-muted-foreground">{fund.code} · {fund.type}</p>
                                    </div>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {showDropdown && searchText.trim().length > 0 && !searching && suggestions.length === 0 && (
                    <div className={`
                        absolute z-10 top-full left-0 right-0 mt-1
                        bg-white dark:bg-slate-800 rounded-xl shadow-lg
                        border border-border p-4 text-center
                        text-sm text-muted-foreground
                    `}>
                        未找到匹配的基金
                    </div>
                )}
            </div>

            {/* 基金列表 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
                <AnimatePresence mode="popLayout">
                    {funds.length === 0 ? (
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            className="flex flex-col items-center justify-center py-16 text-muted-foreground"
                        >
                            <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">暂无自选基金</p>
                            <p className="text-xs mt-1">在上方搜索添加基金</p>
                        </motion.div>
                    ) : (
                        funds.map(fund => {
                            const change = parseFloat(fund.dailyChange)
                            const isUp = !isNaN(change) && change >= 0
                            const hasData = fund.dailyChange !== '--'

                            return (
                                <motion.div
                                    key={fund.id}
                                    layout
                                    initial={{opacity: 0, x: -20}}
                                    animate={{opacity: 1, x: 0}}
                                    exit={{opacity: 0, x: -20, height: 0, marginBottom: 0}}
                                    transition={{duration: 0.25}}
                                    onClick={() => navigate(`/fund/${fund.code}`)}
                                    className={`
                                        group p-3 rounded-xl bg-white dark:bg-slate-800
                                        border border-border
                                        hover:border-primary-200 dark:hover:border-primary-700
                                        hover:shadow-md transition-all cursor-pointer
                                    `}
                                >
                                    {/* 第一行：名称和删除按钮 */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <p className="text-sm font-medium text-foreground leading-tight flex-1 min-w-0">
                                            {fund.name}
                                        </p>
                                        <button
                                            onClick={e => { e.stopPropagation(); onRemoveFund(fund.id) }}
                                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors flex-none"
                                            title="删除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* 第二行：代码、类型、涨幅 */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs text-muted-foreground">{fund.code}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-none">
                                                {fund.type}
                                            </span>
                                        </div>
                                        
                                        {/* 涨幅 */}
                                        <div className="flex items-center gap-1.5 flex-none">
                                            {hasData ? (
                                                <>
                                                    <span className={`
                                                        w-5 h-5 rounded flex items-center justify-center text-xs font-bold
                                                        ${isUp
                                                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                                                            : 'bg-secondary-50 dark:bg-secondary-950/40 text-secondary-600 dark:text-secondary-400'
                                                        }
                                                    `}>
                                                        {isUp ? '↑' : '↓'}
                                                    </span>
                                                    <span className={`text-sm font-bold ${
                                                        isUp
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-secondary-600 dark:text-secondary-400'
                                                    }`}>
                                                        {isUp ? '+' : ''}{fund.dailyChange}%
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">--</span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
