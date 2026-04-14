import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@utils/theme'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

// 配色盘
const COLOR_PALETTE = [
    '#2e8eff', '#22c55e', '#f97316', '#ef4444', '#06b6d4',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
]

export default function FundChart({ funds }) {
    const [, , isDark] = useTheme()

    const option = useMemo(() => {
        if (funds.length === 0) return null

        const dates = funds[0]?.history.map(h => h.date) || []

        const tooltipBg = isDark ? 'rgba(30,41,59,0.96)' : 'rgba(255,255,255,0.96)'
        const tooltipBorder = isDark ? '#475569' : '#e2e8f0'
        const tooltipText = isDark ? '#f1f5f9' : '#1e293b'
        const axisLineColor = isDark ? '#334155' : '#e2e8f0'
        const axisLabelColor = isDark ? '#64748b' : '#94a3b8'
        const splitLineColor = isDark ? '#1e293b' : '#f1f5f9'
        const legendColor = isDark ? '#94a3b8' : '#64748b'

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
                        const color = val >= 0 ? '#ef4444' : '#22c55e'
                        html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
                            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block">
                            </span>
                            <span style="flex:1">${p.seriesName}</span>
                            <span style="font-weight:600;color:${color}">${val >= 0 ? '+' : ''}${val}%</span>
                        </div>`
                    })
                    return html
                },
            },
            legend: {
                data: funds.map(f => f.name),
                bottom: 0,
                type: 'scroll',
                textStyle: { color: legendColor, fontSize: 12 },
                itemWidth: 16,
                itemHeight: 8,
                itemGap: 16,
            },
            grid: {
                top: 20,
                right: 20,
                bottom: 50,
                left: 50,
                containLabel: false,
            },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: axisLineColor } },
                axisTick: { show: false },
                axisLabel: {
                    color: axisLabelColor,
                    fontSize: 11,
                    interval: 'auto',
                },
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
            series: funds.map((fund, idx) => ({
                name: fund.name,
                type: 'line',
                data: fund.history.map(h => h.value),
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                showSymbol: false,
                lineStyle: { width: 2.5, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] },
                itemStyle: { color: COLOR_PALETTE[idx % COLOR_PALETTE.length] },
                emphasis: {
                    focus: 'series',
                    symbolSize: 8,
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] + '20' },
                        { offset: 1, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] + '02' },
                    ]),
                },
            })),
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100,
                },
            ],
        }
    }, [funds, isDark])

    return (
        <div className="h-full flex flex-col">
            {/* 标题栏 */}
            <div className="flex items-center gap-2 mb-5">
                <BarChart3 className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-foreground">涨幅走势</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                    近 30 日每日涨幅 (%)
                </span>
            </div>

            {/* 统计卡片 */}
            {funds.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                        {
                            label: '平均涨幅',
                            value: (
                                funds.reduce((sum, f) => sum + parseFloat(f.dailyChange), 0)
                                / funds.length
                            ).toFixed(2),
                            suffix: '%',
                        },
                        {
                            label: '最高涨幅',
                            value: Math.max(...funds.map(f => parseFloat(f.dailyChange))).toFixed(2),
                            suffix: '%',
                        },
                        {
                            label: '最低涨幅',
                            value: Math.min(...funds.map(f => parseFloat(f.dailyChange))).toFixed(2),
                            suffix: '%',
                        },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{opacity: 0, y: 10}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: i * 0.1}}
                            className="bg-muted rounded-xl p-3 text-center"
                        >
                            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                            <p className={`text-lg font-bold ${
                                parseFloat(stat.value) >= 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-secondary-600 dark:text-secondary-400'
                            }`}>
                                {parseFloat(stat.value) >= 0 ? '+' : ''}{stat.value}{stat.suffix}
                            </p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* 图表区域 */}
            <div className="flex-1 min-h-0">
                {funds.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-sm">添加基金后查看涨幅走势</p>
                        <p className="text-xs mt-1 opacity-60">在左侧搜索并添加基金</p>
                    </div>
                ) : (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        className="h-full"
                    >
                        <ReactEChartsCore
                            echarts={echarts}
                            option={option}
                            style={{height: '100%', width: '100%'}}
                            opts={{renderer: 'canvas'}}
                        />
                    </motion.div>
                )}
            </div>
        </div>
    )
}
