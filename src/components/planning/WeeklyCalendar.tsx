import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Project, ProjectTask, PersonalEvent } from '../../types/project'

interface WeeklyCalendarProps {
  projects: Project[]
  personalEvents: PersonalEvent[]
  onTaskClick: (project: Project, task: ProjectTask) => void
  onEventClick?: (event: PersonalEvent) => void
  onDayClick: (date: Date) => void
  startDate?: Date
}

interface DayTask {
  project: Project
  task: ProjectTask
  color: string
}

interface DayEvent {
  event: PersonalEvent
}

interface DayData {
  date: Date
  tasks: DayTask[]
  events: DayEvent[]
  totalMinutes: number
  isToday: boolean
  isPast: boolean
}

export function WeeklyCalendar({
  projects,
  personalEvents,
  onTaskClick,
  onEventClick,
  onDayClick,
  startDate = new Date()
}: WeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const date = new Date(startDate)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Commence le lundi
    return new Date(date.setDate(diff))
  })

  // Générer les 7 jours de la semaine
  const weekDays: DayData[] = []
  const categoryColors: Record<string, string> = {
    video: 'from-purple-500 to-pink-500',
    work: 'from-blue-500 to-cyan-500',
    school: 'from-orange-500 to-yellow-500',
  }

  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart)
    date.setDate(currentWeekStart.getDate() + i)
    date.setHours(0, 0, 0, 0)

    const nextDay = new Date(date)
    nextDay.setDate(date.getDate() + 1)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Collecter les tâches du jour
    const dayTasks: DayTask[] = []
    projects.forEach(project => {
      project.tasks.forEach(task => {
        if (
          task.scheduledDate &&
          task.scheduledDate >= date &&
          task.scheduledDate < nextDay
        ) {
          dayTasks.push({
            project,
            task,
            color: categoryColors[project.category] || 'from-gray-500 to-gray-600'
          })
        }
      })
    })

    // Collecter les événements personnels du jour
    const dayEvents: DayEvent[] = []
    personalEvents.forEach(event => {
      const eventStart = new Date(event.startDate)
      eventStart.setHours(0, 0, 0, 0)
      const eventEnd = new Date(event.endDate)
      eventEnd.setHours(0, 0, 0, 0)

      if (date >= eventStart && date <= eventEnd) {
        dayEvents.push({ event })
      }
    })

    const totalMinutes = dayTasks.reduce((sum, dt) => sum + dt.task.estimatedMinutes, 0)

    weekDays.push({
      date,
      tasks: dayTasks,
      events: dayEvents,
      totalMinutes,
      isToday: date.getTime() === today.getTime(),
      isPast: date < today
    })
  }

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }

  const goToToday = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    setCurrentWeekStart(new Date(today.setDate(diff)))
  }

  const weekEndDate = new Date(currentWeekStart)
  weekEndDate.setDate(currentWeekStart.getDate() + 6)

  const formatDateRange = () => {
    const start = currentWeekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const end = weekEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${start} - ${end}`
  }

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  // Sur mobile, réorganiser les jours : aujourd'hui en premier, puis jours suivants, puis passés
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

  const sortedDays = isMobile
    ? [...weekDays].sort((a, b) => {
        // Aujourd'hui en premier
        if (a.isToday) return -1
        if (b.isToday) return 1

        // Puis jours futurs dans l'ordre
        if (a.date >= today && b.date >= today) {
          return a.date.getTime() - b.date.getTime()
        }

        // Puis jours passés à la fin
        if (a.date < today && b.date >= today) return 1
        if (b.date < today && a.date >= today) return -1

        return a.date.getTime() - b.date.getTime()
      })
    : weekDays

  return (
    <div className="space-y-4">
      {/* Header de navigation - Responsive */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={goToPreviousWeek}
          className="px-2 sm:px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl transition-colors text-sm sm:text-base"
        >
          <span className="hidden sm:inline">← Précédent</span>
          <span className="sm:hidden">←</span>
        </button>

        <div className="text-center flex-1">
          <h2 className="text-sm sm:text-xl font-bold text-white">{formatDateRange()}</h2>
          <button
            onClick={goToToday}
            className="text-xs sm:text-sm text-orange-400 hover:text-orange-300 mt-1"
          >
            Aujourd'hui
          </button>
        </div>

        <button
          onClick={goToNextWeek}
          className="px-2 sm:px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl transition-colors text-sm sm:text-base"
        >
          <span className="hidden sm:inline">Suivant →</span>
          <span className="sm:hidden">→</span>
        </button>
      </div>

      {/* Grille du calendrier - Mobile: vertical stack, Desktop: grid 7 colonnes */}
      <div className="lg:grid lg:grid-cols-7 lg:gap-2 flex flex-col lg:flex-none gap-2 pb-2">
        {sortedDays.map((day, index) => {
          const originalIndex = weekDays.indexOf(day)
          return (
          <motion.div
            key={day.date.toISOString()}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`glass-card rounded-xl overflow-hidden w-full ${
              day.isToday ? 'ring-2 ring-orange-500' : ''
            } ${day.isPast ? 'opacity-60' : ''}`}
          >
            {/* En-tête du jour */}
            <div
              className={`p-2 sm:p-3 lg:p-4 text-center border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors ${
                day.isToday ? 'bg-orange-500/20' : ''
              }`}
              onClick={() => onDayClick(day.date)}
            >
              <div className="text-[10px] sm:text-xs lg:text-sm text-gray-400 uppercase font-semibold">{dayNames[originalIndex]}</div>
              <div className="text-base sm:text-lg lg:text-2xl font-bold text-white mt-1">
                {day.date.getDate()}
              </div>
              {day.totalMinutes > 0 && (
                <div className="text-[10px] sm:text-xs lg:text-sm text-gray-400 mt-1">
                  {Math.floor(day.totalMinutes / 60)}h{day.totalMinutes % 60 > 0 ? `${day.totalMinutes % 60}m` : ''}
                </div>
              )}
            </div>

            {/* Contenu du jour */}
            <div className="p-2 lg:p-3 space-y-2 min-h-[150px] lg:min-h-[180px] lg:max-h-[400px] overflow-y-auto">
              {/* Événements personnels */}
              {day.events.map((de, i) => (
                <div
                  key={`event-${i}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick?.(de.event)
                  }}
                  className="px-2 lg:px-3 py-1.5 lg:py-2 bg-red-500/20 border border-red-500/30 rounded-lg cursor-pointer hover:bg-red-500/30 transition-colors"
                >
                  <div className="text-xs lg:text-sm text-red-300 font-medium line-clamp-2 lg:line-clamp-none">
                    🚫 {de.event.title}
                  </div>
                  {!de.event.isAllDay && (
                    <div className="text-[10px] lg:text-xs text-red-400/70 mt-0.5">
                      {new Date(de.event.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))}

              {/* Tâches planifiées */}
              <AnimatePresence>
                {day.tasks.map((dt, i) => (
                  <motion.div
                    key={`${dt.project.id}-${dt.task.id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onTaskClick(dt.project, dt.task)}
                    className={`px-2 lg:px-3 py-1.5 lg:py-2 bg-gradient-to-r ${dt.color} bg-opacity-20 rounded-lg cursor-pointer hover:scale-105 transition-transform ${
                      dt.task.completed ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="text-xs lg:text-sm text-white font-medium line-clamp-2 lg:line-clamp-none">
                      {dt.task.completed && '✓ '}
                      {dt.task.description}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-[10px] lg:text-xs text-white/70 truncate">
                        {dt.project.title}
                      </div>
                      <div className="text-[10px] lg:text-xs text-white/70 whitespace-nowrap ml-2">
                        {Math.floor(dt.task.estimatedMinutes / 60)}h
                        {dt.task.estimatedMinutes % 60 > 0 ? `${dt.task.estimatedMinutes % 60}m` : ''}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Message si jour vide */}
              {day.tasks.length === 0 && day.events.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-xs">
                  Aucune tâche
                </div>
              )}
            </div>

            {/* Indicateur de charge */}
            {day.totalMinutes > 0 && (
              <div className="px-2 lg:px-3 pb-2 lg:pb-3">
                <div className="w-full bg-gray-700 rounded-full h-1 lg:h-1.5">
                  <div
                    className={`h-1 lg:h-1.5 rounded-full transition-all ${
                      day.totalMinutes > 360
                        ? 'bg-red-500'
                        : day.totalMinutes > 240
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((day.totalMinutes / 360) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
          )
        })}
      </div>
    </div>
  )
}
