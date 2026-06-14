import { useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { FileText, Download, Filter, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import jsPDF from 'jspdf'

const SUBSYSTEMS = ['电源', '通信', '热控', '姿控', '推进', '测控', '数管', '有效载荷']

function genHeatmap10x10(seed: string) {
  const data: number[][] = []
  let s = 0
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i)
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const v = (Math.sin(s + x * 1.3 + y * 0.7) * 0.5 + 0.5) * 80 + 20
    data.push([x, y, +v.toFixed(1)])
  }
  return data
}

function genDisplacementField(seed: string) {
  const data: number[][] = []
  let s = 0
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i)
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const v = (Math.sin(s * 0.5 + x + y * 0.3) * 0.5 + 0.5) * 0.5
    data.push([x, y, +v.toFixed(3)])
  }
  return data
}

function genJitterSignal(seed: string) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i)
  const base = Array.from({ length: 100 }, (_, i) => Math.sin(i / 5 + s) * 50)
  return base.map((v) => +(v + (Math.random() - 0.5) * 30).toFixed(2))
}

function genAgingCurves(seed: string) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i)
  const cycles = Array.from({ length: 50 }, (_, i) => i + 1)
  const thermal = cycles.map((c) => +(100 - c * 0.8 + Math.sin(s + c * 0.3) * 3).toFixed(1))
  const mechanical = cycles.map((c) => +(90 - c * 0.6 + Math.cos(s + c * 0.2) * 2.5).toFixed(1))
  const electrical = cycles.map((c) => +(95 - c * 0.9 + Math.sin(s * 1.2 + c * 0.25) * 3.5).toFixed(1))
  return { cycles, thermal, mechanical, electrical }
}

function genCrosstalkMatrix(seed: string) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i)
  const data: number[][] = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = x === y ? 1 : +((Math.abs(Math.sin(s + x + y * 1.1)) * 0.5).toFixed(3))
    data.push([x, y, v])
  }
  return data
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
  const [orbitPhase, setOrbitPhase] = useState('全阶段')
  const [commBand, setCommBand] = useState('全频段')
  const [powerLevel, setPowerLevel] = useState('全功率')
  const [exportFmt, setExportFmt] = useState('CSV')
  const [exporting, setExporting] = useState(false)
  const tempChartRef = useRef<ReactECharts>(null)
  const dispChartRef = useRef<ReactECharts>(null)
  const jitterChartRef = useRef<ReactECharts>(null)
  const agingChartRef = useRef<ReactECharts>(null)

  const task = tasks.find((t) => t.id === selectedTask)
  const seedKey = selectedTask + '-' + orbitPhase

  const tempData = useMemo(() => genHeatmap10x10(seedKey), [seedKey])
  const dispData = useMemo(() => genDisplacementField(seedKey), [seedKey])
  const jitterData = useMemo(() => genJitterSignal(seedKey), [seedKey])
  const agingData = useMemo(() => genAgingCurves(seedKey), [seedKey])
  const crosstalkData = useMemo(() => genCrosstalkMatrix(seedKey), [seedKey])

  const tempOption = {
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 20, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF6B35', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: tempData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }

  const dispOption = {
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 0, max: 0.5, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#151B36', '#7B61FF', '#00E5A0'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: dispData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }

  const jitterOption = {
    tooltip: { trigger: 'axis' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 100 }, (_, i) => i), axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value', axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{ type: 'line', data: jitterData, showSymbol: false, lineStyle: { color: '#00D4FF', width: 1 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.3)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } } }],
  }

  const agingOption = {
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
  }

  const crosstalkOption = {
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    yAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    visualMap: { min: 0, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: crosstalkData, label: { show: true, color: '#E8EDF5', fontSize: 9 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }

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
    if (!task) return
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
    doc.text(`Orbit Phase: ${orbitPhase} | Comm Band: ${commBand} | Power: ${powerLevel}`, 40, 143)

    doc.setDrawColor(0, 212, 255, 0.4)
    doc.line(40, 155, pageWidth - 40, 155)

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Simulation Metrics', 40, 175)

    doc.setFillColor(21, 27, 54)
    doc.roundedRect(40, 185, 155, 60, 4, 4, 'F')
    doc.setFillColor(21, 27, 54)
    doc.roundedRect(205, 185, 155, 60, 4, 4, 'F')
    doc.roundedRect(370, 185, 155, 60, 4, 4, 'F')

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.text('Junction Temp', 55, 205)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (task.junctionTemp > 85) {
      doc.setTextColor(255, 45, 85)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${task.junctionTemp.toFixed(1)} C`, 55, 228)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text('Threshold: 85C', 55, 238)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Equivalent Stress', 220, 205)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (task.equivalentStress > 250) {
      doc.setTextColor(255, 107, 53)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${task.equivalentStress.toFixed(1)} MPa`, 220, 228)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text('Threshold: 250MPa', 220, 238)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('EMI Margin', 385, 205)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (task.emiMargin < 6) {
      doc.setTextColor(255, 107, 53)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${task.emiMargin.toFixed(1)} dB`, 385, 228)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text('Threshold: 6dB', 385, 238)

    let yCursor = 270

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
    if (!task || exporting) return
    setExporting(true)
    try {
      const thermalMetrics = {
        junctionTemp: task.junctionTemp,
        equivalentStress: task.equivalentStress,
        emiMargin: task.emiMargin,
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
        filters: { orbitPhase, commBand, powerLevel },
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
        lines.push('# Deep Space Simulation Export')
        lines.push(`Task ID,${task.id}`)
        lines.push(`Task Name,${task.name}`)
        lines.push(`Model,${task.modelName}`)
        lines.push(`Filters,${orbitPhase}/${commBand}/${powerLevel}`)
        lines.push(`Exported At,${new Date().toISOString()}`)
        lines.push('')
        lines.push('# Thermal & Structural Metrics')
        lines.push('JunctionTemp(C),EquivalentStress(MPa),EMIMargin(dB),Progress(%),Status')
        lines.push(`${task.junctionTemp},${task.equivalentStress},${task.emiMargin},${task.progress},${task.status}`)
        lines.push('')
        lines.push('# EMI Crosstalk Matrix (rows x columns)')
        lines.push(`Source/Target,${SUBSYSTEMS.join(',')}`)
        SUBSYSTEMS.forEach((row) => {
          const vals = SUBSYSTEMS.map((col) => crosstalkMatrix[row][col].toFixed(3))
          lines.push(`${row},${vals.join(',')}`)
        })
        lines.push('')
        lines.push('# Temperature Grid (10x10, C)')
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
        lines.push(`% Filters: ${orbitPhase} / ${commBand} / ${powerLevel}`)
        lines.push('')
        lines.push(`metrics.junctionTemp = ${task.junctionTemp};`)
        lines.push(`metrics.equivalentStress = ${task.equivalentStress};`)
        lines.push(`metrics.emiMargin = ${task.emiMargin};`)
        lines.push(`metrics.progress = ${task.progress};`)
        lines.push('')
        lines.push(`subsystems = ${JSON.stringify(SUBSYSTEMS)};`)
        const matStr = '[' + SUBSYSTEMS.map((row) => SUBSYSTEMS.map((col) => crosstalkMatrix[row][col].toFixed(3)).join(' ')).join('; ') + ']'
        lines.push(`crosstalk_matrix = ${matStr};`)
        lines.push('')
        lines.push('% Temperature grid (10x10)')
        const tempStr = '[' + Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0).toFixed(1)).join(' ')).join('; ') + ']'
        lines.push(`temperature_grid = ${tempStr};`)

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
          {task && (
            <div className="flex items-center gap-3 text-xs text-cyber-dim ml-auto">
              <span>结温 <span className="text-cyber-white font-orbitron">{task.junctionTemp}°C</span></span>
              <span>应力 <span className="text-cyber-white font-orbitron">{task.equivalentStress}MPa</span></span>
              <span>EMI <span className="text-cyber-white font-orbitron">{task.emiMargin}dB</span></span>
            </div>
          )}
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
              <div className="flex gap-3">
                {['日食', '日照', '全阶段'].map((v) => (
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
                {['S频段', 'X频段', 'Ka频段', '全频段'].map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="band" checked={commBand === v} onChange={() => setCommBand(v)} className="accent-[#00D4FF]" />
                    <span className={commBand === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-cyber-dim block mb-2">仪器功率</span>
              <div className="flex gap-3">
                {['低功率', '额定功率', '全功率'].map((v) => (
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
