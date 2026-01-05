export interface Synthesis {
  id: string
  title: string
  subject: string // e.g., "Mathématiques"
  chapter: string // e.g., "Les Dérivées"
  date: Date
  rawText: string // OCR output from GPT-4o
  html: string // Structured synthesis from o3-mini
  sourceImages: string[] // Base64 or blob URLs
  pageCount: number
  wordCount: number
  flashcardsGenerated: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SynthesisMetadata {
  subject: string
  chapter: string
  date: Date
}
