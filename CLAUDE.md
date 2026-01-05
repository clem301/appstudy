# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AppStudy** is a Progressive Web App (PWA) for managing home-schooling in Belgium with weekly Wednesday afternoon check-ins. The app automates course synthesis using OCR and AI, generates flashcards with spaced repetition, and provides intelligent planning focused on Wednesday deadlines.

**Target Platform:** iPhone (PWA installable via Safari)

## Architecture

### Core Workflow

1. **Scanner** → User uploads photo/PDF of course notes
2. **OCR (GPT-4o Vision)** → Extracts raw text from images
3. **Synthesis (o3-mini)** → Generates structured HTML summary
4. **Storage (IndexedDB)** → Saves locally for offline access
5. **Flashcards** → Auto-generates study cards with SRS algorithm
6. **Planning** → Tracks progress toward Wednesday check-in

### Tech Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS (Liquid Glass design system)
- **Animations:** Framer Motion
- **Routing:** React Router
- **State:** Zustand
- **Storage:** IndexedDB (local-first architecture)
- **APIs:** OpenAI GPT-4o (OCR) + o3-mini (synthesis)
- **PWA:** Service Worker + Manifest

## Application Structure

### 6 Main Modules

1. **🏠 Dashboard (Home)**
   - Countdown to Wednesday afternoon check-in
   - Quick stats: courses ready vs. to-do
   - Quick actions: scan, review flashcards

2. **📸 Scanner**
   - Upload photo/PDF
   - OCR extraction via Mistral OCR
   - Synthesis generation via Gemini 2.5 Flash
   - Metadata input (subject, chapter, date)

3. **📚 Syntheses Library**
   - List view with filters (subject, date, search)
   - HTML viewer with black & white styling
   - Export to PDF
   - Generate flashcards from synthesis

4. **📖 Book Notes**
   - Create books (title, author, pages)
   - Take notes while reading (page number, title, content)
   - Organize notes by book
   - Sync between devices (phone/PC)
   - Optimized for reading on phone, reviewing on PC

5. **🎴 Flashcards**
   - Auto-generation from syntheses
   - Manual creation/editing
   - Spaced Repetition System (SM-2 algorithm)
   - Swipe interface with 3D flip animations
   - Progress tracking

6. **📅 Planner**
   - Weekly view with Wednesday afternoon focus
   - Task management (CRUD)
   - Intelligent reminders (3 days, 1 day, morning of)
   - Progress visualization

### Navigation

**Bottom Tab Bar** (iOS-style, fixed at bottom):
```
[🏠 Home] [📸 Scan] [📚 Syntheses] [📖 Notes] [🎴 Cards] [📅 Plan]
```

## Data Models

### Synthesis
```typescript
interface Synthesis {
  id: string
  title: string
  subject: string        // e.g., "Mathématiques"
  chapter: string        // e.g., "Les Dérivées"
  date: Date
  rawText: string        // OCR output from GPT-4o
  html: string           // Structured synthesis from o3-mini
  sourceImages: string[] // Base64 or blob URLs
  pageCount: number
  wordCount: number
  flashcardsGenerated: boolean
  tags: string[]
}
```

### Flashcard
```typescript
interface Flashcard {
  id: string
  synthesisId: string
  question: string
  answer: string
  explanation?: string
  subject: string

  // SRS (Spaced Repetition System)
  easeFactor: number     // 1.3 - 2.5
  interval: number       // Days until next review
  repetitions: number
  nextReview: Date
  lastReviewed?: Date

  // Stats
  reviewCount: number
  correctCount: number
  incorrectCount: number
}
```

### PlannerTask
```typescript
interface PlannerTask {
  id: string
  subject: string
  chapter: string
  type: 'synthesis' | 'exercises' | 'review' | 'flashcards'
  dueDate: Date
  duration: number       // minutes
  completed: boolean
  completedAt?: Date
  forWednesday: boolean  // Critical flag for weekly check-in
  priority: 'low' | 'medium' | 'high'
  notes?: string
}
```

### Book & BookNote
```typescript
interface Book {
  id: string
  title: string
  author?: string
  coverImage?: string
  totalPages?: number
  currentPage?: number
  startedAt: Date
  finishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

interface BookNote {
  id: string
  bookId: string
  bookTitle: string      // Denormalized for easy display
  page?: number          // Page number in book (optional)
  title: string          // Note title (e.g., "Chapter 3 - Revolution")
  content: string        // Markdown content
  tags: string[]
  createdAt: Date
  updatedAt: Date
}
```

## Design System - "Liquid Glass"

### Visual Style

**Interface:** Modern glassmorphism with fluid animations
- Glass cards: `background: rgba(255, 255, 255, 0.1)` + `backdrop-filter: blur(20px)`
- Gradient accents: Purple-blue (`#667eea` → `#764ba2`)
- Smooth transitions with spring physics
- 3D transforms on hover/interaction

**Syntheses:** Clean black & white for readability
- Reference template in `test.html`
- Key components: `.header`, `.key-points`, `.definition`, `.important`, `.formula`, `.example`
- Typography: System fonts, high contrast
- Responsive: Mobile-first (max-width: 800px)

### CSS Classes Reference

```css
/* Glass effect (for UI components) */
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Synthesis HTML (black & white) */
.key-points { background: #000; color: #fff; } /* Essential concepts */
.definition { background: #f5f5f5; border-left: 4px solid #000; }
.important { border: 2px solid #000; }
.formula { font-family: monospace; text-align: center; }
.tag { background: #000; color: #fff; padding: 0.25rem 0.75rem; }
```

## AI Integration

### OCR Pipeline (2-step process)

**Step 1: Text Extraction (GPT-4o Vision)**
```typescript
// Extract raw text from image
const ocrResult = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Extract all text from this image verbatim." },
      { type: "image_url", image_url: { url: base64Image } }
    ]
  }]
})
```

**Step 2: Synthesis Generation (o3-mini)**
```typescript
// Generate structured HTML from raw text
const synthesis = await openai.chat.completions.create({
  model: "o3-mini",
  messages: [{
    role: "user",
    content: `Analyze this course content and create a structured HTML synthesis.

Content:
${rawText}

Generate HTML with:
- Main chapter title (h1)
- Key concepts section (.key-points with black background)
- Structured sections (h2, h3)
- Definitions (.definition)
- Important notes (.important)
- Formulas (.formula)
- Examples (.example)
- Tables for comparisons

Use the black & white styling classes. Focus on what's crucial for review.`
  }]
})
```

### Cost Estimation

- **GPT-4o (OCR):** ~$0.01 per page
- **o3-mini (Synthesis):** ~$0.011 per page
- **Total:** ~$0.021 per page
- **Monthly (400 pages):** ~€8.40

## PWA Configuration

### Manifest.json
```json
{
  "name": "AppStudy",
  "short_name": "Study",
  "theme_color": "#667eea",
  "background_color": "#0f172a",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "scope": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Offline Strategy

- **Syntheses:** Cached in IndexedDB (always available offline)
- **Flashcards:** Full offline review capability
- **Planning:** Offline CRUD with sync when online
- **Scanner:** Requires internet (OpenAI API calls)
- **Assets:** Cache-first via Service Worker

## Key Business Logic

### Wednesday Focus System

The entire app is designed around preparing for the **Wednesday afternoon check-in**:

1. **Dashboard countdown:** Shows days/hours until Wednesday 14:00
2. **Smart notifications:**
   - Monday morning: "3 tasks to prepare this week"
   - Tuesday evening: "Tomorrow is your check-in! 2 items remaining"
   - Wednesday morning: "Check-in this afternoon 👍"
3. **Task priority:** Tasks marked `forWednesday: true` appear prominently
4. **Planning view:** Wednesday is visually highlighted with special styling

### Spaced Repetition Algorithm (SM-2)

```typescript
function calculateNextReview(card: Flashcard, rating: 'hard' | 'medium' | 'easy') {
  let newInterval: number
  let newEaseFactor = card.easeFactor

  if (rating === 'hard') {
    newInterval = 1 // Review tomorrow
    newEaseFactor = Math.max(1.3, card.easeFactor - 0.2)
  } else if (rating === 'medium') {
    newInterval = card.interval * 1.5
  } else { // easy
    newInterval = card.interval * newEaseFactor
    newEaseFactor = Math.min(2.5, card.easeFactor + 0.1)
  }

  return {
    interval: Math.ceil(newInterval),
    easeFactor: newEaseFactor,
    nextReview: addDays(new Date(), newInterval)
  }
}
```

### Auto-Flashcard Generation

When a synthesis is created, o3-mini can automatically generate flashcards:

```typescript
// Prompt for flashcard generation
const flashcardsPrompt = `From this synthesis, generate 10-15 flashcards for active recall.

Synthesis:
${synthesis.html}

Format as JSON array:
[
  {
    "question": "Clear, specific question",
    "answer": "Concise answer",
    "explanation": "Optional context"
  }
]

Focus on:
- Key concepts and definitions
- Formulas and equations
- Important comparisons
- Critical facts to memorize
`
```

## Project-Specific Patterns

### File Upload Flow
1. User selects image/PDF via file input or camera
2. Convert to base64 for API transmission
3. Show preview with crop/rotate options
4. Collect metadata (subject, chapter, date)
5. Call GPT-4o → Show extraction progress
6. Call o3-mini → Show synthesis progress
7. Save to IndexedDB
8. Navigate to synthesis viewer

### Bottom Navigation State
- Active tab has gradient background + icon animation
- Inactive tabs are semi-transparent
- Badge on Flashcards tab shows cards due for review
- Badge on Planning tab shows incomplete tasks for Wednesday

### Animation Patterns
- **Page transitions:** Fade + slide up (0.4s ease-out)
- **Card hover:** Lift + shadow (spring physics)
- **Swipe gestures:** Follow finger with momentum
- **Loading states:** Skeleton screens + shimmer effect
- **Success feedback:** Confetti or checkmark animation

## Development Notes

### Storage Strategy

**IndexedDB Stores:**
- `syntheses` - All generated syntheses
- `flashcards` - All flashcards with SRS data
- `tasks` - Planning tasks
- `settings` - User preferences, API keys

**LocalStorage:**
- Last active tab
- UI preferences (animation enabled, theme)
- Onboarding completion

### API Key Management
- Store OpenAI API key in settings (encrypted in IndexedDB)
- Never commit API keys to version control
- Provide UI for user to input their own key
- Show usage stats/costs in settings

### Error Handling
- Network errors: Queue actions for retry when online
- API errors: Show user-friendly message + option to retry
- Storage errors: Fallback to localStorage if IndexedDB fails
- Image upload errors: Validate size/format before API call

## Important Constraints

1. **No filled black blocks in syntheses** - Only borders, key-points section background, and table headers use black fills
2. **Navigation always at bottom** - Fixed position tab bar (iOS style)
3. **Wednesday is paramount** - All features should support preparing for the weekly check-in
4. **Offline-first** - App must work without internet except for new scans
5. **Mobile-first** - Optimize for iPhone viewport, touch interactions
6. **Cost-conscious** - Minimize API calls, show cost estimates to users
