const apiKey = import.meta.env.VITE_MISTRAL_API_KEY

if (!apiKey) {
  console.warn('Mistral API key not found. Set VITE_MISTRAL_API_KEY in .env')
}

/**
 * Extrait le texte d'une ou plusieurs images avec Mistral OCR
 * Prix : $1 / 1000 pages ($0.001 par page) - Ultra économique !
 * Mistral OCR accepte directement le base64 : data:image/jpeg;base64,{base64}
 */
export async function extractTextWithMistralOCR(imagesBase64: string[]): Promise<string> {
  if (!apiKey) {
    throw new Error('Mistral API key not configured')
  }

  try {
    const extractedTexts: string[] = []

    for (let i = 0; i < imagesBase64.length; i++) {
      console.log(`🔍 Mistral OCR page ${i + 1}/${imagesBase64.length}...`)

      // Mistral OCR accepte directement le base64
      // Format: data:image/jpeg;base64,{base64_data}
      let imageDataUrl = imagesBase64[i]

      // Si ce n'est pas déjà au format data URL, le convertir
      if (!imageDataUrl.startsWith('data:')) {
        imageDataUrl = `data:image/jpeg;base64,${imagesBase64[i]}`
      }

      // Appel à l'API Mistral OCR avec base64 direct
      const response = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          document: {
            type: 'image_url',
            image_url: imageDataUrl,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Mistral OCR Error (page ${i + 1}):`, errorText)
        throw new Error(`Mistral OCR failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log(`📄 Réponse Mistral OCR page ${i + 1}:`, result)

      // Mistral OCR retourne le texte dans pages[0].markdown
      const pageText = result.pages?.[0]?.markdown || result.text || result.content || ''

      if (!pageText) {
        console.warn(`⚠️ Aucun texte extrait de la page ${i + 1}`)
      }

      extractedTexts.push(`\n=== PAGE ${i + 1} ===\n${pageText}`)
    }

    // Assembler tous les textes
    const fullText = extractedTexts.join('\n\n')
    console.log(`✅ Mistral OCR complet: ${imagesBase64.length} pages extraites`)
    console.log(`📊 Longueur totale: ${fullText.length} caractères`)

    return fullText
  } catch (error) {
    console.error('Mistral OCR Error:', error)
    throw new Error('Erreur lors de l\'extraction du texte avec Mistral OCR')
  }
}
