// src/main.tsx
//
// PURPOSE: Entry point for the admin panel.
// Renders App into the root div.
// CSS import here ensures Tailwind loads globally.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
