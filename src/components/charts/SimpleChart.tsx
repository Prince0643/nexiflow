// import { ChartData } from '../../types'

interface SimpleChartProps {
  data: {
    labels: string[]
    datasets: {
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string | string[]
    }[]
  }
  type: 'bar' | 'line' | 'doughnut'
  title?: string
  height?: number
}

export default function SimpleChart({ data, type, title, height = 300 }: SimpleChartProps) {
  // Always render the chart container, even when there's no data
  // This ensures the chart area is visible for PDF export
  
  const validData = data.datasets.flatMap(dataset => dataset.data).filter(value => !isNaN(value) && isFinite(value));
  const hasValidData = validData.length > 0;
  
  const maxValue = hasValidData ? Math.max(...validData) : 0;
  const minValue = hasValidData ? Math.min(...validData) : 0;
  const range = hasValidData ? (maxValue - minValue || 1) : 1;

  const renderBarChart = () => {
    const validData = data.datasets[0].data.filter(v => !isNaN(v) && isFinite(v))
    const maxValue = validData.length > 0 ? Math.max(...validData) : 1
    const chartHeight = 300
    
    // Ensure minimum height for visibility - use a more reasonable minimum
    const adjustedMaxValue = Math.max(maxValue, 1) // At least 1 hour for better scaling
    
    // Generate Y-axis labels that match the actual data range
    const yAxisLabels = []
    const numLabels = 5
    for (let i = 0; i <= numLabels; i++) {
      const value = (adjustedMaxValue * i) / numLabels
      yAxisLabels.push(value)
    }
    
    // Use the actual max value for scaling (no buffer needed)
    const displayMaxValue = adjustedMaxValue
    
    return (
      <div className="relative w-full">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -ml-12 w-10">
          {yAxisLabels.map((value, i) => (
            <span key={i} className="text-right">
              {(() => {
                const totalSeconds = Math.round(value * 3600)
                const h = Math.floor(totalSeconds / 3600)
                const m = Math.floor((totalSeconds % 3600) / 60)
                const s = totalSeconds % 60
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
              })()}
            </span>
          ))}
        </div>
        
        {/* Chart area */}
        <div className="ml-12 mr-2">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {yAxisLabels.map((_, i) => (
              <div key={i} className="border-t border-gray-200 dark:border-gray-600"></div>
            ))}
          </div>
          
          {/* Bars container with better spacing */}
          <div className="relative flex items-end justify-between px-1 gap-1" style={{ height: `${height - 50}px` }}>
            {data.labels.length > 0 ? (
              data.labels.map((label, index) => {
                const value = data.datasets[0].data[index]
                const isValidValue = !isNaN(value) && isFinite(value)
                
                // Calculate bar height as percentage of the display range
                const barHeightPercentage = isValidValue && hasValidData ? (value / displayMaxValue) * 100 : 0
                const barHeight = `${Math.max(barHeightPercentage, 0)}%`
                const hours = isValidValue ? value : 0
                
                // Debug logging (remove in production)
                if (isValidValue && value > 0) {
                  console.log(`Bar ${index} (${label}): value=${value.toFixed(2)}h, displayMax=${displayMaxValue.toFixed(2)}h, height=${barHeightPercentage.toFixed(1)}%, barHeight=${barHeight}, containerHeight=256px`)
                }
                
                return (
                  <div key={index} className="flex flex-col items-center flex-1 min-w-0 h-full">
                    {/* Value above bar */}
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 text-center whitespace-nowrap">
                      {isValidValue && hasValidData && hours > 0 ? (() => {
                        const totalSeconds = Math.round(hours * 3600)
                        const h = Math.floor(totalSeconds / 3600)
                        const m = Math.floor((totalSeconds % 3600) / 60)
                        const s = totalSeconds % 60
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                      })() : ''}
                    </div>
                    
                    {/* Bar container - positioned at bottom */}
                    <div className="flex-1 flex items-end w-full">
                      <div
                        className="w-full rounded-t transition-all duration-500"
                        style={{
                          height: barHeight,
                          backgroundColor: Array.isArray(data.datasets[0].backgroundColor)
                            ? data.datasets[0].backgroundColor[index]
                            : data.datasets[0].backgroundColor || '#3B82F6',
                          minHeight: isValidValue && barHeightPercentage > 0 ? '8px' : '0px',
                          width: '100%'
                        }}
                      />
                    </div>
                    
                    {/* Day label */}
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center whitespace-nowrap">
                      {label}
                    </div>
                  </div>
                )
              })
            ) : (
              // Show "No Data" message when there are no labels
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="text-lg font-medium">No Data Available</div>
                  <div className="text-sm">No clients with time data in selected period</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderLineChart = () => {
    // Filter out invalid data points and ensure we have valid coordinates
    const validPoints = data.labels.map((_, index) => {
      const x = (index / Math.max(data.labels.length - 1, 1)) * 100
      const value = data.datasets[0].data[index]
      const isValidValue = !isNaN(value) && isFinite(value) && value >= 0
      const y = isValidValue ? 100 - (((value - minValue) / range) * 100) : 100
      return { x, y, isValid: isValidValue, value }
    }).filter(point => point.isValid)

    const points = validPoints.map(point => `${point.x},${point.y}`).join(' ')

    // Always render the chart area
    return (
      <div className="relative">
        <svg width="100%" height={height} className="overflow-visible">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y, i) => (
            <line
              key={i}
              x1="0"
              y1={`${y}%`}
              x2="100%"
              y2={`${y}%`}
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-600"
              strokeWidth="1"
            />
          ))}
          
          {/* Area under curve - only if we have valid points */}
          {validPoints.length > 0 && (
            <polygon
              points={`0,100 ${points} 100,100`}
              fill="url(#gradient)"
            />
          )}
          
          {/* Line - only if we have valid points */}
          {validPoints.length > 0 && (
            <polyline
              points={points}
              fill="none"
              stroke={Array.isArray(data.datasets[0].borderColor) ? data.datasets[0].borderColor[0] : data.datasets[0].borderColor || '#3B82F6'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          
          {/* Data points - only valid ones */}
          {validPoints.map((point, index) => (
            <circle
              key={index}
              cx={`${point.x}%`}
              cy={`${point.y}%`}
              r="4"
              fill={Array.isArray(data.datasets[0].borderColor) ? data.datasets[0].borderColor[0] : data.datasets[0].borderColor || '#3B82F6'}
              className="hover:r-6 transition-all"
            />
          ))}
          
          {/* Show "No Data" message when there are no valid points */}
          {validPoints.length === 0 && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-gray-500 dark:text-gray-400"
              fontSize="14"
              fill="currentColor"
            >
              No Valid Data
            </text>
          )}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -ml-8">
          <span>{(() => {
            const totalSeconds = Math.round(maxValue * 3600)
            const h = Math.floor(totalSeconds / 3600)
            const m = Math.floor((totalSeconds % 3600) / 60)
            const s = totalSeconds % 60
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          })()}</span>
          <span>{(() => {
            const midValue = (maxValue + minValue) / 2
            const totalSeconds = Math.round(midValue * 3600)
            const h = Math.floor(totalSeconds / 3600)
            const m = Math.floor((totalSeconds % 3600) / 60)
            const s = totalSeconds % 60
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          })()}</span>
          <span>{(() => {
            const totalSeconds = Math.round(minValue * 3600)
            const h = Math.floor(totalSeconds / 3600)
            const m = Math.floor((totalSeconds % 3600) / 60)
            const s = totalSeconds % 60
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          })()}</span>
        </div>
      </div>
    )
  }

  const renderDoughnutChart = () => {
    // Filter out invalid data and ensure we have valid values
    const validData = data.datasets[0].data.filter(value => !isNaN(value) && isFinite(value) && value >= 0)
    const validLabels = data.labels.filter((_, index) => {
      const value = data.datasets[0].data[index]
      return !isNaN(value) && isFinite(value) && value >= 0
    })
    
    // Always render the chart area
    const total = validData.length > 0 ? validData.reduce((sum, value) => sum + value, 0) : 0
    let cumulativePercentage = 0

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <svg width="200" height="200" className="transform -rotate-90">
          {validLabels.length > 0 ? (
            validLabels.map((_, index) => {
              const value = validData[index]
              const percentage = total > 0 ? (value / total) * 100 : 0
              const startAngle = (cumulativePercentage / 100) * 360
              const endAngle = ((cumulativePercentage + percentage) / 100) * 360
              
              const radius = 80
              const centerX = 100
              const centerY = 100
              
              const startAngleRad = (startAngle * Math.PI) / 180
              const endAngleRad = (endAngle * Math.PI) / 180
              
              const x1 = centerX + radius * Math.cos(startAngleRad)
              const y1 = centerY + radius * Math.sin(startAngleRad)
              const x2 = centerX + radius * Math.cos(endAngleRad)
              const y2 = centerY + radius * Math.sin(endAngleRad)
              
              const largeArcFlag = percentage > 50 ? 1 : 0
              
              const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
              ].join(' ')
              
              cumulativePercentage += percentage
              
              return (
                <path
                  key={index}
                  d={pathData}
                  fill={Array.isArray(data.datasets[0].backgroundColor)
                    ? data.datasets[0].backgroundColor[index]
                    : data.datasets[0].backgroundColor || '#3B82F6'
                  }
                  className="hover:opacity-80 transition-opacity"
                />
              )
            })
          ) : (
            // Show "No Data" message when there are no valid labels
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-gray-500 dark:text-gray-400"
              fontSize="14"
              fill="currentColor"
            >
              No Valid Data
            </text>
          )}
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(() => {
              const totalSeconds = Math.round(total * 3600)
              const h = Math.floor(totalSeconds / 3600)
              const m = Math.floor((totalSeconds % 3600) / 60)
              const s = totalSeconds % 60
              return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            })()}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
          </div>
        </div>
      </div>
    )
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return renderBarChart()
      case 'line':
        return renderLineChart()
      case 'doughnut':
        return renderDoughnutChart()
      default:
        return renderBarChart()
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      )}
      <div style={{ height: `${height}px` }}>
        {renderChart()}
      </div>
      
      {/* Legend for multi-dataset charts */}
      {data.datasets.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-4">
          {data.datasets.map((dataset, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: Array.isArray(dataset.borderColor) ? dataset.borderColor[0] : dataset.borderColor || (Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[0] : dataset.backgroundColor) }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">{dataset.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
