import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { processImage } from '../services/openai'
import { saveSynthesis } from '../services/storage'

type Step = 'upload' | 'capture' | 'metadata' | 'processing' | 'success'
type ProcessStage = 'ocr' | 'synthesis'

export function Scanner() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [images, setImages] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [chapter, setChapter] = useState('')
  const [processing, setProcessing] = useState(false)
  const [stage, setStage] = useState<ProcessStage>('ocr')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [synthesisId, setSynthesisId] = useState<string | null>(null)

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Limiter à 25 images
    const fileArray = Array.from(files).slice(0, 25)

    // Vérifier que ce sont des images
    const invalidFiles = fileArray.filter(file => !file.type.startsWith('image/'))
    if (invalidFiles.length > 0) {
      setError('Veuillez sélectionner uniquement des images')
      return
    }

    try {
      // Convertir toutes les images en base64
      const base64Images = await Promise.all(
        fileArray.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (event) => resolve(event.target?.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        })
      )

      setImages(base64Images)
      setStep('metadata')
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des images')
    }
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image')
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setImages(prev => [...prev, base64])
        setError(null)
        // Reset l'input pour permettre une nouvelle photo
        e.target.value = ''

        // Réouvrir automatiquement l'appareil photo si moins de 25 photos
        if (images.length < 24) { // 24 car on vient d'en ajouter une qui sera dans images au prochain render
          setTimeout(() => {
            fileInputRef.current?.click()
          }, 300)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Erreur lors du chargement de l\'image')
    }
  }

  const handleStartCapture = () => {
    setStep('capture')
    setImages([])
  }

  const handleFinishCapture = () => {
    if (images.length === 0) {
      setError('Prenez au moins une photo')
      return
    }
    setStep('metadata')
  }

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcess = async () => {
    if (images.length === 0 || !subject || !chapter) {
      setError('Veuillez remplir tous les champs')
      return
    }

    setProcessing(true)
    setStep('processing')
    setError(null)

    try {
      const result = await processImage(
        images, // Passer toutes les images
        subject,
        chapter,
        (currentStage, currentProgress) => {
          setStage(currentStage)
          setProgress(currentProgress)
        }
      )

      // Sauvegarder dans IndexedDB
      const id = await saveSynthesis({
        title: result.synthesis.title,
        subject,
        chapter,
        date: new Date(),
        rawText: result.rawText,
        html: result.synthesis.html,
        sourceImages: images, // Sauvegarder toutes les images
        pageCount: images.length,
        wordCount: result.synthesis.wordCount,
        flashcardsGenerated: false,
        tags: [],
      })

      setSynthesisId(id)
      setStep('success')
    } catch (err) {
      console.error('Erreur complète:', err)
      let errorMessage = 'Une erreur est survenue'

      if (err instanceof Error) {
        errorMessage = err.message
        // Afficher plus de détails si disponible
        if ('response' in err) {
          const response = (err as any).response
          errorMessage += `\n\nDétails: ${JSON.stringify(response?.data || response)}`
        }
      }

      setError(errorMessage)
      setStep('metadata')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll p-5 pb-28 safe-area-top" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="pt-6 pb-2">
          <h1 className="text-3xl font-bold text-white mb-1">Scanner un cours</h1>
          <p className="text-gray-400 text-sm">OCR + Synthèse automatique</p>
        </div>

        {error && (
          <Card className="p-4 bg-red-500/20 border-red-500/50">
            <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
          </Card>
        )}

        {/* Étape 1 : Upload */}
        {step === 'upload' && (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="text-6xl">📸</div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Scanner un cours</h2>
                <p className="text-gray-400 text-sm">
                  Jusqu'à 25 pages en une fois
                </p>
              </div>

              {/* Bouton appareil photo - mode continu */}
              <button
                onClick={handleStartCapture}
                className="gradient-button w-full"
              >
                📷 Prendre des photos
              </button>

              {/* Bouton galerie */}
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryUpload}
                  className="hidden"
                />
                <div className="glass-button w-full cursor-pointer">
                  🖼️ Choisir depuis la galerie
                </div>
              </label>
            </div>
          </Card>
        )}

        {/* Étape 1.5 : Capture continue */}
        {step === 'capture' && (
          <>
            <Card className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-3">📸</div>
                <h2 className="text-xl font-bold text-white mb-1">Prends tes photos</h2>
                <p className="text-gray-400 text-sm">
                  {images.length}/25 page{images.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Bouton prendre photo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
                disabled={images.length >= 25}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 25}
                className={`gradient-button w-full ${images.length >= 25 ? 'opacity-50' : ''}`}
              >
                📷 Prendre une photo ({images.length}/25)
              </button>

              {/* Preview miniatures */}
              {images.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">
                      {images.length === 1 ? '1 photo prise' : `${images.length} photos prises`}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-blue-400 hover:text-blue-300"
                      disabled={images.length >= 25}
                    >
                      + Continuer
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-800/50 rounded-lg">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-16 object-cover rounded"
                        />
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 rounded-full"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1">
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="glass"
                  onClick={() => {
                    setStep('upload')
                    setImages([])
                  }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleFinishCapture}
                  disabled={images.length === 0}
                  className="flex-1"
                >
                  Terminer ({images.length})
                </Button>
              </div>
            </Card>
          </>
        )}

        {/* Étape 2 : Métadonnées */}
        {step === 'metadata' && images.length > 0 && (
          <>
            {/* Preview des images */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {images.length} page{images.length > 1 ? 's' : ''} sélectionnée{images.length > 1 ? 's' : ''}
                </h3>
                <button
                  onClick={() => setStep('capture')}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  📷 Modifier
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">Informations</h2>

              <Input
                label="Matière"
                placeholder="Ex: Mathématiques, Biologie..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              <Input
                label="Chapitre"
                placeholder="Ex: Les dérivées, La photosynthèse..."
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  variant="glass"
                  onClick={() => {
                    setStep('upload')
                    setImages([])
                  }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleProcess}
                  disabled={!subject || !chapter || images.length === 0}
                  className="flex-1"
                >
                  Générer
                </Button>
              </div>
            </Card>
          </>
        )}

        {/* Étape 3 : Processing */}
        {step === 'processing' && (
          <Card className="p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="text-5xl animate-pulse">
                {stage === 'ocr' ? '👁️' : '🧠'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {stage === 'ocr' ? 'Extraction du texte...' : 'Génération de la synthèse...'}
                </h2>
                <p className="text-gray-400 text-sm">
                  {stage === 'ocr' ? `GPT-4o lit ${images.length} page${images.length > 1 ? 's' : ''}` : 'o3-mini structure le contenu'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-primary h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-gray-400 text-xs">{progress}%</p>
            </div>
          </Card>
        )}

        {/* Étape 4 : Succès */}
        {step === 'success' && synthesisId && (
          <Card className="p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="text-6xl">✅</div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Synthèse créée !</h2>
                <p className="text-gray-400 text-sm">
                  Votre cours a été analysé
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button
                  variant="glass"
                  onClick={() => navigate(`/syntheses`)}
                  className="w-full"
                >
                  Voir
                </Button>
                <Button
                  variant="gradient"
                  onClick={() => {
                    setStep('upload')
                    setImages([])
                    setSubject('')
                    setChapter('')
                    setSynthesisId(null)
                  }}
                  className="w-full"
                >
                  Nouveau
                </Button>
              </div>

              <button
                onClick={() => navigate('/')}
                className="text-gray-400 text-sm underline mt-2"
              >
                Accueil
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
