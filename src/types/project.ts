export interface ProjectTask {
  id: string
  description: string
  estimatedMinutes: number
  aiEstimatedMinutes?: number
  completed: boolean
  completedAt?: Date
  scheduledDate?: Date  // Date planifiée par l'IA pour cette tâche
}

export type ProjectCategory = 'video' | 'work' | 'school'
export type SchoolSubCategory = 'lesson' | 'homework'

export interface Project {
  id: string
  category: ProjectCategory

  // Sous-catégorie pour école uniquement
  schoolSubCategory?: SchoolSubCategory

  title: string
  description: string
  deadline: Date

  // Tâches à réaliser
  tasks: ProjectTask[]

  // Informations de timing
  userEstimatedHours: number
  aiEstimatedHours?: number

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
  totalEstimated: number
  totalCompleted: number
  remainingTime: number
  hoursUntilDeadline: number
  isOnTrack: boolean
  recommendedDailyHours: number
}

// Événements personnels (blocages dans le calendrier)
export interface PersonalEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}
