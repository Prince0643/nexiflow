import { useEffect } from 'react'
import { removeLeadConnectorWidget } from '../utils/leadConnectorWidget'

type UseLeadConnectorWidgetOptions = {
  widgetId: string
  loaderSrc?: string
  resourcesUrl?: string
  removeOnUnmount?: boolean
}

const DEFAULT_LOADER_SRC = 'https://beta.leadconnectorhq.com/loader.js'
const DEFAULT_RESOURCES_URL = 'https://beta.leadconnectorhq.com/chat-widget/loader.js'

export function useLeadConnectorWidget({
  widgetId,
  loaderSrc = DEFAULT_LOADER_SRC,
  resourcesUrl = DEFAULT_RESOURCES_URL,
  removeOnUnmount = false,
}: UseLeadConnectorWidgetOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-widget-id="${CSS.escape(widgetId)}"]`
    )
    if (existing) return

    const script = document.createElement('script')
    script.src = loaderSrc
    script.async = true
    script.dataset.resourcesUrl = resourcesUrl
    script.dataset.widgetId = widgetId

    document.body.appendChild(script)

    return () => {
      if (!removeOnUnmount) return
      removeLeadConnectorWidget(widgetId)
    }
  }, [widgetId, loaderSrc, resourcesUrl, removeOnUnmount])
}
