import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'

interface Ripple {
  id: string
  x: number
  y: number
  timestamp: number
}

interface CursorTrail {
  id: string
  x: number
  y: number
  timestamp: number
  opacity: number
}

interface AnimatedWaterBackgroundProps {
  children: React.ReactNode
  className?: string
  isDarkMode?: boolean
}

const AnimatedWaterBackground: React.FC<AnimatedWaterBackgroundProps> = ({ 
  children, 
  className = '',
  isDarkMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [cursorTrail, setCursorTrail] = useState<CursorTrail[]>([])
  
  // Performance optimization: Use refs for values that change frequently
  const lastTrailTimeRef = useRef<number>(0)
  const lastTrailPointRef = useRef<{x: number, y: number} | null>(null)

  // Optimized water animation parameters
  const waveSpeed = 0.01 // Reduced speed
  const waveAmplitude = 8 // Reduced amplitude
  const waveFrequency = 0.008 // Reduced frequency
  const rippleDuration = 1500 // Shorter duration
  const maxRipples = 2 // Limit concurrent ripples
  const cursorTrailDuration = 800 // Shorter trail duration
  const maxTrailPoints = 8 // Fewer trail points

  // Memoize gradient colors to avoid recalculation
  const waterColors = useMemo(() => ({
    light: [
      'rgba(224, 242, 254, 0.2)', // sky-100
      'rgba(186, 230, 253, 0.15)', // sky-200
      'rgba(125, 211, 252, 0.1)', // sky-300
      'rgba(56, 189, 248, 0.08)' // sky-400
    ],
    dark: [
      'rgba(15, 23, 42, 0.08)', // very dark blue
      'rgba(30, 41, 59, 0.06)', // slate-800
      'rgba(51, 65, 85, 0.04)', // slate-700
      'rgba(71, 85, 105, 0.03)' // slate-600
    ]
  }), []);

  const waveColors = useMemo(() => ({
    light: [
      'rgba(14, 165, 233, 0.08)', // sky-500
      'rgba(56, 189, 248, 0.05)' // sky-400
    ],
    dark: [
      'rgba(100, 116, 139, 0.05)', // slate-500
      'rgba(148, 163, 184, 0.03)' // slate-400
    ]
  }), []);

  const rippleColors = useMemo(() => ({
    light: '14, 165, 233', // sky-500
    dark: '148, 163, 184' // slate-400
  }), []);

  const trailColors = useMemo(() => ({
    light: '56, 189, 248', // sky-400
    dark: '203, 213, 225' // slate-300
  }), []);

  // Initialize canvas size
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const newSize = {
          width: Math.max(rect.width, window.innerWidth),
          height: Math.max(rect.height, window.innerHeight)
        }
        setCanvasSize(newSize)
      }
    }

    // Initial size
    setTimeout(updateCanvasSize, 100)
    
    let resizeTimeout: NodeJS.Timeout
    const throttledResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateCanvasSize, 200) // Increased throttle delay
    }
    
    window.addEventListener('resize', throttledResize)
    return () => {
      window.removeEventListener('resize', throttledResize)
      clearTimeout(resizeTimeout)
    }
  }, [])

  // Handle mouse movement for hover effects and cursor trail
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      setMousePos({ x, y })
      
      // Throttle cursor trail updates for better performance
      const now = Date.now()
      if (now - lastTrailTimeRef.current > 32) { // ~30fps limit
        lastTrailTimeRef.current = now
        
        // Only add trail point if mouse has moved enough
        if (!lastTrailPointRef.current || 
            Math.abs(x - lastTrailPointRef.current.x) > 10 || 
            Math.abs(y - lastTrailPointRef.current.y) > 10) {
          
          lastTrailPointRef.current = { x, y }
          
          const newTrailPoint: CursorTrail = {
            id: `trail-${now}-${Math.random().toString(36).substr(2, 5)}`,
            x,
            y,
            timestamp: now,
            opacity: 1
          }
          
          setCursorTrail(prev => {
            const filtered = prev.slice(-maxTrailPoints + 1)
            return [...filtered, newTrailPoint]
          })
        }
      }
    }
  }, [maxTrailPoints])

  // Clean up old cursor trail points less frequently
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const currentTime = Date.now()
      setCursorTrail(prev => 
        prev.filter(point => currentTime - point.timestamp < cursorTrailDuration)
      )
    }, 200) // Increased cleanup interval
    
    return () => clearInterval(cleanupInterval)
  }, [cursorTrailDuration])

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    setCursorTrail([])
    lastTrailPointRef.current = null
  }, [])

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const newRipple: Ripple = {
        id: `ripple-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x,
        y,
        timestamp: Date.now()
      }

      setRipples(prev => {
        const filtered = prev.slice(-maxRipples + 1)
        return [...filtered, newRipple]
      })

      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
      }, rippleDuration)
    }
  }, [rippleDuration, maxRipples])

  // Optimized animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height

    let time = 0
    let lastFrameTime = 0
    const targetFPS = 30 // Limit to 30fps for better performance

    const animate = (timestamp: number) => {
      // Throttle frame rate
      if (timestamp - lastFrameTime < 1000 / targetFPS) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = timestamp

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Create water base with memoized colors
      const waterGradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      const colors = isDarkMode ? waterColors.dark : waterColors.light
      
      colors.forEach((color, index) => {
        waterGradient.addColorStop(index / (colors.length - 1), color)
      })
      
      ctx.fillStyle = waterGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Optimized water surface waves
      const colorsWave = isDarkMode ? waveColors.dark : waveColors.light

      colorsWave.forEach((color, layerIndex) => {
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 1 - layerIndex * 0.3
        
        // Reduced detail for better performance
        for (let x = 0; x <= canvas.width; x += 8) { // Increased step size
          const y = canvas.height * (0.4 + layerIndex * 0.1) + 
            Math.sin(x * waveFrequency + time + layerIndex * Math.PI / 3) * waveAmplitude +
            Math.sin(x * waveFrequency * 1.5 + time * 1.1) * (waveAmplitude * 0.3)
          
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      })

      // Draw ripples with simplified calculations
      const currentTime = Date.now()
      ripples.forEach(ripple => {
        const age = currentTime - ripple.timestamp
        const progress = age / rippleDuration
        
        if (progress <= 1) {
          const radius = progress * 80 // Reduced ripple size
          const opacity = (1 - progress) * 0.4 // Reduced opacity
          
          const rippleColor = isDarkMode ? rippleColors.dark : rippleColors.light
          
          // Single ripple ring instead of multiple
          const ringRadius = radius
          if (ringRadius > 0) {
            ctx.beginPath()
            ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${rippleColor}, ${opacity})`
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
          
          // Simplified center splash
          if (progress < 0.3) {
            const splashSize = 4 * (1 - progress * 3)
            ctx.beginPath()
            ctx.arc(ripple.x, ripple.y, splashSize, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${rippleColor}, ${opacity})`
            ctx.fill()
          }
        }
      })
      
      // Draw cursor trail with performance optimizations
      cursorTrail.forEach(point => {
        const age = currentTime - point.timestamp
        const progress = age / cursorTrailDuration
        
        if (progress <= 1) {
          const baseOpacity = (1 - progress) * 0.3
          const size = 1 + (progress * 20) // Reduced expansion
          
          const trailColor = isDarkMode ? trailColors.dark : trailColors.light
          
          ctx.beginPath()
          ctx.arc(point.x, point.y, size, 0, Math.PI * 2)
          
          // Simplified single color fill instead of gradient
          ctx.fillStyle = `rgba(${trailColor}, ${baseOpacity})`
          ctx.fill()
        }
      })

      time += waveSpeed
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [canvasSize, ripples, cursorTrail, waveSpeed, waveAmplitude, waveFrequency, 
      rippleDuration, cursorTrailDuration, isDarkMode, waterColors, waveColors, 
      rippleColors, trailColors])

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ 
        cursor: 'default',
        zIndex: 0,
        position: 'relative'
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />
      
      <div className="relative z-20 pointer-events-auto">
        {children}
      </div>
    </div>
  )
}

export default AnimatedWaterBackground