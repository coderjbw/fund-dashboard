import { useMemo } from 'react'
import { motion } from 'framer-motion'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
    DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@utils/theme'

echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, DataZoomComponent, CanvasRenderer])

export default function DetailChart({ fund, realtimeHistory }) {
    const [, , isDark] = useTheme()
    const points = realtimeHistory[fund.code] || []

    const chartOption = useMemo(() => {
        if (points.length < 2) return null

        const times = points.map(p => p.time)
        const values = points.map(p => p.value)
        const isUp = values[values.length - 1] >= 0
        const lineColor = isUp ? '#ef4444' : '#22c55e'

        const tooltipBg = isDark ? 'rgba(30,41,59,0.96)' : 'rgba(255,255,255,0.96)'
        const tooltipBorder = isDark ? '#475569' : '#e2e8f0'
        const tooltipText = isDark ? '#f1f5f9' : '#1e293b'
        const axisLineColor = isDark ? '#334155' : '#e2e8f0'
        const axisLabelColor = isDark ? '#64748b' : '#94a3b8'
        const splitLineColor = isDark ? '#1e293b' : '#f1f5f9'
        const markLineColor = isDark ? '#475569' : '#cbd5e1'

        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderWidth: 1,
                textStyle: { color: tooltipText, fontSize: 13 },
                formatter: params => {
                    const p = params[0]
                    if (p.value == null) return ''
                    const color = p.value >= 0 ? '#ef4444' : '#22c55e'
                    return `<div style="font-weight:600;margin-bottom:4px">${p.axisValue}</div>
                        <div style="font-size:18px;font-weight:700;color:${color}">
                            ${p.value >= 0 ? '+' : ''}${p.value}%
                        </div>`
                },
            },
            grid: {
                top: 24,
                right: 24,
                bottom: 48,
                left: 56,
            },
            xAxis: {
                type: 'category',
                data: times,
                axisLine: { lineStyle: { color: axisLineColor } },
                axisTick: { show: false },
                axisLabel: { color: axisLabelColor, fontSize: 12 },
                boundaryGap: false,
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: axisLabelColor,
                    fontSize: 12,
                    formatter: '{value}%',
                },
                splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
                axisLine: { show: false },
                axisTick: { show: false },
            },
            dataZoom: [{ type: 'inside', start: 0, end: 100 }],
            series: [{
                type: 'line',
                data: values,
                smooth: true,
                symbol: 'circle',
                symbolSize: 5,
                showSymbol: true,
                lineStyle: { width: 3, color: lineColor },
                itemStyle: { color: lineColor },
                emphasis: { symbolSize: 10 },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: markLineColor, type: 'dashed', width: 1 },
                    data: [{ yAxis: 0 }],
                    label: { show: false },
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: lineColor + '25' },
                        { offset: 1, color: lineColor + '03' },
                    ]),
                },
            }],
        }
    }, [points, fund.code, isDark])

    if (points.length < 2) {
        return (
            <div className={`
                h-full flex flex-col items-center justify-center
                text-muted-foreground rounded-xl
                border border-dashed border-border
            `}>
                <p className="text-sm font-medium">正在采集日内估值数据...</p>
                <p className="text-xs mt-1.5 opacity-60 max-w-xs text-center">
                    每分钟采集一次，至少需要 2 个数据点后显示折线图
                </p>
                {points.length > 0 && (
                    <p className="text-xs mt-2 text-primary-500">已采集 {points.length} 个点</p>
                )}
            </div>
        )
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
            <ReactEChartsCore
                echarts={echarts}
                option={chartOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
            />
        </motion.div>
    )
}
