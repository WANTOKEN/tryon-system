import React from 'react'

import ReactDOM from 'react-dom/client'

import App from './App'

// CSS 模块化加载顺序：tokens → themes → Tailwind → layout → components → animations
import './styles/tokens.css'
import './styles/themes.css'
import './index.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/animations.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
