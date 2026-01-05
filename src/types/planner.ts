export interface PlannerTask {
  id: string
  subject: string
  chapter: string
  type: 'synthesis' | 'exercises' | 'review' | 'flashcards'
  dueDate: Date
  duration: number // minutes
  completed: boolean
  completedAt?: Date
  forWednesday: boolean // Critical flag for weekly check-in
  priority: 'low' | 'medium' | 'high'
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface WeekStats {
  totalTasks: number
  completedTasks: number
  totalHours: number
  subjectBreakdown: Record<string, number> // subject -> hours
}
