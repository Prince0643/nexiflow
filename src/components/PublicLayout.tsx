import type { PropsWithChildren } from 'react'
import { useLeadConnectorWidget } from '../hooks/useLeadConnectorWidget'

export default function PublicLayout({ children }: PropsWithChildren) {
  useLeadConnectorWidget({ widgetId: '69f7ee21cc1c635735173a2b', removeOnUnmount: true })
  return <>{children}</>
}

