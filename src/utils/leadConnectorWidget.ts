const IFRAME_SRC_MATCHERS = ['leadconnectorhq.com', 'chat-widget']

export function removeLeadConnectorWidget(widgetId: string) {
  if (typeof document === 'undefined') return

  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script')).filter((s) => {
    if (s.dataset.widgetId === widgetId) return true
    if (s.src && s.src.includes('leadconnectorhq.com')) return true
    return false
  })
  for (const script of scripts) script.remove()

  const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe')).filter((f) => {
    const src = f.src ?? ''
    return IFRAME_SRC_MATCHERS.some((m) => src.includes(m))
  })

  for (const iframe of iframes) {
    const container = iframe.closest<HTMLElement>(
      '[id*="leadconnector" i],[class*="leadconnector" i],[id*="chat-widget" i],[class*="chat-widget" i],[id*="lc" i],[class*="lc" i]'
    )
    iframe.remove()
    if (container) container.remove()
  }

  const strayContainers = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[id*="leadconnector" i],[class*="leadconnector" i],[id*="chat-widget" i],[class*="chat-widget" i]'
    )
  )

  for (const node of strayContainers) {
    const hasLcChild = !!node.querySelector(
      `iframe[src*="leadconnectorhq.com"],iframe[src*="chat-widget"],script[src*="leadconnectorhq.com"]`
    )
    if (hasLcChild) node.remove()
  }
}

