import React from 'react'
import ReactDOM from 'react-dom/client'

import '@/styles/index.css'

import App from '@/app/App'
import { installTauriEasyGithubBridge } from '@/renderer/tauriBridge'

installTauriEasyGithubBridge()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
