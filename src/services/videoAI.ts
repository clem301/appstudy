import { GoogleGenerativeAI } from '@google/generative-ai'
import type { VideoTask } from '../types/videoProject'
import type { ProjectCategory, Project, ProjectTask, PersonalEvent } from '../types/project'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  console.warn('Gemini API key not found. Set VITE_GEMINI_API_KEY in .env')
}

const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key')

export interface TaskEstimation {
  taskId: string
  originalDescription: string
  estimatedMinutes: number
  breakdown?: string
  tips?: string[]
}

export interface ParsedTask {
  description: string
  estimatedMinutes: number
  scheduledDate?: Date
}

/**
 * Estime le temps nécessaire pour réaliser des tâches de montage vidéo
 * Utilise Gemini 2.0 Flash pour analyser les tâches et donner une estimation réaliste
 */
export async function estimateVideoTasks(
  tasks: Array<{ id: string; description: string }>,
  projectContext?: string
): Promise<TaskEstimation[]> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`⏱️ Estimation du temps de montage avec Gemini...`)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.3, // Basse température pour des estimations cohérentes
      }
    })

    const prompt = `Tu es un expert en montage vidéo qui donne des estimations réalistes de temps de travail.

${projectContext ? `CONTEXTE DU PROJET : ${projectContext}\n` : ''}
TÂCHES À ESTIMER :
${tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n')}

🎯 OBJECTIF :
Estime le temps nécessaire pour CHAQUE tâche en minutes, en tenant compte :
- Du niveau de l'utilisateur (considère un monteur débutant-intermédiaire)
- De la complexité technique (effets, transitions, color grading, etc.)
- Du temps de rendu et d'export
- Des imprévus et ajustements (~20% de marge)

📋 TYPES DE TÂCHES ET TEMPS MOYENS :
- Découpage/Tri rushes : 30-60 min par heure de footage
- Montage cut simple : 2-4h pour 5-10 min de vidéo
- Ajout de musique/SFX : 30-60 min
- Étalonnage basique : 1-2h
- Étalonnage avancé : 3-5h
- Titrages/animations simples : 30-60 min
- Motion design complexe : 2-4h par scène
- Export/Rendu : 15-45 min selon la longueur

⚠️ RÈGLES :
1. Sois RÉALISTE - il vaut mieux surestimer que sous-estimer
2. Tiens compte de la fatigue (après 3h, on est moins efficace)
3. Inclus le temps de réflexion créative
4. Si une tâche est vague, estime large

FORMAT DE SORTIE :
Retourne UNIQUEMENT un tableau JSON, sans texte avant ou après.

[
  {
    "taskId": "id_de_la_tache",
    "estimatedMinutes": 120,
    "breakdown": "Découpage: 30min, Montage: 60min, Ajustements: 30min",
    "tips": ["Prépare ton storyboard avant", "Utilise des presets pour gagner du temps"]
  }
]

GÉNÈRE maintenant les estimations au format JSON strict.`

    const result = await model.generateContent(prompt)
    const response = result.response
    let jsonText = response.text().trim()

    // Nettoyer le JSON
    jsonText = jsonText.replace(/```json\s*/gi, '')
    jsonText = jsonText.replace(/```\s*/g, '')

    // Extraire le tableau JSON
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Format de réponse invalide: aucun tableau JSON trouvé')
    }

    const estimations = JSON.parse(jsonMatch[0]) as Array<{
      taskId: string
      estimatedMinutes: number
      breakdown?: string
      tips?: string[]
    }>

    // Validation
    if (!Array.isArray(estimations) || estimations.length === 0) {
      throw new Error('Aucune estimation générée')
    }

    // Mapper avec les descriptions originales
    const results: TaskEstimation[] = estimations.map(est => {
      const task = tasks.find(t => t.id === est.taskId)
      return {
        ...est,
        originalDescription: task?.description || '',
      }
    })

    console.log(`✅ ${results.length} tâches estimées avec succès`)
    return results

  } catch (error) {
    console.error('Gemini Video Estimation Error:', error)
    if (error instanceof SyntaxError) {
      throw new Error('Erreur de format dans la réponse de Gemini')
    }
    throw new Error('Erreur lors de l\'estimation des tâches')
  }
}

/**
 * Analyse un projet et suggère un planning optimal
 */
export async function suggestVideoSchedule(
  totalEstimatedHours: number,
  deadline: Date,
  tasks: VideoTask[]
): Promise<{
  isRealistic: boolean
  recommendedDailyHours: number
  warnings: string[]
  suggestions: string[]
}> {
  const now = new Date()
  const daysUntilDeadline = Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const hoursPerDay = totalEstimatedHours / daysUntilDeadline

  const warnings: string[] = []
  const suggestions: string[] = []

  // Analyse de faisabilité
  const isRealistic = hoursPerDay <= 8

  if (hoursPerDay > 8) {
    warnings.push(`⚠️ ${hoursPerDay.toFixed(1)}h/jour requis - C'est trop ! Risque de burnout.`)
  }

  if (hoursPerDay > 12) {
    warnings.push('🚨 Deadline irréaliste. Il faut revoir les priorités ou repousser la date.')
  }

  if (daysUntilDeadline < 3 && totalEstimatedHours > 15) {
    warnings.push('⏰ Très peu de temps ! Concentre-toi sur l\'essentiel.')
  }

  // Suggestions
  if (hoursPerDay > 5) {
    suggestions.push('📅 Bloque des créneaux fixes dans ton agenda')
    suggestions.push('☕ Prévois des pauses toutes les 2h pour rester efficace')
  }

  if (tasks.length > 10) {
    suggestions.push('📋 Priorise les tâches : fais d\'abord le montage principal')
  }

  suggestions.push('💾 Sauvegarde régulièrement et fais des backups')
  suggestions.push('🎧 Crée une playlist pour rester focus')

  return {
    isRealistic,
    recommendedDailyHours: Math.ceil(hoursPerDay * 10) / 10,
    warnings,
    suggestions,
  }
}

/**
 * Parse une description naturelle et extrait les tâches avec leur temps
 * Exemple: "Je dois derush plus ou moins 2h, je dois ZOOM plus ou moins 1h"
 */
export async function parseTasksFromDescription(
  description: string,
  deadline?: Date
): Promise<ParsedTask[]> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`🤖 Parsing des tâches avec Gemini...`)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      }
    })

    const deadlineInfo = deadline
      ? `\nDEADLINE: ${deadline.toLocaleDateString('fr-FR')} à ${deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : ''

    const prompt = `Tu es un assistant qui extrait et structure les tâches de montage vidéo à partir d'une description naturelle.

DESCRIPTION DE L'UTILISATEUR :
"${description}"${deadlineInfo}

🎯 OBJECTIF :
Extrais TOUTES les tâches mentionnées et leurs durées estimées.

📋 RÈGLES D'EXTRACTION :

1. IDENTIFICATION DES TÂCHES :
   - Cherche les mots clés : "je dois", "faire", "il faut", etc.
   - Tâches courantes : derush, montage, zoom, sound design, color grading, export, etc.
   - Sois flexible sur l'orthographe et les abréviations

2. EXTRACTION DES DURÉES :
   - "2h" ou "2 heures" → 120 minutes
   - "1h30" ou "1h 30" → 90 minutes
   - "30min" ou "30 minutes" → 30 minutes
   - "plus ou moins Xh" → utilise X comme estimation
   - Si pas de durée précise mais mention d'une tâche, estime selon les standards du montage

3. PLANIFICATION TEMPORELLE :
   - Si une date/heure est mentionnée pour une tâche, note-la
   - Sinon, laisse scheduledDate à null
   - Exemples : "demain", "mardi", "14h", "ce soir"

4. NORMALISATION :
   - Unifie les termes similaires (ex: "derush" = "dérushage")
   - Capitalise proprement les tâches
   - Sois cohérent

FORMAT DE SORTIE :
Retourne UNIQUEMENT un tableau JSON, sans texte avant ou après.

[
  {
    "description": "Dérushage des rushes",
    "estimatedMinutes": 120
  },
  {
    "description": "Montage Zoom",
    "estimatedMinutes": 60
  }
]

GÉNÈRE maintenant les tâches au format JSON strict.`

    const result = await model.generateContent(prompt)
    const response = result.response
    let jsonText = response.text().trim()

    // Nettoyer le JSON
    jsonText = jsonText.replace(/```json\s*/gi, '')
    jsonText = jsonText.replace(/```\s*/g, '')

    // Extraire le tableau
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Format de réponse invalide')
    }

    const tasks = JSON.parse(jsonMatch[0]) as ParsedTask[]

    // Validation
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Aucune tâche détectée dans la description')
    }

    console.log(`✅ ${tasks.length} tâches extraites avec succès`)
    return tasks

  } catch (error) {
    console.error('Gemini Task Parsing Error:', error)
    if (error instanceof SyntaxError) {
      throw new Error('Erreur de format dans la réponse de Gemini')
    }
    throw new Error('Erreur lors de l\'extraction des tâches')
  }
}

/**
 * Détecte automatiquement la catégorie d'un projet basé sur sa description
 * Utilise Gemini 2.0 Flash pour analyser le contexte
 */
export async function detectProjectCategory(
  description: string,
  title?: string
): Promise<{ category: ProjectCategory; confidence: number; schoolSubCategory?: 'lesson' | 'homework' }> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`🔍 Détection de la catégorie avec Gemini...`)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.1,
      }
    })

    const titleInfo = title ? `\nTITRE: "${title}"` : ''

    const prompt = `Tu es un assistant qui détecte la catégorie d'un projet basé sur sa description.

DESCRIPTION DU PROJET :
"${description}"${titleInfo}

🎯 OBJECTIF :
Détermine si ce projet appartient à l'une des 3 catégories suivantes :

📋 CATÉGORIES :

1. **video** (Montage Vidéo)
   - Mots-clés : derush, montage, editing, zoom, sound design, color grading, export, rushes, timeline, séquence, clip, transition, effet, render
   - Contexte : Création ou édition de contenu vidéo

2. **work** (Boulot/Développement)
   - Mots-clés : code, dev, développement, programming, bug, feature, API, database, frontend, backend, deploy, debug, test, commit, pull request
   - Contexte : Travail professionnel ou développement logiciel

3. **school** (École)
   - Mots-clés : cours, leçon, devoir, exercice, étudier, réviser, apprendre, chapitre, matière, examen, contrôle, homework
   - Sous-catégories :
     * "lesson" : Apprendre une leçon, étudier un cours, réviser
     * "homework" : Faire des devoirs, exercices à rendre

⚠️ RÈGLES :
- Analyse le contexte et le vocabulaire utilisé
- Si c'est lié à l'école, détermine aussi la sous-catégorie (lesson ou homework)
- Donne un score de confiance entre 0 et 1

FORMAT DE SORTIE :
Retourne UNIQUEMENT un objet JSON sans texte autour :

{
  "category": "video" | "work" | "school",
  "confidence": 0.95,
  "schoolSubCategory": "lesson" | "homework" | null
}

GÉNÈRE maintenant l'analyse au format JSON strict.`

    const result = await model.generateContent(prompt)
    const response = result.response
    let jsonText = response.text().trim()

    // Nettoyer le JSON
    jsonText = jsonText.replace(/```json\s*/gi, '')
    jsonText = jsonText.replace(/```\s*/g, '')

    // Extraire l'objet
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Format de réponse invalide')
    }

    const detection = JSON.parse(jsonMatch[0]) as {
      category: ProjectCategory
      confidence: number
      schoolSubCategory?: 'lesson' | 'homework' | null
    }

    // Validation
    if (!detection.category || !['video', 'work', 'school'].includes(detection.category)) {
      throw new Error('Catégorie invalide détectée')
    }

    console.log(`✅ Catégorie détectée: ${detection.category} (confiance: ${Math.round(detection.confidence * 100)}%)`)

    return {
      category: detection.category,
      confidence: detection.confidence,
      schoolSubCategory: detection.schoolSubCategory || undefined
    }

  } catch (error) {
    console.error('Gemini Category Detection Error:', error)
    if (error instanceof SyntaxError) {
      throw new Error('Erreur de format dans la réponse de Gemini')
    }
    throw new Error('Erreur lors de la détection de catégorie')
  }
}

/**
 * Planifie intelligemment les tâches sur les jours disponibles
 * Prend en compte le planning actuel et les événements personnels
 */
export async function scheduleTasksIntelligently(
  tasks: ProjectTask[],
  deadline: Date,
  existingProjects: Project[],
  personalEvents: PersonalEvent[]
): Promise<ProjectTask[]> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`📅 Planification intelligente avec Gemini...`)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.2,
      }
    })

    const now = new Date()
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Construire le planning actuel
    const currentSchedule = existingProjects
      .flatMap(project =>
        project.tasks
          .filter(t => !t.completed && t.scheduledDate)
          .map(t => ({
            date: t.scheduledDate!.toISOString().split('T')[0],
            task: t.description,
            minutes: t.estimatedMinutes,
            project: project.title
          }))
      )

    // Construire les blocages personnels
    const blockedSlots = personalEvents.map(event => ({
      start: event.startDate.toISOString(),
      end: event.endDate.toISOString(),
      title: event.title,
      isAllDay: event.isAllDay
    }))

    const tasksToSchedule = tasks.map(t => ({
      id: t.id,
      description: t.description,
      estimatedMinutes: t.estimatedMinutes
    }))

    const prompt = `Tu es un assistant de planification expert qui optimise la répartition des tâches sur les jours disponibles.

📋 CONTEXTE :

AUJOURD'HUI : ${now.toLocaleDateString('fr-FR')}
DEADLINE : ${deadline.toLocaleDateString('fr-FR')} (dans ${daysUntilDeadline} jours)

🎯 TÂCHES À PLANIFIER :
${JSON.stringify(tasksToSchedule, null, 2)}

📅 PLANNING ACTUEL (tâches déjà planifiées) :
${currentSchedule.length > 0 ? JSON.stringify(currentSchedule, null, 2) : 'Aucune tâche planifiée'}

🚫 ÉVÉNEMENTS PERSONNELS (blocages) :
${blockedSlots.length > 0 ? JSON.stringify(blockedSlots, null, 2) : 'Aucun événement personnel'}

🎯 OBJECTIF :
Répartis intelligemment les tâches à planifier sur les jours entre aujourd'hui et la deadline.

📋 RÈGLES DE PLANIFICATION :

1. OPTIMISATION TEMPORELLE :
   - Commence dès demain (pas aujourd'hui sauf si deadline très proche)
   - Répartis équitablement pour éviter la surcharge
   - Privilégie les tâches longues en début de période
   - Garde de la marge avant la deadline (buffer)

2. RESPECT DES CONTRAINTES :
   - NE PLANIFIE PAS pendant les événements personnels bloqués
   - Prends en compte le planning actuel pour ne pas surcharger certains jours
   - Maximum 4-6h de travail par jour (sois réaliste)
   - Laisse des jours de repos si la période est longue

3. STRATÉGIE :
   - Si deadline proche (< 3 jours) : planification intensive mais réaliste
   - Si deadline moyenne (3-7 jours) : répartition équilibrée
   - Si deadline lointaine (> 7 jours) : espacement confortable avec jours de repos

4. ADAPTATION AU PLANNING EXISTANT :
   - Un jour avec déjà 3h de tâches planifiées → max 2h supplémentaires
   - Un jour avec déjà 5h de tâches → éviter de surcharger
   - Privilégier les jours avec peu ou pas de tâches

FORMAT DE SORTIE :
Retourne UNIQUEMENT un tableau JSON des tâches avec leur date planifiée.

[
  {
    "id": "task-id-1",
    "scheduledDate": "2026-01-05T09:00:00.000Z",
    "reasoning": "Tâche longue planifiée en début de période, jour peu chargé"
  },
  {
    "id": "task-id-2",
    "scheduledDate": "2026-01-06T14:00:00.000Z",
    "reasoning": "Répartition équitable, après événement personnel"
  }
]

⚠️ IMPORTANT :
- Les dates doivent être au format ISO complet (avec heure)
- Chaque tâche doit avoir une date unique (une tâche = un jour)
- La somme des minutes planifiées par jour ne doit pas dépasser 360min (6h)
- Inclus un "reasoning" court pour expliquer le choix de la date

GÉNÈRE maintenant le planning au format JSON strict.`

    const result = await model.generateContent(prompt)
    const response = result.response
    let jsonText = response.text().trim()

    // Nettoyer le JSON
    jsonText = jsonText.replace(/```json\s*/gi, '')
    jsonText = jsonText.replace(/```\s*/g, '')

    // Extraire le tableau
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Format de réponse invalide')
    }

    const schedule = JSON.parse(jsonMatch[0]) as Array<{
      id: string
      scheduledDate: string
      reasoning: string
    }>

    // Appliquer les dates planifiées aux tâches
    const scheduledTasks = tasks.map(task => {
      const scheduleItem = schedule.find(s => s.id === task.id)
      if (scheduleItem) {
        return {
          ...task,
          scheduledDate: new Date(scheduleItem.scheduledDate)
        }
      }
      return task
    })

    console.log(`✅ ${schedule.length} tâches planifiées avec succès`)
    return scheduledTasks

  } catch (error) {
    console.error('Gemini Scheduling Error:', error)
    if (error instanceof SyntaxError) {
      throw new Error('Erreur de format dans la réponse de Gemini')
    }
    throw new Error('Erreur lors de la planification')
  }
}

/**
 * Re-planifie les tâches futures pour optimiser le planning
 * Utilisé quand l'utilisateur prend du retard ou ajoute des événements
 */
export async function rescheduleFutureTasks(
  allProjects: Project[],
  personalEvents: PersonalEvent[]
): Promise<Project[]> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`🔄 Re-planification intelligente avec Gemini...`)

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    // Collecter toutes les tâches futures non complétées
    const futureTasks: Array<{
      projectId: string
      taskId: string
      task: ProjectTask
      deadline: Date
      projectTitle: string
    }> = []

    allProjects.forEach(project => {
      project.tasks.forEach(task => {
        if (!task.completed && task.scheduledDate && task.scheduledDate >= tomorrow) {
          futureTasks.push({
            projectId: project.id,
            taskId: task.id,
            task,
            deadline: project.deadline,
            projectTitle: project.title
          })
        }
      })
    })

    if (futureTasks.length === 0) {
      console.log('Aucune tâche future à re-planifier')
      return allProjects
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.2,
      }
    })

    // Préparer les données pour l'IA
    const tasksToReschedule = futureTasks.map(ft => ({
      projectId: ft.projectId,
      taskId: ft.taskId,
      projectTitle: ft.projectTitle,
      description: ft.task.description,
      estimatedMinutes: ft.task.estimatedMinutes,
      currentScheduledDate: ft.task.scheduledDate?.toISOString(),
      deadline: ft.deadline.toISOString()
    }))

    const blockedSlots = personalEvents
      .filter(e => e.startDate >= tomorrow)
      .map(event => ({
        start: event.startDate.toISOString(),
        end: event.endDate.toISOString(),
        title: event.title,
        isAllDay: event.isAllDay
      }))

    const prompt = `Tu es un assistant de re-planification qui optimise l'organisation des tâches futures.

📋 CONTEXTE :

AUJOURD'HUI : ${now.toLocaleDateString('fr-FR')}
PÉRIODE DE RE-PLANIFICATION : À partir de demain

🎯 TÂCHES FUTURES À RÉORGANISER :
${JSON.stringify(tasksToReschedule, null, 2)}

🚫 ÉVÉNEMENTS PERSONNELS (blocages futurs) :
${blockedSlots.length > 0 ? JSON.stringify(blockedSlots, null, 2) : 'Aucun événement personnel futur'}

🎯 OBJECTIF :
Réorganise TOUTES les tâches futures pour une planification optimale en tenant compte :
1. Des nouvelles contraintes (événements personnels ajoutés)
2. Des retards éventuels
3. D'une meilleure répartition de la charge

📋 RÈGLES DE RE-PLANIFICATION :

1. PRIORITÉS :
   - Respecter les deadlines de chaque projet
   - Grouper les tâches d'un même projet si possible
   - Équilibrer la charge de travail quotidienne

2. OPTIMISATION :
   - Maximum 6h de travail par jour
   - Éviter les jours surchargés
   - Laisser des buffers avant les deadlines

3. RESPECT DES CONTRAINTES :
   - NE JAMAIS planifier pendant les événements personnels
   - Garder les tâches après demain (pas avant)
   - Adapter si plusieurs projets ont des deadlines proches

FORMAT DE SORTIE :
Retourne un tableau JSON avec les nouvelles dates pour CHAQUE tâche.

[
  {
    "projectId": "project-123",
    "taskId": "task-456",
    "newScheduledDate": "2026-01-06T10:00:00.000Z",
    "reasoning": "Déplacé pour éviter conflit avec événement personnel"
  }
]

⚠️ IMPORTANT :
- Toutes les tâches doivent être re-planifiées (même celles déjà bien placées)
- Les dates doivent être >= demain
- Respecter les deadlines de chaque projet
- Optimiser la charge quotidienne globale

GÉNÈRE maintenant la re-planification au format JSON strict.`

    const result = await model.generateContent(prompt)
    const response = result.response
    let jsonText = response.text().trim()

    // Nettoyer le JSON
    jsonText = jsonText.replace(/```json\s*/gi, '')
    jsonText = jsonText.replace(/```\s*/g, '')

    // Extraire le tableau
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Format de réponse invalide')
    }

    const reschedule = JSON.parse(jsonMatch[0]) as Array<{
      projectId: string
      taskId: string
      newScheduledDate: string
      reasoning: string
    }>

    // Appliquer les nouvelles dates
    const updatedProjects = allProjects.map(project => {
      const updatedTasks = project.tasks.map(task => {
        const rescheduleItem = reschedule.find(
          r => r.projectId === project.id && r.taskId === task.id
        )
        if (rescheduleItem) {
          console.log(`📅 ${task.description}: ${rescheduleItem.reasoning}`)
          return {
            ...task,
            scheduledDate: new Date(rescheduleItem.newScheduledDate)
          }
        }
        return task
      })

      return {
        ...project,
        tasks: updatedTasks,
        updatedAt: new Date()
      }
    })

    console.log(`✅ ${reschedule.length} tâches re-planifiées avec succès`)
    return updatedProjects

  } catch (error) {
    console.error('Gemini Rescheduling Error:', error)
    if (error instanceof SyntaxError) {
      throw new Error('Erreur de format dans la réponse de Gemini')
    }
    throw new Error('Erreur lors de la re-planification')
  }
}
