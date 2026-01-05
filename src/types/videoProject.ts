export interface VideoTask {
  id: string
  description: string
  estimatedMinutes: number // Estimation utilisateur
  aiEstimatedMinutes?: number // Estimation IA
  completed: boolean
  completedAt?: Date
}

export interface VideoProject {
  id: string
  title: string
  description: string
  deadline: Date

  // Tâches à réaliser
  tasks: VideoTask[]

  // Informations de timing
  userEstimatedHours: number // Estimation totale de l'utilisateur
  aiEstimatedHours?: number // Estimation IA basée sur les tâches

  // Statut
  status: 'planning' | 'in_progress' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high'

  // Notes
  notes?: string

  // Métadonnées
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface TimeAnalysis {
  totalEstimated: number // heures
  totalCompleted: number // heures
  remainingTime: number // heures
  hoursUntilDeadline: number
  isOnTrack: boolean
  recommendedDailyHours: number
}
