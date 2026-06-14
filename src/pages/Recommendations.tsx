import { useStore } from '@/store/useStore'
import type { RecommendationType } from '@/types'
import ReactECharts from 'echarts-for-react'
import { motion } from 'framer-motion'
import { Wrench, Layers, Shield } from 'lucide-react'

const typeConfig: Record<RecommendationType, { icon: React.ReactNode; label: string }> = {
  heat_sink_wingspan: { icon: <Wrench className="w-5 h-5" />, label: '散热器翼展优化' },
  insulation_layers: { icon: <Layers className="w-5 h-5" />, label: '多层隔热层数优化' },
  cable_shielding: { icon: <Shield className="w-5 h-5" />, label: '电缆屏蔽结构优化' },
}

const statusStyles: Record<string, string> = {
  pending: 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/40',
  adopted: 'bg-cyber-green/20 text-cyber-green border border-cyber-green/40',
  ignored: 'bg-cyber-dim/20 text-cyber-dim border border-cyber-dim/40',
}

const statusLabels: Record<string, string> = { pending: '待处理', adopted: '已采纳', ignored: '已忽略' }

function GaugeChart({ value }: { value: number }) {
  const option = {
    series: [{
      type: 'gauge',
      startAngle: 225,
      endAngle: -45,
      min: 0,
      max: 1,
      radius: '90%',
      pointer: { show: false },
      progress: { show: true, width: 6, roundCap: true, itemStyle: { color: '#00D4FF' } },
      axisLine: { lineStyle: { width: 6, color: [[1, '#252E52']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 14,
        fontFamily: 'Orbitron',
        color: '#00D4FF',
        offsetCenter: [0, 0],
        formatter: (v: number) => `${Math.round(v * 100)}%`,
      },
      data: [{ value }],
    }],
  }
  return <ReactECharts option={option} style={{ width: 80, height: 80 }} />
}

function TrendChart() {
  const categories = ['第1轮', '第2轮', '第3轮', '第4轮', '第5轮', '第6轮']
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#151B36', borderColor: '#252E52', textStyle: { color: '#E8EDF5', fontSize: 12 } },
    legend: { data: ['散热器翼展', '隔热层数', '屏蔽结构'], textStyle: { color: '#6B7394', fontSize: 12 }, top: 0 },
    grid: { top: 40, right: 20, bottom: 30, left: 45 },
    xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: '#252E52' } }, axisLabel: { color: '#6B7394', fontSize: 11 } },
    yAxis: { type: 'value', name: '质量评分', nameTextStyle: { color: '#6B7394', fontSize: 11 }, axisLine: { show: false }, splitLine: { lineStyle: { color: '#252E52', type: 'dashed' } }, axisLabel: { color: '#6B7394', fontSize: 11 } },
    series: [
      { name: '散热器翼展', type: 'line', smooth: true, data: [62, 68, 71, 76, 82, 87], lineStyle: { color: '#00D4FF', width: 2 }, itemStyle: { color: '#00D4FF' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.15)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } } },
      { name: '隔热层数', type: 'line', smooth: true, data: [55, 60, 67, 74, 78, 82], lineStyle: { color: '#7B61FF', width: 2 }, itemStyle: { color: '#7B61FF' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(123,97,255,0.15)' }, { offset: 1, color: 'rgba(123,97,255,0)' }] } } },
      { name: '屏蔽结构', type: 'line', smooth: true, data: [48, 55, 61, 65, 72, 79], lineStyle: { color: '#00E5A0', width: 2 }, itemStyle: { color: '#00E5A0' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,229,160,0.15)' }, { offset: 1, color: 'rgba(0,229,160,0)' }] } } },
    ],
  }
  return <ReactECharts option={option} style={{ height: 260 }} />
}

export default function Recommendations() {
  const { recommendations, adoptRecommendation, ignoreRecommendation } = useStore()

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold text-cyber-white flex items-center gap-2">
          <span className="glow-text">智能推荐引擎</span>
        </h1>
        <p className="text-cyber-dim text-sm mt-1">基于历史模拟结果智能推荐最优热控设计参数</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recommendations.map((rec, idx) => {
          const cfg = typeConfig[rec.type]
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="glass-card-hover p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyber-blue/10 text-cyber-blue">{cfg.icon}</div>
                  <div>
                    <div className="text-sm font-medium text-cyber-white">{cfg.label}</div>
                    <div className="text-xs text-cyber-dim">{rec.modelName}</div>
                  </div>
                </div>
                <span className={`status-badge ${statusStyles[rec.status]}`}>{statusLabels[rec.status]}</span>
              </div>

              <p className="text-sm text-cyber-dim leading-relaxed">{rec.suggestion}</p>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-cyber-dim">推荐值</span>
                  <div className="font-orbitron text-xl font-bold text-cyber-blue glow-text">{rec.value}</div>
                </div>
                <GaugeChart value={rec.confidence} />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-cyber-dim">历史依据</span>
                <ul className="space-y-1">
                  {rec.historicalBasis.map((basis, i) => (
                    <li key={i} className="text-xs text-cyber-dim/80 flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full bg-cyber-blue/60 shrink-0" />
                      {basis}
                    </li>
                  ))}
                </ul>
              </div>

              {rec.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => adoptRecommendation(rec.id)} className="cyber-btn-primary flex-1 text-center">采纳</button>
                  <button onClick={() => ignoreRecommendation(rec.id)} className="cyber-btn flex-1 text-center">忽略</button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card-hover p-5"
      >
        <h2 className="section-title mb-4">参数优化趋势对比</h2>
        <TrendChart />
      </motion.div>
    </div>
  )
}
