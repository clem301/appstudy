import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// import './services/debugLogger' // DÉSACTIVÉ - créait des fichiers logs non désirés

createRoot(document.getElementById('root')!).render(
  <App />
)
