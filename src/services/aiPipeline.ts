
import { extractTextWithMistralOCR } from './mistral'
import { generateSynthesisWithGemini, type SynthesisResult } from './gemini'

export interface ProcessingResult {
  rawText: string
  synthesis: SynthesisResult
}

export type ProcessCallback = (stage: 'ocr' | 'synthesis', progress: number) => void

/**
 * Pipeline complet : Image -> OCR (Mistral) -> Synthèse (Gemini)
 */
export async function processImage(
  imagesBase64: string[],
  subject: string,
  chapter: string,
  onProgress?: ProcessCallback
): Promise<ProcessingResult> {
  
  // 1. OCR avec Mistral
  if (onProgress) onProgress('ocr', 10)
  const rawText = await extractTextWithMistralOCR(imagesBase64)
  if (onProgress) onProgress('ocr', 100)

  // 2. Synthèse avec Gemini
  if (onProgress) onProgress('synthesis', 10)
  const synthesis = await generateSynthesisWithGemini(rawText, subject, chapter)
  if (onProgress) onProgress('synthesis', 100)

  return {
    rawText,
    synthesis
  }
}
