import React from 'react'
import ReactDOM from 'react-dom/client'
import { FluentProvider } from '@fluentui/react-components'
import { cullnoTheme } from './styles/tokens'
import { App } from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FluentProvider theme={cullnoTheme} style={{ height: '100%' }}>
      <App />
    </FluentProvider>
  </React.StrictMode>
)
