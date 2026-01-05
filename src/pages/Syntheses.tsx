import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { getAllSyntheses, deleteSynthesis } from '../services/storage'
import type { Synthesis } from '../types/synthesis'

export function Syntheses() {
  const navigate = useNavigate()
  const [syntheses, setSyntheses] = useState<Synthesis[]>([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<'subject' | 'date'>('subject')

  useEffect(() => {
    loadSyntheses()
  }, [])

  const loadSyntheses = async () => {
    setLoading(true)
    const data = await getAllSyntheses()
    setSyntheses(data)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette synthèse ?')) {
      await deleteSynthesis(id)
      loadSyntheses()
    }
  }

  const groupedBySubject = syntheses.reduce((acc, syn) => {
    if (!acc[syn.subject]) acc[syn.subject] = []
    acc[syn.subject].push(syn)
    return acc
  }, {} as Record<string, Synthesis[]>)

  if (loading) {
    return (
      <div className="min-h-screen p-5 pb-28 flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll p-5 pb-28 safe-area-top" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="pt-6 pb-2">
          <h1 className="text-3xl font-bold text-white mb-1">Synthèses</h1>
          <p className="text-gray-400 text-sm">{syntheses.length} synthèse{syntheses.length > 1 ? 's' : ''}</p>
        </div>

        {syntheses.length === 0 ? (
          <Card className="p-8">
            <div className="text-center space-y-4">
              <div className="text-6xl">📚</div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Aucune synthèse</h2>
                <p className="text-gray-400 text-sm">
                  Scannez votre premier cours
                </p>
              </div>
              <Button
                variant="gradient"
                onClick={() => navigate('/scan')}
                className="w-full max-w-xs mx-auto"
              >
                Scanner un cours
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Toggle Group By */}
            <div className="flex gap-2">
              <button
                onClick={() => setGroupBy('subject')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  groupBy === 'subject'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                Par matière
              </button>
              <button
                onClick={() => setGroupBy('date')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  groupBy === 'date'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                Par date
              </button>
            </div>

            {/* Grouped by Subject */}
            {groupBy === 'subject' && Object.entries(groupedBySubject).map(([subject, items]) => (
              <div key={subject} className="space-y-3">
                <h2 className="text-lg font-bold text-white px-2">{subject}</h2>
                {items.map((syn) => (
                  <Card
                    key={syn.id}
                    className="p-4 cursor-pointer"
                    hoverable
                    onClick={() => navigate(`/syntheses/${syn.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{syn.title}</h3>
                        <p className="text-sm text-gray-400 truncate">{syn.chapter}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{syn.wordCount} mots</span>
                          <span>•</span>
                          <span>{new Date(syn.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(syn.id)
                        }}
                        className="text-gray-500 hover:text-red-400 transition-colors p-2"
                      >
                        🗑️
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            ))}

            {/* List by Date */}
            {groupBy === 'date' && syntheses.map((syn) => (
              <Card
                key={syn.id}
                className="p-4 cursor-pointer"
                hoverable
                onClick={() => navigate(`/syntheses/${syn.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{syn.title}</h3>
                    <p className="text-sm text-gray-400 truncate">{syn.subject} • {syn.chapter}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{syn.wordCount} mots</span>
                      <span>•</span>
                      <span>{new Date(syn.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(syn.id)
                    }}
                    className="text-gray-500 hover:text-red-400 transition-colors p-2"
                  >
                    🗑️
                  </button>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
