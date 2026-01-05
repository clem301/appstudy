# Configuration Supabase pour AppStudy

## 1. Créer les tables dans Supabase

Connecte-toi à ton projet Supabase, va dans **SQL Editor** et exécute ce script :

```sql
-- Table des synthèses
CREATE TABLE syntheses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  raw_text TEXT NOT NULL,
  html TEXT NOT NULL,
  source_images TEXT[] NOT NULL,
  page_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  flashcards_generated BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT -- Pour savoir d'où vient la synthèse
);

-- Index pour recherche rapide
CREATE INDEX idx_syntheses_date ON syntheses(date DESC);
CREATE INDEX idx_syntheses_subject ON syntheses(subject);
CREATE INDEX idx_syntheses_created_at ON syntheses(created_at DESC);

-- Table des flashcards (pour plus tard)
CREATE TABLE flashcards (
  id TEXT PRIMARY KEY,
  synthesis_id TEXT REFERENCES syntheses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  subject TEXT NOT NULL,

  -- SRS (Spaced Repetition)
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review TIMESTAMPTZ,
  last_reviewed TIMESTAMPTZ,

  -- Stats
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour flashcards
CREATE INDEX idx_flashcards_synthesis ON flashcards(synthesis_id);
CREATE INDEX idx_flashcards_next_review ON flashcards(next_review);

-- Table des tâches du planner (pour plus tard)
CREATE TABLE planner_tasks (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  type TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  for_wednesday BOOLEAN DEFAULT false,
  priority TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - Pour sécuriser plus tard avec auth
ALTER TABLE syntheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_tasks ENABLE ROW LEVEL SECURITY;

-- Politique temporaire : tout le monde peut tout faire (à sécuriser plus tard)
CREATE POLICY "Enable all for everyone" ON syntheses FOR ALL USING (true);
CREATE POLICY "Enable all for everyone" ON flashcards FOR ALL USING (true);
CREATE POLICY "Enable all for everyone" ON planner_tasks FOR ALL USING (true);
```

## 2. Récupérer les clés API

1. Va dans **Settings → API**
2. Copie :
   - **Project URL** (ex: https://xxxxx.supabase.co)
   - **anon public** key (commence par "eyJ...")

## 3. Ajouter les clés dans .env

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 4. Fonctionnement de la sync

- **Sauvegarde locale** : IndexedDB (pour offline)
- **Sauvegarde cloud** : Supabase (pour sync)
- **Stratégie** :
  - Quand tu crées une synthèse → sauvegarde locale + cloud
  - Au démarrage de l'app → récupère les synthèses du cloud
  - Détection de conflit : le plus récent gagne

## 5. Avantages

✅ Accès depuis n'importe quel appareil (téléphone, PC, tablette)
✅ Sauvegarde automatique dans le cloud
✅ Fonctionne offline (IndexedDB)
✅ Sync automatique quand connexion rétablie
✅ Gratuit jusqu'à 500 MB de stockage
