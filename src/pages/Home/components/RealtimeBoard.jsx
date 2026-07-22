import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Activity, RefreshCw, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@utils/theme'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

const COLOR_PALETTE = [
    '#2e8eff', '#22c55e', '#f97316', '#ef4444', '#06b6d4',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
]

// 计算 updateTime "YYYY-MM-DD HH:MM" 距离现在的分钟数（本地时区，负数视为 0）
function computeLagMinutes(updateTime) {
    if (typeof updateTime !== 'string') return 0
    const m = updateTime.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/)
    if (!m) return 0
    const [, y, mo, d, hh, mm] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm))
    const diff = (Date.now() - dt.getTime()) / 60000
    return diff > 0 ? Math.floor(diff) : 0
}

export default function RealtimeBoard({ funds, realtimeData, realtimeHistory, lastUpdateTime, loading }) {
    const [, , isDark] = useTheme()
    const navigate = useNavigate()

    // 统计已采集数据点数
    const totalPoints = useMemo(() => {
        return Object.values(realtimeHistory).reduce((sum, pts) => sum + pts.length, 0)
    }, [realtimeHistory])

    // 构建日内波动折线图
    const chartOption = useMemo(() => {
        // 筛选有数据的基金
        const fundsWithData = funds.filter(f => realtimeHistory[f.code]?.length >= 2)
        if (fundsWithData.length === 0) return null

        // 收集所有时间点并排序
        const allTimes = new Set()
        fundsWithData.forEach(f => {
            const pts = realtimeHistory[f.code] || []
            pts.forEach(p => allTimes.add(p.time))
        })
        const sortedTimes = [...allTimes].sort()

        const tooltipBg = isDark ? 'rgba(30,41,59,0.96)' : 'rgba(255,255,255,0.96)'
        const tooltipBorder = isDark ? '#475569' : '#e2e8f0'
        const tooltipText = isDark ? '#f1f5f9' : '#1e293b'
        const axisLineColor = isDark ? '#334155' : '#e2e8f0'
        const axisLabelColor = isDark ? '#64748b' : '#94a3b8'
        const splitLineColor = isDark ? '#1e293b' : '#f1f5f9'
        const legendColor = isDark ? '#94a3b8' : '#64748b'
        const markLineColor = isDark ? '#475569' : '#cbd5e1'

        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderWidth: 1,
                textStyle: { color: tooltipText, fontSize: 12 },
                formatter: params => {
                    let html = `<div style="font-weight:600;margin-bottom:6px">${params[0]?.axisValue}</div>`
                    params.forEach(p => {
                        const val = p.value
                        if (val == null) return
                        const color = val >= 0 ? '#ef4444' : '#22c55e'
                        html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
                            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block">
                            </span>
                            <span style="flex:1;font-size:12px">${p.seriesName}</span>
                            <span style="font-weight:600;color:${color}">${val >= 0 ? '+' : ''}${val}%</span>
                        </div>`
                    })
                    return html
                },
            },
            legend: {
                data: fundsWithData.map(f => f.name),
                bottom: 0,
                type: 'scroll',
                textStyle: { color: legendColor, fontSize: 12 },
                itemWidth: 16,
                itemHeight: 8,
                itemGap: 16,
            },
            grid: {
                top: 24,
                right: 20,
                bottom: 50,
                left: 55,
            },
            xAxis: {
                type: 'category',
                data: sortedTimes,
                axisLine: { lineStyle: { color: axisLineColor } },
                axisTick: { show: false },
                axisLabel: { color: axisLabelColor, fontSize: 11 },
                boundaryGap: false,
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: axisLabelColor,
                    fontSize: 11,
                    formatter: '{value}%',
                },
                splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
                axisLine: { show: false },
                axisTick: { show: false },
            },
            series: fundsWithData.map((fund, idx) => {
                const points = realtimeHistory[fund.code] || []
                const timeMap = {}
                points.forEach(p => { timeMap[p.time] = p.value })

                return {
                    name: fund.name,
                    type: 'line',
                    data: sortedTimes.map(t => timeMap[t] ?? null),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 4,
                    showSymbol: true,
                    connectNulls: true,
                    lineStyle: { width: 2.5, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] },
                    itemStyle: { color: COLOR_PALETTE[idx % COLOR_PALETTE.length] },
                    emphasis: { focus: 'series', symbolSize: 8 },
                    markLine: idx === 0 ? {
                        silent: true,
                        symbol: 'none',
                        lineStyle: { color: markLineColor, type: 'dashed', width: 1 },
                        data: [{ yAxis: 0 }],
                        label: { show: false },
                    } : undefined,
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] + '18' },
                            { offset: 1, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] + '02' },
                        ]),
                    },
                }
            }),
        }
    }, [funds, realtimeHistory, isDark])

    // 基金代码 -> 已保存名称（用于兜底：实时接口部分基金返回空 name）
    const fundNameMap = useMemo(() => {
        const m = {}
        funds.forEach(f => { if (f.code) m[f.code] = f.name })
        return m
    }, [funds])

    // 按涨幅排序的实时数据
    const sortedRealtime = useMemo(() => {
        if (!realtimeData || realtimeData.length === 0) return []
        return [...realtimeData].sort(
            (a, b) => parseFloat(b.estimatedChange) - parseFloat(a.estimatedChange)
        )
    }, [realtimeData])

    return (
        <div className="h-full overflow-y-auto">
            {/* 标题栏 */}
            <div className="flex items-center gap-2 mb-4 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur py-1 -mt-1 z-10">
                <Activity className="w-5 h-5 text-accent-600 flex-none" />
                <h2 className="text-lg font-bold text-foreground">实时估值</h2>
                <div className="ml-auto flex items-center gap-2 md:gap-3 text-xs text-muted-foreground">
                    {loading && (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500" />
                    )}
                    {lastUpdateTime && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lastUpdateTime}
                        </span>
                    )}
                </div>
            </div>

            {funds.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <Activity className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-sm">添加基金后查看实时估值</p>
                    <p className="text-xs mt-1 opacity-60">在左侧搜索并添加基金</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* 实时估值卡片 - 网格布局 */}
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <AnimatePresence mode="popLayout">
                            {sortedRealtime.map((item, i) => {
                                const change = parseFloat(item.estimatedChange)
                                const isUp = change >= 0
                                const points = realtimeHistory[item.code] || []
                                const isStale = !!item.stale
                                const isOnMarket = !!item.onMarket
                                const isDIY = !!item.diyEstimate
                                const staleDate = isStale && typeof item.lastNavDate === 'string'
                                    ? item.lastNavDate.slice(5).replace('-', '/')
                                    : ''
                                // 若保留的是上次非 stale 数据，updateTime 可能落后，超过 2 分钟就提示
                                const lagMinutes = !isStale && typeof item.updateTime === 'string'
                                    ? computeLagMinutes(item.updateTime)
                                    : 0
                                const isLagging = lagMinutes >= 2
                                return (
                                    <motion.div
                                        key={item.code}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        onClick={() => navigate(`/fund/${item.code}`)}
                                        className={`rounded-xl p-2.5 md:p-3 border transition-all cursor-pointer active:scale-[0.98] ${
                                            isUp
                                                ? 'bg-red-50/60 dark:bg-red-950/30 border-red-100 dark:border-red-900/40 hover:border-red-200 dark:hover:border-red-800'
                                                : 'bg-green-50/60 dark:bg-green-950/30 border-green-100 dark:border-green-900/40 hover:border-green-200 dark:hover:border-green-800'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-1 gap-1">
                                            <p className="text-xs font-medium text-foreground line-clamp-2 flex-1 leading-tight">
                                                {item.name || fundNameMap[item.code] || item.code}
                                            </p>
                                            <div className="flex items-center gap-1 flex-none">
                                                {isStale && (
                                                    <span
                                                        title={`已披露净值 ${item.lastNavDate || ''}，非盘中估值（如 QDII / 停牌）`}
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 leading-none"
                                                    >
                                                        日频
                                                    </span>
                                                )}
                                                {isOnMarket && (
                                                    <span
                                                        title={`场内 ETF/LOF 二级市场实时成交价（${item.market || ''}）`}
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 leading-none"
                                                    >
                                                        场内
                                                    </span>
                                                )}
                                                {isDIY && (
                                                    <span
                                                        title={`基于十大重仓 × A 股实时行情本地估算，覆盖${item.coveredWeight ?? '--'}% 净值，剩余按 0，日均偏差 ~0.1-0.3%`}
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 leading-none"
                                                    >
                                                        估算
                                                    </span>
                                                )}
                                                {isUp
                                                    ? <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                                                    : <TrendingDown className="w-3.5 h-3.5 text-secondary-500" />
                                                }
                                            </div>
                                        </div>
                                        <p className={`text-lg md:text-xl font-bold ${
                                            isUp
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-secondary-600 dark:text-secondary-400'
                                        }`}>
                                            {isUp ? '+' : ''}{item.estimatedChange}%
                                        </p>
                                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                                            <span>{isStale ? '净值' : (isOnMarket ? '现价' : '估算')} {item.estimatedNav}</span>
                                            <span>
                                                {isStale
                                                    ? staleDate
                                                    : (isLagging
                                                        ? `落后 ${lagMinutes}m`
                                                        : (isDIY ? `覆盖 ${item.coveredWeight ?? '--'}%` : `${points.length} 点`))}
                                            </span>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>

                    {/* 日内波动折线图 */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-foreground">日内估值波动</h3>
                            <span className="text-xs text-muted-foreground hidden md:inline">
                                每分钟采集一个估值点
                            </span>
                        </div>
                        <div className="h-[250px] md:h-[300px]">
                            {chartOption ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full"
                                >
                                    <ReactEChartsCore
                                        echarts={echarts}
                                        option={chartOption}
                                        style={{ height: '100%', width: '100%' }}
                                        opts={{ renderer: 'canvas' }}
                                        notMerge={true}
                                    />
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground rounded-xl border border-dashed border-border bg-muted/30 p-4">
                                    <RefreshCw className={`w-8 h-8 mb-3 opacity-30 ${loading ? 'animate-spin' : ''}`} />
                                    <p className="text-sm font-medium text-center">正在采集日内估值数据...</p>
                                    <p className="text-xs mt-1.5 opacity-60 text-center">
                                        至少需要 2 个数据点后显示折线图
                                    </p>
                                    {totalPoints > 0 && (
                                        <p className="text-xs mt-2 text-primary-500">
                                            已采集 {totalPoints} 个点
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
