/**
 * Logger de debug qui persiste les logs dans localStorage
 * pour les analyser même après un refresh
 */

const MAX_LOGS = 500
const LOGS_KEY = 'appstudy_debug_logs'

interface LogEntry {
  timestamp: number
  time: string
  type: 'log' | 'warn' | 'error'
  message: string
  data?: any
}

class DebugLogger {
  private logs: LogEntry[] = []
  private startTime: number = Date.now()

  constructor() {
    // Charger les logs existants
    this.loadLogs()

    // Intercepter console.log, console.warn, console.error
    this.interceptConsole()

    // Sauvegarder périodiquement
    setInterval(() => this.saveLogs(), 1000)
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(LOGS_KEY)
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch (err) {
      console.error('Erreur chargement logs:', err)
    }
  }

  private saveLogs() {
    try {
      // Garder seulement les MAX_LOGS derniers
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS)
      }
      localStorage.setItem(LOGS_KEY, JSON.stringify(this.logs))
    } catch (err) {
      // Si localStorage est plein, supprimer les anciens logs
      this.logs = this.logs.slice(-MAX_LOGS / 2)
      try {
        localStorage.setItem(LOGS_KEY, JSON.stringify(this.logs))
      } catch (err2) {
        // Ignore
      }
    }
  }

  private addLog(type: 'log' | 'warn' | 'error', args: any[]) {
    const now = Date.now()
    const elapsed = now - this.startTime
    const seconds = (elapsed / 1000).toFixed(3)

    const message = args
      .map(arg => {
        if (typeof arg === 'string') return arg
        if (arg instanceof Error) return arg.message
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(' ')

    this.logs.push({
      timestamp: now,
      time: `+${seconds}s`,
      type,
      message,
      data: args.length > 1 ? args.slice(1) : undefined
    })
  }

  private interceptConsole() {
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    console.log = (...args: any[]) => {
      this.addLog('log', args)
      originalLog.apply(console, args)
    }

    console.warn = (...args: any[]) => {
      this.addLog('warn', args)
      originalWarn.apply(console, args)
    }

    console.error = (...args: any[]) => {
      this.addLog('error', args)
      originalError.apply(console, args)
    }
  }

  public exportLogs(): string {
    return this.logs
      .map(log => `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n')
  }

  public clearLogs() {
    this.logs = []
    this.startTime = Date.now()
    localStorage.removeItem(LOGS_KEY)
  }

  public getLogs(): LogEntry[] {
    return this.logs
  }

  public downloadLogs() {
    const content = this.exportLogs()
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appstudy-debug-${Date.now()}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

// Créer l'instance globale
export const debugLogger = new DebugLogger()

// Exposer les fonctions globalement pour le debug
if (typeof window !== 'undefined') {
  (window as any).exportLogs = () => debugLogger.exportLogs()
  (window as any).downloadLogs = () => debugLogger.downloadLogs()
  (window as any).clearLogs = () => debugLogger.clearLogs()
  (window as any).showLogs = () => {
    console.log('=== LOGS CAPTURÉS ===')
    console.log(debugLogger.exportLogs())
  }

  // Import de resetDatabase désactivé car ça cause des refreshes en boucle
  // Pour utiliser ces fonctions, décommentez temporairement cette ligne:
  // import('./resetDatabase').then(module => {
  //   (window as any).resetDatabase = module.resetDatabase
  //   (window as any).migrateDataToCurrentUser = module.migrateDataToCurrentUser
  //   console.log('🛠️ Fonctions de debug disponibles: resetDatabase(), migrateDataToCurrentUser()')
  // })
}
