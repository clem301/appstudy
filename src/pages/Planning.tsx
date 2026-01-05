import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { WeeklyCalendar } from '../components/planning/WeeklyCalendar'
import {
  getAllProjects,
  getAllPersonalEvents,
  saveProject,
  savePersonalEvent,
  updateProject,
  deleteProject,
  updatePersonalEvent,
  deletePersonalEvent,
} from '../services/storage'
import {
  parseTasksFromDescription,
  detectProjectCategory,
  scheduleTasksIntelligently,
  rescheduleFutureTasks,
} from '../services/videoAI'
import type { Project, ProjectTask, ProjectCategory, SchoolSubCategory, PersonalEvent } from '../types/project'

export function Planning() {
  const [projects, setProjects] = useState<Project[]>([])
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  // Modals
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null)
  const [isEditingTask, setIsEditingTask] = useState(false)

  // Formulaire d'édition de tâche
  const [editTaskDescription, setEditTaskDescription] = useState('')
  const [editTaskMinutes, setEditTaskMinutes] = useState('')
  const [editTaskDate, setEditTaskDate] = useState('')

  // Formulaire nouveau projet
  const [quickInput, setQuickInput] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newTasks, setNewTasks] = useState<Array<{ description: string; estimatedMinutes: number }>>([])
  const [detectedCategory, setDetectedCategory] = useState<ProjectCategory | null>(null)
  const [detectedSchoolSub, setDetectedSchoolSub] = useState<SchoolSubCategory | null>(null)
  const [manualCategory, setManualCategory] = useState<ProjectCategory | null>(null)
  const [manualSchoolSub, setManualSchoolSub] = useState<SchoolSubCategory | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')

  // Formulaire nouvel événement personnel
  const [eventTitle, setEventTitle] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [eventEnd, setEventEnd] = useState('')
  const [eventIsAllDay, setEventIsAllDay] = useState(false)
  const [eventNotes, setEventNotes] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [projectsData, eventsData] = await Promise.all([
      getAllProjects(),
      getAllPersonalEvents()
    ])

    // Mettre à jour les statuts des projets
    const updatedProjects = projectsData.map(p => ({
      ...p,
      status: getProjectStatus(p)
    }))

    setProjects(updatedProjects)
    setPersonalEvents(eventsData)
    setLoading(false)
  }

  const getProjectStatus = (project: Project): Project['status'] => {
    if (project.completedAt) return 'completed'

    const now = new Date()
    const deadline = new Date(project.deadline)

    if (deadline < now) return 'overdue'

    const hasStarted = project.tasks.some(t => t.completed)
    return hasStarted ? 'in_progress' : 'planning'
  }

  const handleQuickCreate = async () => {
    if (!quickInput.trim() || !newDeadline) {
      alert('Remplis la description et la deadline')
      return
    }

    setProcessing(true)

    try {
      // Étape 1: Détecter la catégorie automatiquement
      setProcessingStep('🔍 Détection de la catégorie...')
      const categoryDetection = await detectProjectCategory(quickInput, newTitle)
      setDetectedCategory(categoryDetection.category)
      setDetectedSchoolSub(categoryDetection.schoolSubCategory || null)

      // Étape 2: Parser les tâches
      setProcessingStep('📋 Extraction des tâches...')
      const deadline = new Date(newDeadline)
      const parsedTasks = await parseTasksFromDescription(quickInput, deadline)

      setNewTasks(parsedTasks.map(t => ({
        description: t.description,
        estimatedMinutes: t.estimatedMinutes
      })))

      if (!newTitle) {
        const categoryLabels = {
          video: 'Montage Vidéo',
          work: 'Boulot/Dev',
          school: 'École',
        }
        setNewTitle(`${categoryLabels[categoryDetection.category]} - ${new Date().toLocaleDateString('fr-FR')}`)
      }

      // Étape 3: Planifier intelligemment les tâches
      setProcessingStep('📅 Planification intelligente...')

      const tasksWithIds: ProjectTask[] = parsedTasks.map((t, i) => ({
        id: `temp_${i}`,
        description: t.description,
        estimatedMinutes: t.estimatedMinutes,
        completed: false,
      }))

      const scheduledTasks = await scheduleTasksIntelligently(
        tasksWithIds,
        deadline,
        projects,
        personalEvents
      )

      // Étape 4: Créer le projet
      setProcessingStep('💾 Création du projet...')

      const totalEstimated = parsedTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0) / 60

      const projectData = {
        category: manualCategory || categoryDetection.category,
        schoolSubCategory: categoryDetection.category === 'school'
          ? (manualSchoolSub || categoryDetection.schoolSubCategory)
          : undefined,
        title: newTitle,
        description: quickInput,
        deadline,
        tasks: scheduledTasks.map(t => ({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          description: t.description,
          estimatedMinutes: t.estimatedMinutes,
          completed: false,
          scheduledDate: t.scheduledDate,
        })),
        userEstimatedHours: totalEstimated,
        status: 'planning' as const,
        priority: 'medium' as const,
      }

      await saveProject(projectData)

      // Rafraîchir et fermer
      await loadData()
      setShowNewProjectModal(false)
      resetForm()

      setProcessingStep('✅ Projet créé avec succès !')
      setTimeout(() => {
        setProcessing(false)
        setProcessingStep('')
      }, 1000)

    } catch (error) {
      console.error('Erreur lors de la création:', error)
      alert('Erreur: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
      setProcessing(false)
      setProcessingStep('')
    }
  }

  const handleAddPersonalEvent = async () => {
    if (!eventTitle || !eventStart || !eventEnd) {
      alert('Remplis tous les champs requis')
      return
    }

    try {
      if (editingEventId) {
        // Mode édition
        await updatePersonalEvent(editingEventId, {
          title: eventTitle,
          startDate: new Date(eventStart),
          endDate: new Date(eventEnd),
          isAllDay: eventIsAllDay,
          notes: eventNotes,
        })
      } else {
        // Mode création
        await savePersonalEvent({
          title: eventTitle,
          startDate: new Date(eventStart),
          endDate: new Date(eventEnd),
          isAllDay: eventIsAllDay,
          notes: eventNotes,
        })
      }

      // Après ajout/modification d'un événement, re-planifier les tâches futures
      setProcessing(true)
      setProcessingStep('🔄 Re-planification du planning...')

      const updatedProjects = await rescheduleFutureTasks(projects, [...personalEvents, {
        id: 'temp',
        title: eventTitle,
        startDate: new Date(eventStart),
        endDate: new Date(eventEnd),
        isAllDay: eventIsAllDay,
        notes: eventNotes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }])

      // Sauvegarder les projets mis à jour
      for (const project of updatedProjects) {
        await updateProject(project.id, { tasks: project.tasks })
      }

      await loadData()
      setShowNewEventModal(false)
      resetEventForm()

      setProcessing(false)
      setProcessingStep('')
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
      setProcessing(false)
    }
  }

  const handleDeletePersonalEvent = async (eventId: string) => {
    if (!confirm('Supprimer cet événement ?')) return

    try {
      await deletePersonalEvent(eventId)
      await loadData()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleTaskClick = (project: Project, task: ProjectTask) => {
    setSelectedProject(project)
    setSelectedTask(task)
    setIsEditingTask(false)
    setEditTaskDescription(task.description)
    setEditTaskMinutes(task.estimatedMinutes.toString())
    setEditTaskDate(task.scheduledDate ? new Date(task.scheduledDate).toISOString().split('T')[0] : '')
    setShowTaskDetailsModal(true)
  }

  const handleSaveTaskEdit = async () => {
    if (!selectedProject || !selectedTask) return
    if (!editTaskDescription.trim() || !editTaskMinutes) return

    const updatedTasks = selectedProject.tasks.map(t =>
      t.id === selectedTask.id
        ? {
            ...t,
            description: editTaskDescription.trim(),
            estimatedMinutes: parseInt(editTaskMinutes),
            scheduledDate: editTaskDate ? new Date(editTaskDate) : undefined
          }
        : t
    )

    await updateProject(selectedProject.id, { tasks: updatedTasks })
    await loadData()
    setIsEditingTask(false)
    setShowTaskDetailsModal(false)
  }

  const handleDeleteTask = async () => {
    if (!selectedProject || !selectedTask) return
    if (!confirm('Supprimer cette tâche ?')) return

    const updatedTasks = selectedProject.tasks.filter(t => t.id !== selectedTask.id)

    await updateProject(selectedProject.id, {
      tasks: updatedTasks,
      status: updatedTasks.length === 0 ? 'planning' :
              updatedTasks.every(t => t.completed) ? 'completed' : 'in_progress'
    })

    await loadData()
    setShowTaskDetailsModal(false)
  }

  const handleToggleTaskComplete = async () => {
    if (!selectedProject || !selectedTask) return

    const updatedTasks = selectedProject.tasks.map(t =>
      t.id === selectedTask.id
        ? {
            ...t,
            completed: !t.completed,
            completedAt: !t.completed ? new Date() : undefined
          }
        : t
    )

    await updateProject(selectedProject.id, {
      tasks: updatedTasks,
      status: updatedTasks.every(t => t.completed) ? 'completed' : 'in_progress'
    })

    await loadData()
    setShowTaskDetailsModal(false)
  }

  const handleEventClick = (event: PersonalEvent) => {
    // Ouvrir modal en mode édition
    setEditingEventId(event.id)
    setEventTitle(event.title)
    setEventStart(new Date(event.startDate).toISOString().slice(0, 16))
    setEventEnd(new Date(event.endDate).toISOString().slice(0, 16))
    setEventIsAllDay(event.isAllDay)
    setEventNotes(event.notes || '')
    setShowNewEventModal(true)
  }

  const handleDayClick = (date: Date) => {
    // Ouvrir modal pour ajouter un événement personnel ce jour
    const dateStr = date.toISOString().split('T')[0]
    setEventStart(dateStr + 'T09:00')
    setEventEnd(dateStr + 'T17:00')
    setShowNewEventModal(true)
  }

  const resetForm = () => {
    setQuickInput('')
    setNewTitle('')
    setNewDeadline('')
    setNewTasks([])
    setDetectedCategory(null)
    setDetectedSchoolSub(null)
    setManualCategory(null)
    setManualSchoolSub(null)
  }

  const resetEventForm = () => {
    setEventTitle('')
    setEventStart('')
    setEventEnd('')
    setEventIsAllDay(false)
    setEventNotes('')
    setEditingEventId(null)
  }

  const getCategoryIcon = (category: ProjectCategory) => {
    return { video: '🎬', work: '💼', school: '📚' }[category]
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">📋</div>
          <div className="text-white">Chargement du planning...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll p-5 pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header - Responsive */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                📋 Planning
              </h1>
              <p className="text-sm sm:text-base text-gray-400 mt-1 hidden sm:block">Organisation intelligente de tes projets</p>
            </div>

            <button
              onClick={() => setView(view === 'calendar' ? 'list' : 'calendar')}
              className="px-3 sm:px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl transition-colors text-sm sm:text-base"
            >
              <span className="hidden sm:inline">{view === 'calendar' ? '📋 Liste' : '📅 Calendrier'}</span>
              <span className="sm:hidden">{view === 'calendar' ? '📋' : '📅'}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="gradient"
              onClick={() => setShowNewEventModal(true)}
              className="flex-1 sm:flex-none text-sm sm:text-base"
            >
              <span className="hidden sm:inline">🚫 Événement perso</span>
              <span className="sm:hidden">🚫 Perso</span>
            </Button>
            <Button
              variant="gradient"
              onClick={() => setShowNewProjectModal(true)}
              className="flex-1 sm:flex-none text-sm sm:text-base"
            >
              <span className="hidden sm:inline">+ Nouveau projet</span>
              <span className="sm:hidden">+ Projet</span>
            </Button>
          </div>
        </div>

        {/* Vue calendrier */}
        {view === 'calendar' && (
          <WeeklyCalendar
            projects={projects}
            personalEvents={personalEvents}
            onTaskClick={handleTaskClick}
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
          />
        )}

        {/* Vue liste */}
        {view === 'list' && (
          <div className="grid gap-4">
            {projects.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-gray-400">Aucun projet. Crée-en un pour commencer !</div>
              </Card>
            ) : (
              projects.map(project => (
                <Card key={project.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getCategoryIcon(project.category)}</span>
                        <h3 className="text-xl font-bold text-white">{project.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          project.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          project.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                          project.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{project.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>📅 {new Date(project.deadline).toLocaleDateString('fr-FR')}</span>
                        <span>✅ {project.tasks.filter(t => t.completed).length}/{project.tasks.length} tâches</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteProject(project.id).then(loadData)}
                      className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                    >
                      🗑️
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Modal nouveau projet */}
        <AnimatePresence>
          {showNewProjectModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => !processing && setShowNewProjectModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold text-white mb-4">📝 Nouveau Projet</h2>

                {processing ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4 animate-bounce">🤖</div>
                    <p className="text-white mb-2">Intelligence artificielle en action...</p>
                    <p className="text-gray-400 text-sm">{processingStep}</p>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full animate-pulse w-3/4" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Catégorie détectée */}
                    {detectedCategory && (
                      <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-green-400 font-medium">Catégorie détectée par l'IA:</div>
                            <div className="text-white mt-1">
                              {getCategoryIcon(detectedCategory)} {detectedCategory}
                              {detectedSchoolSub && ` - ${detectedSchoolSub}`}
                            </div>
                          </div>
                          <button
                            onClick={() => setManualCategory(detectedCategory === 'video' ? 'work' : 'video')}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
                          >
                            Changer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Input rapide */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        💬 Décris ton projet en langage naturel
                      </label>
                      <textarea
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                        placeholder="Ex: Je dois derush 2h, faire le montage zoom 1h30, et le sound design 2h"
                        className="w-full bg-gray-700/50 text-white rounded-xl p-3 min-h-[100px]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">📋 Titre (optionnel)</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="L'IA peut le générer automatiquement"
                        className="w-full bg-gray-700/50 text-white rounded-xl p-3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">📅 Deadline *</label>
                      <input
                        type="datetime-local"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="w-full bg-gray-700/50 text-white rounded-xl p-3"
                      />
                    </div>

                    {/* Tâches parsées */}
                    {newTasks.length > 0 && (
                      <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                        <div className="text-sm text-blue-400 font-medium mb-2">
                          Tâches détectées ({newTasks.length}):
                        </div>
                        {newTasks.map((task, i) => (
                          <div key={i} className="text-white text-sm py-1">
                            • {task.description} - {Math.floor(task.estimatedMinutes / 60)}h
                            {task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        variant="glass"
                        onClick={() => setShowNewProjectModal(false)}
                        className="flex-1"
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="gradient"
                        onClick={handleQuickCreate}
                        className="flex-1"
                        disabled={!quickInput || !newDeadline}
                      >
                        🤖 Créer avec IA
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal nouvel événement personnel */}
        <AnimatePresence>
          {showNewEventModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowNewEventModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">
                    🚫 {editingEventId ? 'Modifier l\'événement' : 'Événement Personnel'}
                  </h2>
                  {editingEventId && (
                    <button
                      onClick={() => {
                        handleDeletePersonalEvent(editingEventId)
                        setShowNewEventModal(false)
                      }}
                      className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
                    >
                      🗑️ Supprimer
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Titre *</label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Ex: Rendez-vous médecin"
                      className="w-full bg-gray-700/50 text-white rounded-xl p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Début *</label>
                    <input
                      type="datetime-local"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      className="w-full bg-gray-700/50 text-white rounded-xl p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Fin *</label>
                    <input
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      className="w-full bg-gray-700/50 text-white rounded-xl p-3"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={eventIsAllDay}
                      onChange={(e) => setEventIsAllDay(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <label className="text-white">Toute la journée</label>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Notes</label>
                    <textarea
                      value={eventNotes}
                      onChange={(e) => setEventNotes(e.target.value)}
                      className="w-full bg-gray-700/50 text-white rounded-xl p-3 min-h-[80px]"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="glass"
                      onClick={() => {
                        setShowNewEventModal(false)
                        resetEventForm()
                      }}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="gradient"
                      onClick={handleAddPersonalEvent}
                      className="flex-1"
                    >
                      {editingEventId ? 'Sauvegarder' : 'Ajouter'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal détails tâche */}
        <AnimatePresence>
          {showTaskDetailsModal && selectedProject && selectedTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setShowTaskDetailsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">
                    {isEditingTask ? 'Modifier la tâche' : 'Détails de la tâche'}
                  </h2>
                  {!isEditingTask && (
                    <button
                      onClick={() => setIsEditingTask(true)}
                      className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 text-sm"
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </div>

                <p className="text-gray-400 mb-4">Projet: {selectedProject.title}</p>

                {isEditingTask ? (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Description</label>
                      <input
                        type="text"
                        value={editTaskDescription}
                        onChange={(e) => setEditTaskDescription(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Durée estimée (minutes)</label>
                      <input
                        type="number"
                        value={editTaskMinutes}
                        onChange={(e) => setEditTaskMinutes(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Date planifiée</label>
                      <input
                        type="date"
                        value={editTaskDate}
                        onChange={(e) => setEditTaskDate(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="glass"
                        onClick={() => setIsEditingTask(false)}
                        className="flex-1"
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="gradient"
                        onClick={handleSaveTaskEdit}
                        className="flex-1"
                      >
                        Sauvegarder
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-6">
                      <div className="p-3 bg-gray-800/30 rounded-xl">
                        <div className="text-sm text-gray-400 mb-1">Description</div>
                        <div className="text-white">{selectedTask.description}</div>
                      </div>

                      <div className="p-3 bg-gray-800/30 rounded-xl">
                        <div className="text-sm text-gray-400 mb-1">⏱️ Durée estimée</div>
                        <div className="text-white">
                          {Math.floor(selectedTask.estimatedMinutes / 60)}h
                          {selectedTask.estimatedMinutes % 60 > 0 ? ` ${selectedTask.estimatedMinutes % 60}m` : ''}
                        </div>
                      </div>

                      {selectedTask.scheduledDate && (
                        <div className="p-3 bg-gray-800/30 rounded-xl">
                          <div className="text-sm text-gray-400 mb-1">📅 Date planifiée</div>
                          <div className="text-white">
                            {new Date(selectedTask.scheduledDate).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-gray-800/30 rounded-xl">
                        <div className="text-sm text-gray-400 mb-1">Statut</div>
                        <div className="text-white">
                          {selectedTask.completed ? '✅ Terminée' : '⏳ En attente'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="gradient"
                        onClick={handleToggleTaskComplete}
                        className="w-full"
                      >
                        {selectedTask.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                      </Button>
                      <Button
                        variant="glass"
                        onClick={handleDeleteTask}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400"
                      >
                        🗑️ Supprimer la tâche
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
