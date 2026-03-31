import { useEffect, useRef, useState } from 'react'

type Options = IntersectionObserverInit

export const useRevealOnScroll = (options: Options = { threshold: 0.2 }) => {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(entry.target)
        }
      })
    }, options)

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [options])

  return { ref, visible }
}
