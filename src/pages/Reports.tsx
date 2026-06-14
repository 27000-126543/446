import { useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { FileText, Download, Filter, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import jsPDF from 'jspdf'
import type { SimulationTask } from '@/types'

const SUBSYSTEMS = ['电源', '通信', '热控', '姿控', '推进', '测控', '数管', '有效载荷']

type OrbitPhase = '全阶段' | '近地阶段' | '转移阶段' | '近星阶段' | '远星阶段'
type CommBand = '全频段' | 'S频段' | 'X频段' | 'Ka频段'
type PowerLevel = '全功率' | '低功率' | '额定功率' | '满功率'

const ORBIT_SCALING: Record<OrbitPhase, { thermal: number; displacement: number; emi: number; jitter: number; aging: number; label: string }> = {
  '全阶段':   { thermal: 1.00, displacement: 1.00, emi: 1.00, jitter: 1.00, aging: 1.00, label: '综合工况' },
  '近地阶段': { thermal: 0.85, displacement: 0.80, emi: 0.90, jitter: 0.75, aging: 0.70, label: 'LEO - 低轨道，地磁屏蔽完善，负荷较低' },
  '转移阶段': { thermal: 1.10, displacement: 1.15, emi: 1.15, jitter: 1.25, aging: 1.20, label: 'GTO/Trans-Lunar - 穿越范艾伦带，辐射加剧' },
  '近星阶段': { thermal: 1.30, displacement: 1.25, emi: 1.20, jitter: 1.15, aging: 1.40, label: 'Near-Planet - 近体气动/引力梯度，热流最高' },
  '远星阶段': { thermal: 0.75, displacement: 0.90, emi: 1.30, jitter: 1.45, aging: 1.15, label: 'Deep Space - 低温背景，通信距离最远' },
}

const BAND_SCALING: Record<CommBand, { crosstalk: number; emiMargin: number; jitter: number; label: string; freqGHz: string }> = {
  '全频段': { crosstalk: 1.00, emiMargin: 1.00, jitter: 1.00, label: '全频段覆盖', freqGHz: '综合' },
  'S频段':   { crosstalk: 0.75, emiMargin: 1.30, jitter: 0.70, label: 'S 频段 (2-4 GHz) - 低串扰遥测链路', freqGHz: '2~4' },
  'X频段':   { crosstalk: 1.00, emiMargin: 1.00, jitter: 1.00, label: 'X 频段 (8-12 GHz) - 主力数传链路', freqGHz: '8~12' },
  'Ka频段':  { crosstalk: 1.55, emiMargin: 0.70, jitter: 1.50, label: 'Ka 频段 (27-40 GHz) - 高速数传，电磁环境严酷', freqGHz: '27~40' },
}

const POWER_SCALING: Record<PowerLevel, { thermal: number; displacement: number; emi: number; aging: number; label: string; loadFactor: number }> = {
  '全功率':   { thermal: 1.00, displacement: 1.00, emi: 1.00, aging: 1.00, label: '全功率包络', loadFactor: 1.00 },
  '低功率':   { thermal: 0.62, displacement: 0.55, emi: 0.70, aging: 0.55, label: '待机/安全模式 - 低负荷', loadFactor: 0.35 },
  '额定功率': { thermal: 1.00, displacement: 1.00, emi: 1.00, aging: 1.00, label: '额定工作点 - 设计基线', loadFactor: 0.75 },
  '满功率':   { thermal: 1.35, displacement: 1.28, emi: 1.30, aging: 1.48, label: '载荷全开工况 - 热/力/EMI 三临界', loadFactor: 1.00 },
}

function hashCode(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRandom(seed: number) {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s & 0xffffffff) / 0xffffffff
  }
}

function genHeatmap10x10(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed))
  const data: number[][] = []
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const base = 35 + rand() * 45
    const v = base * scale
    data.push([x, y, +Math.min(115, Math.max(15, v)).toFixed(1)])
  }
  return data
}

function genDisplacementField(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0x9e3779b9)
  const data: number[][] = []
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const base = 0.05 + rand() * 0.35
    const v = base * scale
    data.push([x, y, +Math.min(0.8, Math.max(0.005, v)).toFixed(3)])
  }
  return data
}

function genJitterSignal(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0x85ebca6b)
  const signal: number[] = []
  for (let i = 0; i < 100; i++) {
    const wave = Math.sin(i / 5) * 50 + Math.cos(i / 13) * 20
    const noise = (rand() - 0.5) * 60 * scale
    signal.push(+(wave + noise).toFixed(2))
  }
  return signal
}

function genAgingCurves(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0xc2b2ae35)
  const cycles = Array.from({ length: 50 }, (_, i) => i + 1)
  const thermal    = cycles.map((c) => +(100 - c * 0.8 * scale + (rand() - 0.5) * 6).toFixed(1))
  const mechanical = cycles.map((c) => +(92  - c * 0.6 * scale + (rand() - 0.5) * 5).toFixed(1))
  const electrical = cycles.map((c) => +(96  - c * 0.9 * scale + (rand() - 0.5) * 7).toFixed(1))
  return { cycles, thermal, mechanical, electrical }
}

function genCrosstalkMatrix(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0xf61e5f5b)
  const data: number[][] = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (x === y) {
      data.push([x, y, 1])
    } else {
      const base = 0.02 + rand() * 0.25
      const v = Math.min(0.75, base * scale)
      data.push([x, y, +v.toFixed(3)])
    }
  }
  return data
}

function deriveMetrics(task: SimulationTask, orbitKey: OrbitPhase, bandKey: CommBand, powerKey: PowerLevel) {
  const orbit = ORBIT_SCALING[orbitKey]
  const band = BAND_SCALING[bandKey]
  const power = POWER_SCALING[powerKey]
  const baseLifeYears = 12
  return {
    junctionTemp:     +(task.junctionTemp     * power.thermal  * orbit.thermal).toFixed(1),
    equivalentStress: +(task.equivalentStress * power.displacement * orbit.displacement).toFixed(1),
    emiMargin:        +(task.emiMargin        * band.emiMargin / Math.max(0.6, power.emi)).toFixed(1),
    heatFluxPeak:     +(1250 * power.thermal * orbit.thermal).toFixed(0),
    solarCellDegradation: +(baseLifeYears * 1.1 * orbit.aging * power.aging).toFixed(2),
  }
}

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_')
}

export default function Reports() {
  const { tasks } = useStore()
  const [selectedTask, setSelectedTask] = useState(tasks[0]?.id ?? '')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generated, setGenerated] = useState(false)
  const [orbitPhase, setOrbitPhase] = useState<OrbitPhase>('全阶段')
  const [commBand, setCommBand] = useState<CommBand>('全频段')
  const [powerLevel, setPowerLevel] = useState<PowerLevel>('全功率')
  const [exportFmt, setExportFmt] = useState('CSV')
  const [exporting, setExporting] = useState(false)
  const tempChartRef = useRef<ReactECharts>(null)
  const dispChartRef = useRef<ReactECharts>(null)
  const jitterChartRef = useRef<ReactECharts>(null)
  const agingChartRef = useRef<ReactECharts>(null)

  const task = tasks.find((t) => t.id === selectedTask)

  // 关键修复：seedKey 必须包含所有三个筛选维度，确保切换任意筛选都即时重新生成数据（问题4）
  const seedKey = useMemo(
    () => `${selectedTask}|${orbitPhase}|${commBand}|${powerLevel}|v2`,
    [selectedTask, orbitPhase, commBand, powerLevel],
  )

  const orbitScale = ORBIT_SCALING[orbitPhase]
  const bandScale = BAND_SCALING[commBand]
  const powerScale = POWER_SCALING[powerLevel]

  // 所有可视化数据随筛选即时变化（useMemo 依赖 seedKey，保证一致性）
  const tempData = useMemo(
    () => genHeatmap10x10(seedKey + ':T', orbitScale.thermal * powerScale.thermal),
    [seedKey, orbitScale.thermal, powerScale.thermal],
  )
  const dispData = useMemo(
    () => genDisplacementField(seedKey + ':D', orbitScale.displacement * powerScale.displacement),
    [seedKey, orbitScale.displacement, powerScale.displacement],
  )
  const jitterData = useMemo(
    () => genJitterSignal(seedKey + ':J', bandScale.jitter * orbitScale.jitter),
    [seedKey, bandScale.jitter, orbitScale.jitter],
  )
  const agingData = useMemo(
    () => genAgingCurves(seedKey + ':A', orbitScale.aging * powerScale.aging),
    [seedKey, orbitScale.aging, powerScale.aging],
  )
  const crosstalkData = useMemo(
    () => genCrosstalkMatrix(seedKey + ':E', bandScale.crosstalk),
    [seedKey, bandScale.crosstalk],
  )
  const metrics = useMemo(
    () => task ? deriveMetrics(task, orbitPhase, commBand, powerLevel) : null,
    [task, orbitPhase, commBand, powerLevel],
  )

  const tempOption = useMemo(() => ({
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 15, max: 115, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF6B35', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: tempData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }), [tempData])

  const dispOption = useMemo(() => ({
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 0, max: 0.8, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#151B36', '#7B61FF', '#00E5A0'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: dispData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }), [dispData])

  const jitterOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 100 }, (_, i) => i), axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value', axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{ type: 'line', data: jitterData, showSymbol: false, lineStyle: { color: '#00D4FF', width: 1 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.3)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } } }],
  }), [jitterData])

  const agingOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['热退化', '力退化', '电退化'], textStyle: { color: '#6B7394' }, top: 0 },
    grid: { top: 30, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: agingData.cycles, axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value', axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [
      { name: '热退化', type: 'line', data: agingData.thermal, lineStyle: { color: '#FF6B35' }, itemStyle: { color: '#FF6B35' } },
      { name: '力退化', type: 'line', data: agingData.mechanical, lineStyle: { color: '#7B61FF' }, itemStyle: { color: '#7B61FF' } },
      { name: '电退化', type: 'line', data: agingData.electrical, lineStyle: { color: '#00E5A0' }, itemStyle: { color: '#00E5A0' } },
    ],
  }), [agingData])

  const crosstalkOption = useMemo(() => ({
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    yAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    visualMap: { min: 0, max: 0.75, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: crosstalkData, label: { show: true, color: '#E8EDF5', fontSize: 9 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }), [crosstalkData])

  function captureChart(ref: React.RefObject<ReactECharts>) {
    try {
      const inst = ref.current?.getEchartsInstance()
      if (inst) {
        const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0A0E1A' })
        return url
      }
    } catch { /* noop */ }
    return ''
  }

  function handleGenerate() {
    setGenerating(true)
    setProgress(0)
    setGenerated(false)
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer)
          setGenerating(false)
          setGenerated(true)
          return 100
        }
        return p + 5
      })
    }, 120)
  }

  function handleDownloadPdf() {
    if (!task || !metrics) return
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('DEEP SPACE SPACECRAFT SIMULATION REPORT', 40, 50)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Task: ${task.name}`, 40, 75)
    doc.text(`Model: ${task.modelName}`, 40, 92)
    doc.text(`Task ID: ${task.id}`, 40, 109)
    doc.text(`Generated: ${new Date().toLocaleString('zh-CN')}`, 40, 126)
    doc.text(`Orbit: ${orbitPhase} [${orbitScale.label}]`, 40, 143)
    doc.text(`Comm : ${commBand} [${bandScale.label}]`, 40, 160)
    doc.text(`Power: ${powerLevel} [${powerScale.label}]`, 40, 177)

    doc.setDrawColor(0, 212, 255, 0.4)
    doc.line(40, 189, pageWidth - 40, 189)

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Simulation Metrics (筛选后)', 40, 209)

    doc.setFillColor(21, 27, 54)
    doc.roundedRect(40, 219, 155, 68, 4, 4, 'F')
    doc.roundedRect(205, 219, 155, 68, 4, 4, 'F')
    doc.roundedRect(370, 219, 155, 68, 4, 4, 'F')

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.text('Junction Temp', 55, 239)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (metrics.junctionTemp > 85) {
      doc.setTextColor(255, 45, 85)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${metrics.junctionTemp.toFixed(1)} C`, 55, 262)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text(`Peak Heat Flux: ${metrics.heatFluxPeak} W/m2`, 55, 279)
    doc.text('Threshold: 85C', 55, 282)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Equivalent Stress', 220, 239)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (metrics.equivalentStress > 250) {
      doc.setTextColor(255, 107, 53)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${metrics.equivalentStress.toFixed(1)} MPa`, 220, 262)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text(`Load Factor: ${Math.round(powerScale.loadFactor * 100)}%`, 220, 279)
    doc.text('Threshold: 250MPa', 220, 282)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('EMI Margin', 385, 239)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (metrics.emiMargin < 6) {
      doc.setTextColor(255, 107, 53)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${metrics.emiMargin.toFixed(1)} dB`, 385, 262)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text(`Freq Band: ${bandScale.freqGHz} GHz`, 385, 279)
    doc.text('Threshold: 6dB', 385, 282)

    let yCursor = 310

    const sections: { title: string; chartRef: React.RefObject<ReactECharts>; label: string }[] = [
      { title: 'Temperature Cloud Map', chartRef: tempChartRef, label: '温度云图' },
      { title: 'Displacement Field', chartRef: dispChartRef, label: '位移场' },
      { title: 'Signal Jitter Pulse', chartRef: jitterChartRef, label: '信号抖动脉冲图' },
      { title: 'Thermo-Mechano-Electrical Aging Curves', chartRef: agingChartRef, label: '热-力-电老化曲线' },
    ]

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      if (yCursor > pageHeight - 220) {
        doc.addPage()
        doc.setFillColor(10, 14, 26)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
        yCursor = 50
      }
      doc.setTextColor(0, 212, 255)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${sec.title} (${sec.label})`, 40, yCursor)
      yCursor += 12

      const dataUrl = captureChart(sec.chartRef)
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', 40, yCursor, pageWidth - 80, 160)
        } catch { /* noop */ }
      } else {
        doc.setFillColor(21, 27, 54)
        doc.roundedRect(40, yCursor, pageWidth - 80, 160, 4, 4, 'F')
        doc.setTextColor(107, 115, 148)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`${sec.label} visualization`, 60, yCursor + 80)
      }
      yCursor += 175
    }

    doc.addPage()
    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    yCursor = 50

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('5. EMI Crosstalk Matrix Summary (电磁串扰矩阵摘要)', 40, yCursor)
    yCursor += 18

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const cellW = 58
    const cellH = 16
    SUBSYSTEMS.forEach((sub, idx) => {
      doc.text(sub.substring(0, 4), 40 + (idx + 1) * cellW, yCursor - 4)
      doc.text(sub.substring(0, 4), 40, yCursor + idx * cellH + cellH / 2)
    })
    yCursor += 6

    SUBSYSTEMS.forEach((_, y) => {
      SUBSYSTEMS.forEach((_, x) => {
        const val = crosstalkData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0
        if (x === y) {
          doc.setFillColor(0, 212, 255, 0.2)
        } else if (val > 0.3) {
          doc.setFillColor(255, 45, 85, 0.25)
        } else if (val > 0.15) {
          doc.setFillColor(255, 107, 53, 0.2)
        } else {
          doc.setFillColor(21, 27, 54)
        }
        doc.roundedRect(40 + (x + 1) * cellW, yCursor + y * cellH, cellW - 2, cellH - 2, 2, 2, 'F')
        doc.setTextColor(232, 237, 245)
        doc.setFontSize(9)
        doc.text(val.toFixed(2), 40 + (x + 1) * cellW + 8, yCursor + y * cellH + cellH / 2 + 3)
      })
    })

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Progress: ${task.progress}% | Status: ${task.status}`, 40, pageHeight - 40)
    doc.setTextColor(107, 115, 148)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Deep Space Multi-Physics Simulation Platform - Generated automatically', 40, pageHeight - 25)

    const filename = `${sanitizeFilename(task.modelName)}_${sanitizeFilename(task.name)}_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(filename)
  }

  function handleExportData() {
    if (!task || !metrics || exporting) return
    setExporting(true)
    try {
      const thermalMetrics = {
        junctionTemp: metrics.junctionTemp,
        equivalentStress: metrics.equivalentStress,
        emiMargin: metrics.emiMargin,
        peakHeatFlux_Wm2: metrics.heatFluxPeak,
        solarCellDegradation_pct: metrics.solarCellDegradation,
        loadFactor_pct: Math.round(powerScale.loadFactor * 100),
        progress: task.progress,
        status: task.status,
      }

      const crosstalkMatrix: Record<string, Record<string, number>> = {}
      SUBSYSTEMS.forEach((row) => { crosstalkMatrix[row] = {} })
      crosstalkData.forEach(([x, y, v]) => {
        crosstalkMatrix[SUBSYSTEMS[y]][SUBSYSTEMS[x]] = v
      })

      const payload = {
        taskId: task.id,
        taskName: task.name,
        modelName: task.modelName,
        exportedAt: new Date().toISOString(),
        filters: {
          orbitPhase: {
            key: orbitPhase,
            description: orbitScale.label,
            thermalScale: orbitScale.thermal,
            displacementScale: orbitScale.displacement,
            emiScale: orbitScale.emi,
          },
          commBand: {
            key: commBand,
            description: bandScale.label,
            frequencyGHz: bandScale.freqGHz,
            crosstalkScale: bandScale.crosstalk,
            emiMarginScale: bandScale.emiMargin,
          },
          powerLevel: {
            key: powerLevel,
            description: powerScale.label,
            loadFactor: powerScale.loadFactor,
            thermalScale: powerScale.thermal,
            displacementScale: powerScale.displacement,
          },
        },
        scalingInfo: {
          orbit: orbitScale,
          band: bandScale,
          power: powerScale,
        },
        thermalStructuralMetrics: thermalMetrics,
        crosstalkMatrix,
        temperatureGrid: Object.fromEntries(
          Array.from({ length: 10 }, (_, y) => [
            `row_${y}`,
            Object.fromEntries(
              Array.from({ length: 10 }, (_, x) => [
                `col_${x}`,
                tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0,
              ])
            ),
          ])
        ),
      }

      const baseName = `${sanitizeFilename(task.modelName)}_${sanitizeFilename(task.name)}_${sanitizeFilename(orbitPhase)}_${sanitizeFilename(commBand)}_${sanitizeFilename(powerLevel)}`

      if (exportFmt === 'JSON') {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else if (exportFmt === 'CSV') {
        const lines: string[] = []
        lines.push('# Deep Space Simulation Export - 筛选条件已生效')
        lines.push(`Task ID,${task.id}`)
        lines.push(`Task Name,${task.name}`)
        lines.push(`Model,${task.modelName}`)
        lines.push(`Filters,Orbit=${orbitPhase} (${orbitScale.label}) | Band=${commBand} (${bandScale.label}) | Power=${powerLevel} (${powerScale.label})`)
        lines.push(`Exported At,${new Date().toISOString()}`)
        lines.push('')
        lines.push('# Scaling Factors (筛选系数)')
        lines.push('Dimension,Orbit,Comm,Power,Combined')
        lines.push(`Thermal,${orbitScale.thermal.toFixed(2)},- ,${powerScale.thermal.toFixed(2)},${(orbitScale.thermal * powerScale.thermal).toFixed(2)}`)
        lines.push(`Displacement,${orbitScale.displacement.toFixed(2)},- ,${powerScale.displacement.toFixed(2)},${(orbitScale.displacement * powerScale.displacement).toFixed(2)}`)
        lines.push(`EMI Crosstalk,- ,${bandScale.crosstalk.toFixed(2)},- ,${bandScale.crosstalk.toFixed(2)}`)
        lines.push(`EMI Margin,- ,${bandScale.emiMargin.toFixed(2)},${(1/powerScale.emi).toFixed(2)},${(bandScale.emiMargin/powerScale.emi).toFixed(2)}`)
        lines.push(`Aging,${orbitScale.aging.toFixed(2)},- ,${powerScale.aging.toFixed(2)},${(orbitScale.aging * powerScale.aging).toFixed(2)}`)
        lines.push('')
        lines.push('# Thermal & Structural Metrics (after filter scaling)')
        lines.push('JunctionTemp(C),EquivalentStress(MPa),EMIMargin(dB),PeakHeatFlux(W/m2),SolarDegrad(%),LoadFactor(%),Progress(%),Status')
        lines.push(`${metrics.junctionTemp},${metrics.equivalentStress},${metrics.emiMargin},${metrics.heatFluxPeak},${metrics.solarCellDegradation},${Math.round(powerScale.loadFactor * 100)},${task.progress},${task.status}`)
        lines.push('')
        lines.push('# EMI Crosstalk Matrix (rows x columns) - filtered by Band')
        lines.push(`Source/Target,${SUBSYSTEMS.join(',')}`)
        SUBSYSTEMS.forEach((row) => {
          const vals = SUBSYSTEMS.map((col) => crosstalkMatrix[row][col].toFixed(3))
          lines.push(`${row},${vals.join(',')}`)
        })
        lines.push('')
        lines.push(`# Temperature Grid (10x10, C) - OrbitThermal=${orbitScale.thermal.toFixed(2)} PowerThermal=${powerScale.thermal.toFixed(2)}`)
        for (let y = 0; y < 10; y++) {
          const row = Array.from({ length: 10 }, (_, x) => (tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0).toFixed(1))
          lines.push(row.join(','))
        }

        const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else if (exportFmt === 'MATLAB') {
        const lines: string[] = []
        lines.push('% Deep Space Simulation MATLAB Export')
        lines.push(`% ${task.name} - ${task.modelName}`)
        lines.push(`% Filters: Orbit=${orbitPhase} (${orbitScale.label}) / Band=${commBand} (${bandScale.label}) / Power=${powerLevel} (${powerScale.label})`)
        lines.push('')
        lines.push('% Scaling factors')
        lines.push(`orbit_scale.thermal=${orbitScale.thermal}; orbit_scale.displacement=${orbitScale.displacement}; orbit_scale.emi=${orbitScale.emi}; orbit_scale.aging=${orbitScale.aging};`)
        lines.push(`band_scale.crosstalk=${bandScale.crosstalk}; band_scale.emi_margin=${bandScale.emiMargin}; band_scale.jitter=${bandScale.jitter}; band_scale.freq_GHz='${bandScale.freqGHz}';`)
        lines.push(`power_scale.thermal=${powerScale.thermal}; power_scale.displacement=${powerScale.displacement}; power_scale.emi=${powerScale.emi}; power_scale.load_factor=${powerScale.loadFactor};`)
        lines.push('')
        lines.push(`metrics.junctionTemp=${metrics.junctionTemp};`)
        lines.push(`metrics.equivalentStress=${metrics.equivalentStress};`)
        lines.push(`metrics.emiMargin=${metrics.emiMargin};`)
        lines.push(`metrics.peakHeatFlux=${metrics.heatFluxPeak};`)
        lines.push(`metrics.solarDegradation=${metrics.solarCellDegradation};`)
        lines.push(`metrics.progress=${task.progress};`)
        lines.push('')
        lines.push(`subsystems=${JSON.stringify(SUBSYSTEMS)};`)
        const matStr = '[' + SUBSYSTEMS.map((row) => SUBSYSTEMS.map((col) => crosstalkMatrix[row][col].toFixed(3)).join(' ')).join('; ') + ']'
        lines.push(`crosstalk_matrix=${matStr};`)
        lines.push('')
        lines.push('% Temperature grid (10x10)')
        const tempStr = '[' + Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0).toFixed(1)).join(' ')).join('; ') + ']'
        lines.push(`temperature_grid=${tempStr};`)

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.m`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setTimeout(() => setExporting(false), 600)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in h-full overflow-y-auto pb-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-cyber-blue" />
        <h1 className="section-title">报告中心</h1>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyber-dim" />
            <span className="text-sm text-cyber-dim">选择任务</span>
          </div>
          <div className="relative">
            <select
              value={selectedTask}
              onChange={(e) => { setSelectedTask(e.target.value); setGenerated(false); setProgress(0) }}
              className="bg-deep-600 border border-deep-500 rounded px-3 py-1.5 text-sm text-cyber-white appearance-none pr-8 focus:outline-none focus:border-cyber-blue"
            >
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-cyber-dim absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {task && metrics && (
            <div className="flex items-center gap-3 text-xs text-cyber-dim ml-auto">
              <span>结温 <span className="text-cyber-white font-orbitron">{metrics.junctionTemp}°C</span> <span className="text-[10px] opacity-70">(x{(orbitScale.thermal * powerScale.thermal).toFixed(2)})</span></span>
              <span>应力 <span className="text-cyber-white font-orbitron">{metrics.equivalentStress}MPa</span> <span className="text-[10px] opacity-70">(x{(orbitScale.displacement * powerScale.displacement).toFixed(2)})</span></span>
              <span>EMI <span className="text-cyber-white font-orbitron">{metrics.emiMargin}dB</span> <span className="text-[10px] opacity-70">(x{(bandScale.emiMargin / powerScale.emi).toFixed(2)})</span></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-4 text-[11px] flex-wrap">
          <span className="px-2 py-1 rounded bg-deep-700/60 text-cyber-dim">📡 {bandScale.label}</span>
          <span className="px-2 py-1 rounded bg-deep-700/60 text-cyber-dim">🛰️ {orbitScale.label}</span>
          <span className="px-2 py-1 rounded bg-deep-700/60 text-cyber-dim">⚡ {powerScale.label}</span>
          <span className="text-cyber-dim">串扰系数: <span className="text-cyber-blue">x{bandScale.crosstalk.toFixed(2)}</span></span>
          <span className="text-cyber-dim">热流系数: <span className="text-cyber-purple">x{(orbitScale.thermal * powerScale.thermal).toFixed(2)}</span></span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-sm text-cyber-dim mb-2">温度云图</h3>
            <ReactECharts ref={tempChartRef} option={tempOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="text-sm text-cyber-dim mb-2">位移场</h3>
            <ReactECharts ref={dispChartRef} option={dispOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="text-sm text-cyber-dim mb-2">信号抖动脉冲图</h3>
            <ReactECharts ref={jitterChartRef} option={jitterOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h3 className="text-sm text-cyber-dim mb-2">循环热-力-电加速老化曲线</h3>
            <ReactECharts ref={agingChartRef} option={agingOption} style={{ height: 200 }} />
          </motion.div>
        </div>

        <div className="flex items-center gap-4">
          {!generating && !generated && (
            <button className="cyber-btn-primary" onClick={handleGenerate}>生成报告PDF</button>
          )}
          {generating && (
            <div className="flex-1 max-w-xs">
              <div className="h-2 bg-deep-600 rounded-full overflow-hidden">
                <motion.div className="h-full bg-cyber-blue rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} />
              </div>
              <span className="text-xs text-cyber-dim mt-1 block">生成中 {progress}%</span>
            </div>
          )}
          {generated && (
            <>
              <button className="cyber-btn-primary flex items-center gap-2" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4" />下载PDF
              </button>
              <button className="cyber-btn" onClick={() => { setGenerated(false); setProgress(0) }}>重新生成</button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="section-title mb-4">数据导出</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <span className="text-xs text-cyber-dim block mb-2">轨道阶段</span>
              <div className="flex gap-3 flex-wrap">
                {(['近地阶段', '转移阶段', '近星阶段', '远星阶段', '全阶段'] as OrbitPhase[]).map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="orbit" checked={orbitPhase === v} onChange={() => setOrbitPhase(v)} className="accent-[#00D4FF]" />
                    <span className={orbitPhase === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-cyber-dim block mb-2">通信频段</span>
              <div className="flex gap-3 flex-wrap">
                {(['S频段', 'X频段', 'Ka频段', '全频段'] as CommBand[]).map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="band" checked={commBand === v} onChange={() => setCommBand(v)} className="accent-[#00D4FF]" />
                    <span className={commBand === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-cyber-dim block mb-2">仪器功率</span>
              <div className="flex gap-3 flex-wrap">
                {(['低功率', '额定功率', '满功率', '全功率'] as PowerLevel[]).map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="power" checked={powerLevel === v} onChange={() => setPowerLevel(v)} className="accent-[#00D4FF]" />
                    <span className={powerLevel === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-cyber-dim block mb-2">导出格式</span>
              <div className="flex gap-3">
                {['CSV', 'JSON', 'MATLAB'].map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="format" checked={exportFmt === v} onChange={() => setExportFmt(v)} className="accent-[#00D4FF]" />
                    <span className={exportFmt === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="cyber-btn-primary flex items-center gap-2" onClick={handleExportData} disabled={exporting}>
              <Download className="w-4 h-4" />
              {exporting ? '导出中...' : '导出数据'}
            </button>
          </div>
          <div>
            <span className="text-xs text-cyber-dim block mb-2">电磁串扰矩阵预览</span>
            <ReactECharts option={crosstalkOption} style={{ height: 300 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
