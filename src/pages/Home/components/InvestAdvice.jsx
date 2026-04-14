import { useMemo } from 'react'
import { Lightbulb, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * 分析单只基金近7日走势，输出投资建议
 */
function analyzeFund(fund) {
    const history = fund.history || []
    const recent7 = history.slice(-7)

    if (recent7.length < 5) {
        return {
            level: 'nodata',
            label: '数据不足',
            reason: '历史数据少于5天，无法分析',
            totalChange: 0,
            volatility: 0,
            volLevel: '--',
            momentum: 0,
        }
    }

    // 7日累计涨幅
    const totalChange = recent7.reduce((sum, h) => sum + h.value, 0)

    // 动量：后3天均值 vs 前段均值
    const laterDays = recent7.slice(-3)
    const earlierDays = recent7.slice(0, recent7.length - 3)
    const laterAvg = laterDays.reduce((s, h) => s + h.value, 0) / laterDays.length
    const earlierAvg = earlierDays.reduce((s, h) => s + h.value, 0) / earlierDays.length
    const momentum = laterAvg - earlierAvg

    // 波动率：标准差
    const mean = totalChange / recent7.length
    const variance = recent7.reduce((s, h) => s + (h.value - mean) ** 2, 0) / recent7.length
    const volatility = Math.sqrt(variance)

    // 判断建议等级
    let level, label, reason
    if (totalChange > 1 && momentum > 0) {
        level = 'buy'
        label = '建议增投'
        reason = '近7日累计上涨，且涨势加速中'
    } else if (totalChange < -1 && momentum < 0) {
        level = 'sell'
        label = '建议减持'
        reason = '近7日累计下跌，且跌势未止'
    } else {
        level = 'hold'
        label = '建议观望'
        if (Math.abs(totalChange) <= 1) {
            reason = '近期涨跌幅较小，处于震荡区间'
        } else if (totalChange > 1 && momentum <= 0) {
            reason = '虽有上涨但涨势放缓，宜观望'
        } else if (totalChange < -1 && momentum >= 0) {
            reason = '跌幅收窄，可能企稳，宜观望'
        } else {
            reason = '近期趋势不明朗，建议等待信号'
        }
    }

    // 波动率等级
    let volLevel = '低'
    if (volatility > 1.5) volLevel = '高'
    else if (volatility > 0.8) volLevel = '中'

    return { level, label, reason, totalChange, volatility, volLevel, momentum }
}

const LEVEL_STYLES = {
    buy: {
        badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
        icon: TrendingUp,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    sell: {
        badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800/50',
        bg: 'bg-red-50/50 dark:bg-red-950/20',
        icon: TrendingDown,
        iconColor: 'text-red-600 dark:text-red-400',
    },
    hold: {
        badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/50',
        bg: 'bg-amber-50/50 dark:bg-amber-950/20',
        icon: Minus,
        iconColor: 'text-amber-600 dark:text-amber-400',
    },
    nodata: {
        badge: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
        border: 'border-gray-200 dark:border-gray-700',
        bg: 'bg-gray-50/50 dark:bg-gray-900/20',
        icon: AlertTriangle,
        iconColor: 'text-gray-400 dark:text-gray-500',
    },
}

export default function InvestAdvice({ funds }) {
    const adviceList = useMemo(() => {
        return funds.map(fund => ({
            fund,
            advice: analyzeFund(fund),
        }))
    }, [funds])

    // 按建议等级排序：buy > sell > hold > nodata
    const sortedList = useMemo(() => {
        const order = { buy: 0, sell: 1, hold: 2, nodata: 3 }
        return [...adviceList].sort(
            (a, b) => (order[a.advice.level] ?? 9) - (order[b.advice.level] ?? 9)
        )
    }, [adviceList])

    return (
        <div className="h-full flex flex-col">
            {/* 标题区域 */}
            <div className="flex items-center gap-2 mb-5">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-foreground">投资建议</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                    基于近 7 日走势
                </span>
            </div>

            {funds.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <Lightbulb className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-sm">添加基金后查看投资建议</p>
                    <p className="text-xs mt-1 opacity-60">在左侧搜索并添加基金</p>
                </div>
            ) : (
                <>
                    {/* 建议卡片列表 */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
                        <AnimatePresence mode="popLayout">
                            {sortedList.map(({ fund, advice }, i) => {
                                const style = LEVEL_STYLES[advice.level]
                                const Icon = style.icon
                                return (
                                    <motion.div
                                        key={fund.id}
                                        layout
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -12, height: 0 }}
                                        transition={{ duration: 0.25, delay: i * 0.04 }}
                                        className={`
                                            rounded-xl p-3.5 border transition-all
                                            ${style.border} ${style.bg}
                                        `}
                                    >
                                        {/* 基金名称 + 建议标签 */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0 mr-2">
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {fund.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {fund.code}
                                                </p>
                                            </div>
                                            <span className={`
                                                inline-flex items-center gap-1
                                                px-2 py-1 rounded-lg text-xs font-semibold
                                                shrink-0 ${style.badge}
                                            `}>
                                                <Icon className="w-3 h-3" />
                                                {advice.label}
                                            </span>
                                        </div>

                                        {advice.level !== 'nodata' ? (
                                            <>
                                                {/* 指标行 */}
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="flex-1">
                                                        <p className="text-xs text-muted-foreground">7日累计</p>
                                                        <p className={`text-sm font-bold ${
                                                            advice.totalChange >= 0
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : 'text-secondary-600 dark:text-secondary-400'
                                                        }`}>
                                                            {advice.totalChange >= 0 ? '+' : ''}
                                                            {advice.totalChange.toFixed(2)}%
                                                        </p>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-xs text-muted-foreground">波动率</p>
                                                        <p className="text-sm font-bold text-foreground">
                                                            {advice.volLevel}
                                                        </p>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-xs text-muted-foreground">动量</p>
                                                        <p className={`text-sm font-bold ${
                                                            advice.momentum >= 0
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : 'text-secondary-600 dark:text-secondary-400'
                                                        }`}>
                                                            {advice.momentum >= 0 ? '↑' : '↓'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* 理由 */}
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    {advice.reason}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                {advice.reason}
                                            </p>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>

                    {/* 免责声明 */}
                    <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground/60 leading-relaxed text-center">
                            ⚠️ 以上建议仅基于历史数据趋势分析，不构成投资建议，投资有风险，决策需谨慎。
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
