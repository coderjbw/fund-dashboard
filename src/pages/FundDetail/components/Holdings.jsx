import { useMemo } from 'react'
import { PieChart, Package, Calendar, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart as EPieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@utils/theme'

echarts.use([EPieChart, TooltipComponent, LegendComponent, CanvasRenderer])

// 权重字符串 "9.65%" -> 9.65
function parseWeight(s) {
    if (!s) return 0
    const n = parseFloat(s.replace(/%$/, ''))
    return isNaN(n) ? 0 : n
}

export default function Holdings({ holdings, loading }) {
    const [, , isDark] = useTheme()

    const stocks = holdings?.stocks || []
    const assetAlloc = holdings?.assetAlloc
    const reportDate = holdings?.reportDate || ''
    const quarter = holdings?.quarter || ''

    // 前十大合计权重
    const totalWeight = useMemo(() => {
        return stocks.reduce((sum, s) => sum + parseWeight(s.weight), 0)
    }, [stocks])

    // 资产配置饼图
    const assetChartOption = useMemo(() => {
        if (!assetAlloc) return null
        const items = [
            { name: '股票', value: assetAlloc.stock, color: '#ef4444' },
            { name: '债券', value: assetAlloc.bond, color: '#22c55e' },
            { name: '现金', value: assetAlloc.cash, color: '#2e8eff' },
        ].filter(x => x.value != null && x.value > 0)
        if (items.length === 0) return null

        const tooltipBg = isDark ? 'rgba(30,41,59,0.96)' : 'rgba(255,255,255,0.96)'
        const tooltipBorder = isDark ? '#475569' : '#e2e8f0'
        const tooltipText = isDark ? '#f1f5f9' : '#1e293b'
        const legendColor = isDark ? '#94a3b8' : '#64748b'

        return {
            tooltip: {
                trigger: 'item',
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderWidth: 1,
                textStyle: { color: tooltipText, fontSize: 12 },
                formatter: p => `${p.name}<br/>${p.value.toFixed(2)}% (${p.percent}%)`,
            },
            legend: {
                bottom: 0,
                textStyle: { color: legendColor, fontSize: 12 },
                itemWidth: 12,
                itemHeight: 8,
            },
            series: [{
                type: 'pie',
                radius: ['48%', '72%'],
                center: ['50%', '46%'],
                avoidLabelOverlap: true,
                label: {
                    show: true,
                    formatter: '{b}\n{c}%',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: 11,
                },
                labelLine: { length: 8, length2: 6 },
                data: items.map(x => ({
                    name: x.name,
                    value: x.value,
                    itemStyle: { color: x.color },
                })),
            }],
        }
    }, [assetAlloc, isDark])

    // 持仓分布条形图（top10 权重条）
    const maxWeight = stocks.length > 0
        ? Math.max(...stocks.map(s => parseWeight(s.weight)))
        : 0

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-border p-4 md:p-5"
        >
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Package className="w-5 h-5 text-primary-500 flex-none" />
                <h2 className="text-base font-bold text-foreground">持仓明细</h2>
                {(reportDate || quarter) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {quarter}（{reportDate}）
                    </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                    数据来自季报，非实时
                </span>
            </div>

            {loading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    加载持仓数据...
                </div>
            ) : stocks.length === 0 && !assetAlloc ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8 opacity-30" />
                    <p className="text-sm">暂无持仓明细数据</p>
                    <p className="text-xs opacity-60">
                        指数基金、货币基金、新成立基金或 FOF 通常不披露前十大股票
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                    {/* 左：资产配置 */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-1.5 mb-2">
                            <PieChart className="w-4 h-4 text-accent-500" />
                            <h3 className="text-sm font-semibold text-foreground">资产配置</h3>
                        </div>
                        {assetChartOption ? (
                            <>
                                <div className="h-[220px]">
                                    <ReactEChartsCore
                                        echarts={echarts}
                                        option={assetChartOption}
                                        style={{ height: '100%', width: '100%' }}
                                        opts={{ renderer: 'canvas' }}
                                        notMerge={true}
                                    />
                                </div>
                                {assetAlloc?.netAsset != null && (
                                    <p className="text-center text-xs text-muted-foreground mt-1">
                                        净资产 <span className="font-semibold text-foreground">
                                            {assetAlloc.netAsset.toFixed(2)}
                                        </span> 亿元
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
                                暂无资产配置数据
                            </div>
                        )}
                    </div>

                    {/* 右：前十大重仓股 */}
                    <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-foreground">前十大重仓股</h3>
                            {totalWeight > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    合计 <span className="font-semibold text-foreground">
                                        {totalWeight.toFixed(2)}%
                                    </span>
                                </span>
                            )}
                        </div>
                        {stocks.length === 0 ? (
                            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
                                暂无股票持仓明细
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {stocks.map((s, i) => {
                                    const w = parseWeight(s.weight)
                                    const barWidth = maxWeight > 0 ? (w / maxWeight) * 100 : 0
                                    return (
                                        <div
                                            key={s.code + i}
                                            className="group flex items-center gap-2 md:gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="w-5 text-xs text-muted-foreground text-right flex-none">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {s.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex-none">
                                                        {s.code}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right flex-none">
                                                <p className="text-sm font-semibold text-foreground">
                                                    {s.weight}
                                                </p>
                                                {s.marketValue && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {s.marketValue} 万
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    )
}
