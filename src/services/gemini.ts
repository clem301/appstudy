import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  console.warn('Gemini API key not found. Set VITE_GEMINI_API_KEY in .env')
}

const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key')

export interface SynthesisResult {
  html: string
  title: string
  wordCount: number
}

export interface GeneratedFlashcard {
  question: string
  answer: string
  explanation?: string
}

/**
 * Génère une synthèse HTML complète avec Gemini 2.5 Flash
 * Avantages: 1M context, ultra rapide (372 tok/s), ultra économique
 */
export async function generateSynthesisWithGemini(
  rawText: string,
  subject: string,
  chapter: string
): Promise<SynthesisResult> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`📝 Génération de la synthèse avec Gemini 2.5 Flash...`)
    console.log(`📊 Texte à traiter: ${rawText.length} caractères`)

    // Utiliser Gemini 2.5 Flash (gemini-2.0-flash)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 8192, // Maximum pour Gemini Flash
        temperature: 0.7,
      }
    })

    const prompt = `Tu es un expert en création de fiches de révision. Génère une fiche HTML COMPLÈTE et ULTRA-DÉTAILLÉE.

MATIÈRE : ${subject}
CHAPITRE : ${chapter}

CONTENU DU COURS (${Math.round(rawText.length / 1000)}K caractères) :
${rawText}

🎯 OBJECTIF CRITIQUE :
- Créer une synthèse EXHAUSTIVE qui couvre ABSOLUMENT TOUT le contenu du cours fourni
- N'OMETS AUCUNE section, définition, formule, exemple ou calcul présent dans le cours
- Chaque page du cours doit être représentée dans la synthèse
- Les exemples de calculs avec leurs valeurs numériques doivent TOUS être inclus
- Les tableaux (ex: sources d'énergie) doivent être COMPLETS
- MINIMUM 8-12 sections numérotées pour un cours de 10 pages

⚠️ RÈGLE ABSOLUE :
- N'INVENTE AUCUN exemple, formule ou contenu qui n'est pas dans le cours
- Utilise UNIQUEMENT les informations présentes dans le texte fourni ci-dessus
- Ne crée PAS d'exemples génériques - utilise SEULEMENT ceux du cours
- Si le cours donne un exemple précis (ex: balle de 1kg à 40m), utilise CET exemple exact
- Les exemples dans la structure ci-dessous sont juste des TEMPLATES de mise en forme, remplace-les par le contenu réel

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

RÈGLES STRICTES :

1. STRUCTURE :
   - Titre en MAJUSCULES dans bordure épaisse (3px)
   - Sections numérotées (1., 2., 3., etc.)
   - Définitions dans des boîtes arrondies avec ombres
   - Formules en gras avec font monospace

2. MISE EN ÉVIDENCE (très important) :
   - SURLIGNAGE GRIS : <mark style="background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-weight: 600;">texte</mark> pour les termes/concepts importants
   - SOULIGNEMENT NOIR : <strong style="border-bottom: 2px solid #000000; padding-bottom: 1px; font-weight: 600;">texte</strong> pour les formules/équations dans le texte

3. FORMULES :
   - Formules dans <code> avec font-weight: 600
   - Encadrées avec border: 2px solid #000000 et border-radius: 8px
   - Font: 'Courier New', monospace

4. COULEURS :
   - Texte principal : #000000 (noir)
   - Sous-titre : #666666 (gris moyen)
   - Fond surlignage : #e8e8e8 (gris très clair)
   - Fond exemple : #fafafa (presque blanc)

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
   - Balises <img> pour les symboles mathématiques
   - Balises markdown (génère UNIQUEMENT du HTML pur, sans enveloppe de code)

8. SYMBOLES MATHÉMATIQUES :
   - Utilise UNIQUEMENT du texte Unicode pour les symboles mathématiques
   - ℝ pour les réels (U+211D)
   - ℕ pour les naturels (U+2115)
   - → pour les flèches (U+2192)
   - ∞ pour l'infini (U+221E)
   - ± pour plus-moins (U+00B1)
   - × pour multiplication (U+00D7)
   - ÷ pour division (U+00F7)
   - ≤ ≥ pour inégalités (U+2264, U+2265)
   - Ne JAMAIS utiliser de balises <img> pour ces symboles

9. GRAPHIQUES ET SCHÉMAS :
   - Quand le cours mentionne un graphique ou schéma, créer un ESPACE RÉSERVÉ élégant
   - Ne JAMAIS essayer de recréer le graphique en SVG (tu n'as pas accès à l'image originale)
   - Ne JAMAIS écrire "Voir image... (non incluse ici)"
   - Utiliser à la place un espace réservé stylisé avec une description textuelle précise
   - Exemple d'espace réservé pour graphique :

   <div style="border: 2px dashed #999999; padding: 2rem; border-radius: 12px; margin: 1.5rem 0; background: #f9f9f9; text-align: center;">
     <p style="color: #666666; font-size: 0.95rem; margin: 0; line-height: 1.6;">
       <strong>📊 Graphique :</strong> [Description textuelle précise du graphique mentionné dans le cours]
     </p>
   </div>

GÉNÈRE maintenant la synthèse en respectant EXACTEMENT cette structure et ces règles.`

    const result = await model.generateContent(prompt)
    const response = result.response
    let html = response.text()

    // Post-traitement: Nettoyer le HTML
    // 1. Supprimer les balises markdown code blocks (```html et ```)
    html = html.replace(/```html\s*/gi, '')
    html = html.replace(/```\s*$/gi, '')
    html = html.replace(/```/g, '')

    // 2. Supprimer les balises <img> vides (symboles mathématiques mal interprétés)
    html = html.replace(/<img[^>]*>/gi, '')

    // 3. Nettoyer les espaces en début/fin
    html = html.trim()

    console.log(`✅ Synthèse générée: ${html.length} caractères`)

    // Extraire le titre
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').replace('FICHE : ', '').trim() : chapter

    // Compter les mots
    const textContent = html.replace(/<[^>]*>/g, ' ')
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length

    return {
      html,
      title,
      wordCount,
    }
  } catch (error) {
    console.error('Gemini Synthesis Error:', error)
    throw new Error('Erreur lors de la génération de la synthèse avec Gemini')
  }
}

/**
 * Génère des flashcards à partir d'une synthèse HTML
 * Utilise Gemini 2.5 Flash pour extraire les concepts clés
 */
export async function generateFlashcardsFromSynthesis(
  synthesisHtml: string,
  subject: string,
  chapter: string
): Promise<GeneratedFlashcard[]> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  try {
    console.log(`🎴 Génération de flashcards avec Gemini 2.5 Flash...`)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.8,
      }
    })

    // Extraire le texte brut du HTML pour faciliter l'analyse
    const textContent = synthesisHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const prompt = `Tu es un expert en création de flashcards pour l'apprentissage actif. Génère des flashcards de haute qualité à partir de cette synthèse de cours.

MATIÈRE : ${subject}
CHAPITRE : ${chapter}

SYNTHÈSE DU COURS :
${textContent.substring(0, 15000)} ${textContent.length > 15000 ? '...' : ''}

🎯 OBJECTIFS :
- Créer 10 à 15 flashcards optimisées pour la mémorisation
- Couvrir TOUS les concepts importants, définitions, et formules
- Questions claires et précises
- Réponses concises mais complètes
- Explications pour faciliter la compréhension

📋 TYPES DE FLASHCARDS À CRÉER :

1. DÉFINITIONS (3-5 cartes)
   Question: "Qu'est-ce que [concept] ?"
   Réponse: Définition précise
   Explication: Exemple ou contexte d'utilisation

2. FORMULES (2-4 cartes si applicable)
   Question: "Quelle est la formule de [concept] ?"
   Réponse: La formule exacte
   Explication: Signification des variables et cas d'usage

3. CONCEPTS CLÉS (3-5 cartes)
   Question: "Pourquoi/Comment [processus] ?"
   Réponse: Explication du mécanisme
   Explication: Lien avec d'autres concepts

4. APPLICATION (2-3 cartes)
   Question: "Comment calculer/résoudre [problème pratique] ?"
   Réponse: Méthode ou démarche
   Explication: Exemple concret si disponible

⚠️ RÈGLES STRICTES :

1. QUESTIONS :
   - Courtes et directes (max 100 caractères)
   - Commencer par un mot interrogatif (Qu'est-ce que, Quelle, Comment, Pourquoi)
   - Une seule question par carte
   - Éviter les questions trop vagues ou trop spécifiques

2. RÉPONSES :
   - Concises (2-4 lignes maximum)
   - Précises et exactes
   - Pas de HTML, juste du texte brut
   - Inclure les formules en notation Unicode si nécessaire

3. EXPLICATIONS (optionnel mais recommandé) :
   - Contexte supplémentaire ou exemple
   - Lien avec d'autres concepts
   - Astuce mnémotechnique si pertinent
   - 1-2 phrases maximum

4. FORMAT DE SORTIE :
   - RETOURNE UNIQUEMENT UN TABLEAU JSON valide
   - PAS de texte avant ou après le JSON
   - PAS de markdown, PAS de \`\`\`json
   - Structure exacte :

[
  {
    "question": "Question claire et précise ?",
    "answer": "Réponse concise et complète.",
    "explanation": "Contexte ou exemple pour mieux comprendre."
  },
  {
    "question": "Autre question ?",
    "answer": "Autre réponse.",
    "explanation": "Autre explication optionnelle."
  }
]

GÉNÈRE maintenant les flashcards au format JSON strict (tableau uniquement, sans aucun texte autour).`

    const result = await model.generateContent(prompt)
    const response = result.response
    let jsonText = response.text().trim()

    // Nettoyer le texte pour extraire uniquement le JSON
    // Supprimer les balises markdown si présentes
    jsonText = jsonText.replace(/```json\s*/gi, '')
    jsonText = jsonText.replace(/```\s*/g, '')

    // Trouver le tableau JSON dans la réponse
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Format de réponse invalide: aucun tableau JSON trouvé')
    }

    const flashcards = JSON.parse(jsonMatch[0]) as GeneratedFlashcard[]

    // Validation
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      throw new Error('Aucune flashcard générée')
    }

    // Vérifier que chaque flashcard a les champs requis
    flashcards.forEach((card, index) => {
      if (!card.question || !card.answer) {
        throw new Error(`Flashcard ${index + 1} invalide: question ou réponse manquante`)
      }
    })

    console.log(`✅ ${flashcards.length} flashcards générées avec succès`)
    return flashcards

  } catch (error) {
    console.error('Gemini Flashcard Generation Error:', error)
    if (error instanceof SyntaxError) {
      throw new Error('Erreur de format dans la réponse de Gemini')
    }
    throw new Error('Erreur lors de la génération des flashcards')
  }
}
