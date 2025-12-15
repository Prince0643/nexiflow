import React from 'react'
import ReactDOM from 'react-dom/client'
import MySQLApp from './MySQLApp.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MySQLApp />
  </React.StrictMode>,
)