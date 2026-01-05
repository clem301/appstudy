import OpenAI from 'openai'

const apiKey = import.meta.env.VITE_OPENAI_API_KEY

if (!apiKey) {
  console.warn('OpenAI API key not found. Set VITE_OPENAI_API_KEY in .env')
}

const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key',
  dangerouslyAllowBrowser: true, // Pour dev - en prod utiliser un backend
})

export interface OCRResult {
  text: string
  pageCount: number
}

export interface SynthesisResult {
  html: string
  title: string
  wordCount: number
}

/**
 * Extrait le texte d'une ou plusieurs images via GPT-4o-mini (page par page)
 * Cette approche évite les limites de tokens en traitant chaque page séparément
 */
export async function extractTextFromImages(imagesBase64: string[]): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const extractedTexts: string[] = []

    // Traiter chaque page séparément pour éviter la limite de 16K tokens
    for (let i = 0; i < imagesBase64.length; i++) {
      console.log(`OCR page ${i + 1}/${imagesBase64.length}...`)

      const content: any[] = [
        {
          type: 'text',
          text: `Tu es un assistant éducatif qui aide les étudiants. Transcris fidèlement tout le contenu textuel visible dans cette page de cours (page ${i + 1}/${imagesBase64.length}).

INSTRUCTIONS:
- Transcris TOUT le texte visible : titres, paragraphes, listes, notes
- Transcris toutes les formules mathématiques et équations (utilise notation standard)
- Transcris le contenu des tableaux avec leur structure
- Préserve la numérotation et la hiérarchie
- Transcris les exemples de calculs avec leurs valeurs numériques

IMPORTANT: C'est pour aider un étudiant à créer ses fiches de révision. Transcris absolument tout le contenu.

Format: Retourne le texte structuré exactement comme il apparaît.`,
        },
        {
          type: 'image_url',
          image_url: {
            url: imagesBase64[i],
          },
        },
      ]

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // gpt-4o-mini refuse d'extraire le texte, on doit utiliser gpt-4o
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: 16384, // Largement suffisant pour une seule page
      })

      const pageText = response.choices[0]?.message?.content || ''
      extractedTexts.push(`\n=== PAGE ${i + 1} ===\n${pageText}`)
    }

    // Assembler tous les textes extraits
    const fullText = extractedTexts.join('\n\n')
    console.log(`✅ OCR complet: ${imagesBase64.length} pages extraites`)
    console.log(`📊 Longueur totale du texte: ${fullText.length} caractères`)
    console.log(`📄 Aperçu des 500 premiers caractères:`, fullText.substring(0, 500))
    return fullText
  } catch (error) {
    console.error('OCR Error:', error)
    throw new Error('Erreur lors de l\'extraction du texte')
  }
}

/**
 * Génère une synthèse HTML à partir du texte brut
 * DÉSACTIVÉ : Utiliser generateSynthesisWithGemini() à la place
 */
export async function generateSynthesis(
  rawText: string,
  subject: string,
  chapter: string
): Promise<SynthesisResult> {
  // Cette fonction n'est plus utilisée
  // On utilise maintenant Gemini 2.5 Flash qui est plus économique et a 1M context
  throw new Error('Use generateSynthesisWithGemini() instead')
}

/**
 * Génère une synthèse HTML avec GPT-4o (ancienne version, plus utilisée)
 */
async function generateSynthesisWithGPT4o(
  rawText: string,
  subject: string,
  chapter: string
): Promise<SynthesisResult> {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    console.log(`📝 Génération de la synthèse à partir de ${rawText.length} caractères de texte...`)

    const htmlResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Tu es un expert en création de fiches de révision. Génère une fiche HTML COMPLÈTE et ULTRA-DÉTAILLÉE.

MATIÈRE : ${subject}
CHAPITRE : ${chapter}

CONTENU DU COURS (${Math.round(rawText.length / 1000)}K caractères) :
${rawText}

🎯 OBJECTIF CRITIQUE :
- Créer une synthèse EXHAUSTIVE qui couvre ABSOLUMENT TOUT le contenu
- N'OMETS AUCUNE section, définition, formule, exemple ou calcul
- Chaque page du cours doit être représentée dans la synthèse
- Les exemples de calculs avec leurs valeurs numériques doivent TOUS être inclus
- Les tableaux (ex: sources d'énergie) doivent être COMPLETS
- MINIMUM 8-12 sections numérotées pour un cours de 10 pages

STRUCTURE À RESPECTER :

<!-- EN-TÊTE AVEC BORDURE ÉPAISSE -->
<div style="border: 3px solid #000000; padding: 1.5rem; margin-bottom: 2rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
  <h1 style="margin: 0; font-size: 1.5rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #000000;">
    FICHE : TITRE DU CHAPITRE
  </h1>
</div>

<!-- SOUS-TITRE -->
<div style="margin-bottom: 2rem;">
  <h2 style="font-size: 1.8rem; font-weight: 700; margin: 0 0 0.5rem 0; border-bottom: 2px solid #000000; padding-bottom: 0.5rem; color: #000000;">
    Nom du chapitre
  </h2>
  <p style="color: #666666; font-size: 0.9rem; margin: 0;">Matière — Niveau</p>
</div>

<!-- SECTION NUMÉROTÉE -->
<div style="margin-bottom: 2.5rem;">
  <h3 style="font-size: 1.3rem; font-weight: 700; margin: 0 0 1.5rem 0; color: #000000;">
    1. NOM DE LA SECTION
  </h3>

  <!-- DÉFINITION ENCADRÉE -->
  <div style="border: 2px solid #000000; padding: 1.25rem; margin-bottom: 1rem; border-radius: 12px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
    <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #000000;">Terme à définir</h4>
    <p style="margin: 0; line-height: 1.6; color: #000000;">
      Définition courte avec <mark style="background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-weight: 600;">termes surlignés gris</mark> pour les concepts importants et <strong style="border-bottom: 2px solid #000000; padding-bottom: 1px; font-weight: 600;">termes soulignés</strong> pour les formules.
    </p>
  </div>

  <!-- FORMULE DANS DÉFINITION -->
  <div style="border: 2px solid #000000; padding: 1.25rem; margin-bottom: 1rem; border-radius: 12px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
    <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #000000;">Nom de la formule</h4>
    <p style="margin: 0 0 1rem 0; line-height: 1.6; color: #000000;">
      Explication brève avec <mark style="background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-weight: 600;">mots clés</mark>.
    </p>
    <!-- Formule encadrée -->
    <div style="border: 2px solid #000000; padding: 1rem; text-align: center; border-radius: 8px;">
      <code style="font-family: 'Courier New', monospace; font-size: 1.1rem; color: #000000; font-weight: 600;">
        formule = a + b
      </code>
    </div>
  </div>
</div>

<!-- SECTION POINTS CLÉS -->
<div style="margin-bottom: 2.5rem;">
  <h3 style="font-size: 1.3rem; font-weight: 700; margin: 0 0 1.5rem 0; color: #000000;">
    2. POINTS CLÉS
  </h3>

  <!-- BLOC AVEC BARRE LATÉRALE -->
  <div style="border-left: 5px solid #000000; padding-left: 1.25rem; margin-bottom: 1.5rem; border-radius: 4px;">
    <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #000000;">Titre des points</h4>
    <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8; color: #000000;">
      <li>Premier point avec <mark style="background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-weight: 600;">élément surligné</mark></li>
      <li>Deuxième point avec <strong style="border-bottom: 2px solid #000000; padding-bottom: 1px; font-weight: 600;">formule soulignée : x = y</strong></li>
    </ul>
  </div>

  <!-- FORMULE IMPORTANTE SEULE -->
  <div style="border: 2px solid #000000; padding: 1.5rem; text-align: center; margin: 1.5rem 0; border-radius: 12px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
    <code style="font-family: 'Courier New', monospace; font-size: 1.3rem; color: #000000; font-weight: 600;">
      formule = x + y
    </code>
    <p style="margin: 0.75rem 0 0 0; font-size: 0.85rem; color: #666666; font-style: italic;">
      Description de la formule
    </p>
  </div>
</div>

<!-- SECTION EXEMPLE -->
<div style="margin-bottom: 2.5rem;">
  <h3 style="font-size: 1.3rem; font-weight: 700; margin: 0 0 1.5rem 0; color: #000000;">
    3. EXEMPLE
  </h3>

  <div style="border: 2px solid #000000; padding: 1.25rem; background: #fafafa; border-radius: 12px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
    <p style="margin: 0; line-height: 1.6; color: #000000;">
      <strong>Problème :</strong> Énoncé du problème
    </p>
    <p style="margin: 0.75rem 0 0 0; line-height: 1.6; color: #000000;">
      <strong>Solution :</strong> Résolution étape par étape
    </p>
  </div>
</div>

<!-- TABLEAU (SI NÉCESSAIRE) -->
<div style="margin-bottom: 2.5rem;">
  <h3 style="font-size: 1.3rem; font-weight: 700; margin: 0 0 1.5rem 0; color: #000000;">
    4. TABLEAU COMPARATIF
  </h3>

  <div style="border: 2px solid #000000; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); overflow: hidden;">
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="padding: 0.75rem; text-align: left; color: #000000; font-weight: 700; font-size: 0.9rem; text-transform: uppercase; border-bottom: 2px solid #000000; border-right: 1px solid #000000;">Colonne 1</th>
          <th style="padding: 0.75rem; text-align: left; color: #000000; font-weight: 700; font-size: 0.9rem; text-transform: uppercase; border-bottom: 2px solid #000000;">Colonne 2</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 0.75rem; color: #000000; border-bottom: 1px solid #000000; border-right: 1px solid #000000;">Donnée 1</td>
          <td style="padding: 0.75rem; color: #000000; border-bottom: 1px solid #000000;"><strong>Valeur 1</strong></td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; color: #000000; background: #f9f9f9; border-right: 1px solid #000000;">Donnée 2</td>
          <td style="padding: 0.75rem; color: #000000; background: #f9f9f9;"><strong>Valeur 2</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- NOTE IMPORTANTE (SI NÉCESSAIRE) -->
<div style="border: 3px solid #000000; padding: 1rem; margin-top: 2rem; background: #f5f5f5; border-radius: 12px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
  <p style="margin: 0; font-size: 0.9rem; color: #000000; font-weight: 600;">
    ⚠️ <strong>Note importante :</strong> Information critique à retenir
  </p>
</div>

RÈGLES STRICTES :

1. STRUCTURE :
   - Titre en MAJUSCULES dans bordure épaisse (3px)
   - Sections numérotées (1., 2., 3., etc.)
   - Définitions dans des boîtes arrondies avec ombres
   - Formules en gras avec font monospace

2. MISE EN ÉVIDENCE (très important) :
   - SURLIGNAGE GRIS : <mark style="background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-weight: 600;">texte</mark> pour les termes/concepts importants
   - SOULIGNEMENT NOIR : <strong style="border-bottom: 2px solid #000000; padding-bottom: 1px; font-weight: 600;">texte</strong> pour les formules/équations dans le texte
   - Tu peux combiner les deux selon l'importance : surlignage pour concepts, soulignement pour termes techniques/formules

3. FORMULES :
   - Formules dans <code> avec font-weight: 600
   - Encadrées avec border: 2px solid #000000 et border-radius: 8px
   - Font: 'Courier New', monospace

4. COULEURS :
   - Texte principal : #000000 (noir)
   - Sous-titre : #666666 (gris moyen)
   - Fond surlignage : #e8e8e8 (gris très clair)
   - Fond exemple : #fafafa (presque blanc)
   - Fond note : #f5f5f5 (gris très léger)

5. ARRONDIS ET OMBRES :
   - border-radius: 12px pour les boîtes principales
   - border-radius: 8px pour les formules
   - box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08) pour toutes les boîtes

6. CONTENU :
   - SOIS COMPLET : Inclus TOUS les concepts, définitions, formules et exemples du cours
   - Pour chaque section du cours, crée une section numérotée dans la synthèse
   - Inclus TOUS les calculs et exemples détaillés présents dans le cours
   - N'omets AUCUNE formule ou concept important
   - Utilise des tableaux pour les comparaisons/listes de sources d'énergie, etc.
   - Sections claires et numérotées
   - Termes importants toujours surlignés en gris

7. PAS DE :
   - Balises <html>, <head>, <body>
   - Fonds colorés (sauf gris clair #e8e8e8, #f9f9f9, #fafafa, #f5f5f5)

GÉNÈRE maintenant la synthèse en respectant EXACTEMENT cette structure et ces règles.`,
        },
      ],
      max_tokens: 16000, // GPT-4o output limit (on demande le maximum)
    })

    const html = htmlResponse.choices[0]?.message?.content || ''

    // Extraire le titre
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : chapter

    // Compter les mots
    const textContent = html.replace(/<[^>]*>/g, ' ')
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length

    return {
      html,
      title,
      wordCount,
    }
  } catch (error) {
    console.error('Synthesis Error:', error)
    throw new Error('Erreur lors de la génération de la synthèse')
  }
}

/**
 * Process complet : OCR (Mistral OCR) + Synthèse (Gemini 2.5 Flash)
 * Architecture ultra-économique : $0.01 OCR + $0.005 synthèse = $0.015/scan
 */
export async function processImage(
  imagesBase64: string | string[],
  subject: string,
  chapter: string,
  onProgress?: (stage: 'ocr' | 'synthesis', progress: number) => void
): Promise<{ rawText: string; synthesis: SynthesisResult }> {
  // Normaliser en tableau
  const images = Array.isArray(imagesBase64) ? imagesBase64 : [imagesBase64]

  // Étape 1 : OCR avec Mistral OCR ($0.001/page via imgbb gratuit + Mistral OCR)
  onProgress?.('ocr', 0)
  const { extractTextWithMistralOCR } = await import('./mistral')
  const rawText = await extractTextWithMistralOCR(images)
  onProgress?.('ocr', 100)

  // Étape 2 : Synthèse avec Gemini 2.5 Flash (1M context, ultra rapide)
  onProgress?.('synthesis', 0)
  const { generateSynthesisWithGemini } = await import('./gemini')
  const synthesis = await generateSynthesisWithGemini(rawText, subject, chapter)
  onProgress?.('synthesis', 100)

  return { rawText, synthesis }
}
