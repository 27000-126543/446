import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Activity, Thermometer, ShieldAlert, Radio } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { TaskStatus } from '@/types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending_verification: '待验证',
  mesh_generation: '网格生成',
  thermal_solving: '热求解',
  stress_analysis: '应力分析',
  emc_evaluation: 'EMC评估',
  life_prediction: '寿命预测',
  completed: '已完成',
  error_rollback: '错误回退',
}

const STATUS_ORDER: TaskStatus[] = [
  'pending_verification',
  'mesh_generation',
  'thermal_solving',
  'stress_analysis',
  'emc_evaluation',
  'life_prediction',
  'completed',
]

interface TimePoint {
  time: string
  temp: number
  stress: number
  emi: number
}

function LargeGauge({ value, max, label, unit, ranges }: {
  value: number; max: number; label: string; unit: string; ranges: [number, string][]
}) {
  const option = {
    series: [{
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max,
      radius: '85%',
      pointer: { width: 5, length: '65%', itemStyle: { color: '#00D4FF' } },
      axisLine: { lineStyle: { width: 12, color: ranges } },
      axisTick: { length: 6, lineStyle: { color: '#6B7394' } },
      splitLine: { length: 12, lineStyle: { color: '#252E52', width: 2 } },
      axisLabel: { color: '#6B7394', fontSize: 10, distance: 15 },
      detail: {
        formatter: `{value}${unit}`,
        fontSize: 22,
        fontFamily: 'Orbitron',
        color: '#E8EDF5',
        offsetCenter: [0, '70%'],
      },
      title: { show: true, offsetCenter: [0, '95%'], fontSize: 13, color: '#6B7394' },
      data: [{ value: value.toFixed(1), name: label }],
    }],
  }
  return <ReactECharts option={option} style={{ height: 220, width: '100%' }} opts={{ renderer: 'canvas' }} />
}

const TEMP_RANGES: [number, string][] = [[60 / 120, '#00E5A0'], [85 / 120, '#FF6B35'], [1, '#FF2D55']]
const STRESS_RANGES: [number, string][] = [[150 / 350, '#00E5A0'], [250 / 350, '#FF6B35'], [1, '#FF2D55']]
const EMI_RANGES: [number, string][] = [[6 / 30, '#FF2D55'], [12 / 30, '#FF6B35'], [1, '#00E5A0']]

export default function Monitor() {
  const { id } = useParams()
  const { tasks, monitoringData } = useStore()
  const task = tasks.find((t) => t.id === id)
  const taskMonitoring = monitoringData.filter((m) => m.taskId === id)
  const [liveData, setLiveData] = useState<TimePoint[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const initial: TimePoint[] = taskMonitoring.map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      temp: m.junctionTemp,
      stress: m.equivalentStress,
      emi: m.emiMargin,
    }))
    setLiveData(initial)
  }, [taskMonitoring])

  useEffect(() => {
    if (!task) return
    intervalRef.current = setInterval(() => {
      const now = new Date()
      setLiveData((prev) => {
        const last = prev[prev.length - 1]
        const newTemp = Math.max(0, Math.min(120, (last?.temp ?? 70) + (Math.random() - 0.48) * 4))
        const newStress = Math.max(0, Math.min(350, (last?.stress ?? 180) + (Math.random() - 0.48) * 8))
        const newEmi = Math.max(0, Math.min(30, (last?.emi ?? 10) + (Math.random() - 0.48) * 1.5))
        const next = [
          ...prev,
          {
            time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            temp: +newTemp.toFixed(1),
            stress: +newStress.toFixed(1),
            emi: +newEmi.toFixed(1),
          },
        ]
        return next.length > 50 ? next.slice(-50) : next
      })
    }, 2000)
    return () => clearInterval(intervalRef.current)
  }, [task])

  if (!task) {
    return <div className="flex items-center justify-center h-full text-cyber-dim">未找到任务数据</div>
  }

  const currentTemp = liveData[liveData.length - 1]?.temp ?? task.junctionTemp
  const currentStress = liveData[liveData.length - 1]?.stress ?? task.equivalentStress
  const currentEmi = liveData[liveData.length - 1]?.emi ?? task.emiMargin
  const currentStatusIdx = STATUS_ORDER.indexOf(task.status)

  const lineOption = {
    backgroundColor: 'transparent',
    grid: { top: 30, right: 15, bottom: 30, left: 50 },
    legend: {
      data: ['结温(°C)', '等效应力(MPa)', 'EMI裕量(dB)'],
      textStyle: { color: '#6B7394', fontSize: 11 },
      top: 5,
    },
    xAxis: {
      type: 'category' as const,
      data: liveData.map((d) => d.time),
      axisLine: { lineStyle: { color: '#252E52' } },
      axisLabel: { color: '#6B7394', fontSize: 9, rotate: 30 },
    },
    yAxis: [{
      type: 'value' as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1C2444' } },
      axisLabel: { color: '#6B7394', fontSize: 10 },
    }],
    series: [
      {
        name: '结温(°C)', type: 'line' as const, smooth: true, showSymbol: false,
        data: liveData.map((d) => d.temp),
        lineStyle: { color: '#FF2D55', width: 2 }, itemStyle: { color: '#FF2D55' },
        markLine: {
          data: [
            { yAxis: 85, name: '85°C', lineStyle: { color: '#FF2D55', type: 'dashed' as const, width: 1.5 }, label: { color: '#FF2D55', fontSize: 9 } },
            { yAxis: 60, name: '60°C', lineStyle: { color: '#00E5A0', type: 'dashed' as const, width: 1 }, label: { color: '#00E5A0', fontSize: 9 } },
          ],
        },
      },
      {
        name: '等效应力(MPa)', type: 'line' as const, smooth: true, showSymbol: false,
        data: liveData.map((d) => d.stress),
        lineStyle: { color: '#FF6B35', width: 2 }, itemStyle: { color: '#FF6B35' },
        markLine: {
          data: [
            { yAxis: 250, name: '250MPa', lineStyle: { color: '#FF6B35', type: 'dashed' as const, width: 1.5 }, label: { color: '#FF6B35', fontSize: 9 } },
            { yAxis: 150, name: '150MPa', lineStyle: { color: '#00E5A0', type: 'dashed' as const, width: 1 }, label: { color: '#00E5A0', fontSize: 9 } },
          ],
        },
      },
      {
        name: 'EMI裕量(dB)', type: 'line' as const, smooth: true, showSymbol: false,
        data: liveData.map((d) => d.emi),
        lineStyle: { color: '#00E5A0', width: 2 }, itemStyle: { color: '#00E5A0' },
        markLine: {
          data: [
            { yAxis: 6, name: '6dB', lineStyle: { color: '#FF2D55', type: 'dashed' as const, width: 1.5 }, label: { color: '#FF2D55', fontSize: 9 } },
            { yAxis: 12, name: '12dB', lineStyle: { color: '#FF6B35', type: 'dashed' as const, width: 1 }, label: { color: '#FF6B35', fontSize: 9 } },
          ],
        },
      },
    ],
    tooltip: { trigger: 'axis' as const, backgroundColor: '#151B36', borderColor: '#252E52', textStyle: { color: '#E8EDF5', fontSize: 11 } },
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-cyber-white">{task.name}</h2>
          <span className="text-xs text-cyber-dim">{task.modelName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_ORDER.map((status, idx) => (
            <div key={status} className="flex items-center">
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  idx < currentStatusIdx
                    ? 'bg-cyber-green/10 text-cyber-green'
                    : idx === currentStatusIdx
                    ? 'bg-cyber-blue/10 text-cyber-blue'
                    : 'bg-deep-600/50 text-cyber-dim'
                }`}
              >
                {idx < currentStatusIdx && <span>✓</span>}
                {STATUS_LABELS[status]}
              </div>
              {idx < STATUS_ORDER.length - 1 && (
                <div className={`w-3 h-0.5 ${idx < currentStatusIdx ? 'bg-cyber-green' : 'bg-deep-500'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer className="w-4 h-4 text-cyber-red" />
            <span className="text-xs text-cyber-dim">结温</span>
          </div>
          <LargeGauge value={currentTemp} max={120} label="结温" unit="°C" ranges={TEMP_RANGES} />
        </div>
        <div className="glass-card p-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-cyber-orange" />
            <span className="text-xs text-cyber-dim">等效应力</span>
          </div>
          <LargeGauge value={currentStress} max={350} label="等效应力" unit="MPa" ranges={STRESS_RANGES} />
        </div>
        <div className="glass-card p-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-cyber-green" />
            <span className="text-xs text-cyber-dim">EMI裕量</span>
          </div>
          <LargeGauge value={currentEmi} max={30} label="EMI裕量" unit="dB" ranges={EMI_RANGES} />
        </div>
      </div>

      <div className="glass-card p-4 flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-cyber-blue" />
          <h3 className="text-sm font-semibold text-cyber-white">实时时序曲线</h3>
          <span className="ml-auto flex items-center gap-1 text-xs text-cyber-green">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
            实时更新
          </span>
        </div>
        <ReactECharts option={lineOption} style={{ height: 'calc(100% - 30px)' }} opts={{ renderer: 'canvas' }} />
      </div>
    </div>
  )
}
