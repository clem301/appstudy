import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './services/debugLogger' // Activer le logger de debug

createRoot(document.getElementById('root')!).render(
  <App />
)
