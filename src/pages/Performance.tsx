import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Activity, Heart, AlertTriangle, Shield, Zap, Clock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { DailyStats } from '@/types'

const radarDims = [
  { name: '模拟完成率', max: 100 },
  { name: '温度余量', max: 100 },
  { name: '应力余量', max: 100 },
  { name: 'EMI余量', max: 100 },
  { name: '优化收敛率', max: 100 },
  { name: '系统可靠性', max: 100 },
]

function formatPercent(v: number) {
  return (v * 100).toFixed(1)
}

function CircularScore({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#252E52" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#00D4FF" strokeWidth={4} strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

export default function Performance() {
  const { dailyStats, alerts } = useStore()
  const today: DailyStats = useMemo(() => dailyStats[dailyStats.length - 1], [dailyStats])
  const last7 = useMemo(() => dailyStats.slice(-7), [dailyStats])
  const dates = useMemo(() => last7.map((d) => d.date.slice(5)), [last7])
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts])

  const radarValues = useMemo(() => [
    today.completionRate * 100,
    Math.min((today.avgTempMargin / 20) * 100, 100),
    Math.min((today.avgStressMargin / 100) * 100, 100),
    Math.min((today.avgEmiMargin / 15) * 100, 100),
    Math.min((today.optimizationConvergenceCount / 8) * 100, 100),
    today.healthScore,
  ], [today])

  const radarOption = useMemo(() => ({
    tooltip: {},
    radar: {
      indicator: radarDims,
      shape: 'polygon' as const,
      splitNumber: 4,
      axisName: { color: '#6B7394', fontSize: 12 },
      splitLine: { lineStyle: { color: '#252E52' } },
      splitArea: { areaStyle: { color: ['rgba(0,212,255,0.02)', 'rgba(0,212,255,0.04)'] } },
      axisLine: { lineStyle: { color: '#252E52' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: radarValues,
        areaStyle: { color: 'rgba(0,212,255,0.2)' },
        lineStyle: { color: '#00D4FF', width: 2 },
        itemStyle: { color: '#00D4FF' },
      }],
    }],
  }), [radarValues])

  const completionTrendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: dates, axisLine: { lineStyle: { color: '#252E52' } }, axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value' as const, min: 60, max: 100, axisLabel: { color: '#6B7394', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1C2444' } } },
    series: [{
      type: 'line', data: last7.map((d) => +(d.completionRate * 100).toFixed(1)),
      smooth: true, symbol: 'circle', symbolSize: 6,
      lineStyle: { color: '#00D4FF', width: 2 },
      itemStyle: { color: '#00D4FF' },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.3)' }, { offset: 1, color: 'rgba(0,212,255,0.02)' }] } },
    }],
  }), [last7, dates])

  const marginStackOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['温度余量', '应力余量', 'EMI余量'], textStyle: { color: '#6B7394', fontSize: 11 }, top: 0 },
    grid: { top: 36, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: dates, axisLine: { lineStyle: { color: '#252E52' } }, axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#1C2444' } } },
    series: [
      { name: '温度余量', type: 'line', stack: 'margin', data: last7.map((d) => d.avgTempMargin), smooth: true, areaStyle: { color: 'rgba(255,107,53,0.25)' }, lineStyle: { color: '#FF6B35', width: 1.5 }, itemStyle: { color: '#FF6B35' } },
      { name: '应力余量', type: 'line', stack: 'margin', data: last7.map((d) => d.avgStressMargin), smooth: true, areaStyle: { color: 'rgba(123,97,255,0.25)' }, lineStyle: { color: '#7B61FF', width: 1.5 }, itemStyle: { color: '#7B61FF' } },
      { name: 'EMI余量', type: 'line', stack: 'margin', data: last7.map((d) => d.avgEmiMargin), smooth: true, areaStyle: { color: 'rgba(0,229,160,0.25)' }, lineStyle: { color: '#00E5A0', width: 1.5 }, itemStyle: { color: '#00E5A0' } },
    ],
  }), [last7, dates])

  const convergenceOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: dates, axisLine: { lineStyle: { color: '#252E52' } }, axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value' as const, min: 0, axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#1C2444' } } },
    series: [{
      type: 'line', data: last7.map((d) => d.optimizationConvergenceCount),
      smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { color: '#00E5A0', width: 2 },
      itemStyle: { color: '#00E5A0' },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,160,0.25)' }, { offset: 1, color: 'rgba(0,229,160,0.02)' }] } },
    }],
  }), [last7, dates])

  const events = useMemo(() => {
    const items: { icon: React.ElementType; color: string; label: string; time: string }[] = []
    activeAlerts.forEach((a) => {
      const color = a.level === 'emergency' ? '#FF2D55' : a.level === 'critical' ? '#FF6B35' : '#FF6B35'
      items.push({ icon: AlertTriangle, color, label: `[${a.type.toUpperCase()}] ${a.taskName}: ${a.message.slice(0, 40)}…`, time: a.createdAt.slice(5, 16) })
    })
    last7.forEach((d) => {
      if (d.alertCount > 4) {
        items.push({ icon: Shield, color: '#FF6B35', label: `${d.date.slice(5)} 预警激增 ${d.alertCount} 条，启动自动巡检`, time: d.date })
      }
    })
    return items.slice(0, 8)
  }, [activeAlerts, last7])

  return (
    <div className="space-y-4 overflow-auto h-full pb-4">
      <motion.div {...fadeUp} transition={{ delay: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-cyber-blue" />
          <h1 className="text-xl font-semibold text-cyber-white">性能看板</h1>
        </div>
        <div className="cyber-btn text-xs flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          近 7 天
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.05}} className="glass-card p-5">
        <div className="section-title mb-3"><Activity className="w-4 h-4 text-cyber-blue" />健康雷达</div>
        <ReactECharts option={radarOption} style={{ height: 280 }} />
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="grid grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, label: '今日完成率', value: formatPercent(today.completionRate), unit: '%', color: '#00D4FF' },
          { icon: AlertTriangle, label: '活跃预警数', value: String(today.alertCount), unit: '', color: today.alertCount > 3 ? '#FF2D55' : '#00E5A0' },
          { icon: Zap, label: '优化收敛次数', value: String(today.optimizationConvergenceCount), unit: '', color: '#00E5A0' },
          { icon: Heart, label: '综合健康评分', value: String(today.healthScore), unit: '', color: '#00D4FF' },
        ].map((m) => (
          <div key={m.label} className="glass-card p-4 flex flex-col items-center gap-2">
            <m.icon className="w-4 h-4" style={{ color: m.color }} />
            <span className="text-xs text-cyber-dim">{m.label}</span>
            <div className="flex items-end gap-1">
              <span className="font-orbitron text-2xl font-bold" style={{ color: m.color }}>{m.value}</span>
              {m.unit && <span className="text-xs text-cyber-dim mb-1">{m.unit}</span>}
            </div>
            {m.label === '综合健康评分' && (
              <div className="relative -mt-2">
                <CircularScore value={today.healthScore} />
                <span className="absolute inset-0 flex items-center justify-center font-orbitron text-xs text-cyber-blue">{today.healthScore}</span>
              </div>
            )}
          </div>
        ))}
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <div className="section-title text-sm mb-2"><TrendingUp className="w-4 h-4 text-cyber-blue" />模拟完成率趋势</div>
          <ReactECharts option={completionTrendOption} style={{ height: 200 }} />
        </div>
        <div className="glass-card p-4">
          <div className="section-title text-sm mb-2"><BarChart3 className="w-4 h-4 text-cyber-blue" />关键指标余量分布</div>
          <ReactECharts option={marginStackOption} style={{ height: 200 }} />
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="glass-card p-4">
        <div className="section-title text-sm mb-2"><Zap className="w-4 h-4 text-cyber-green" />优化收敛趋势</div>
        <ReactECharts option={convergenceOption} style={{ height: 180 }} />
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="glass-card p-4">
        <div className="section-title text-sm mb-3"><AlertTriangle className="w-4 h-4 text-cyber-orange" />异常事件时间线</div>
        <div className="relative pl-6 border-l-2 border-deep-500 space-y-4">
          {events.map((ev, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2" style={{ borderColor: ev.color, background: '#0A0E1A' }} />
              <div className="text-xs text-cyber-dim mb-0.5">{ev.time}</div>
              <div className="text-sm text-cyber-white flex items-center gap-1.5">
                <ev.icon className="w-3.5 h-3.5 shrink-0" style={{ color: ev.color }} />
                {ev.label}
              </div>
            </div>
          ))}
          {events.length === 0 && <div className="text-cyber-dim text-sm">暂无异常事件</div>}
        </div>
      </motion.div>
    </div>
  )
}
