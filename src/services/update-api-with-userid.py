#!/usr/bin/env python3
"""
Script pour ajouter le support de user_id dans api.ts
"""

# Lire le fichier original
with open('api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Ajouter import de getCurrentUserId en haut
content = content.replace(
    '''/**
 * Service API pour communiquer avec le backend Node.js
 * Permet la synchronisation des synthèses entre appareils
 */''',
    '''/**
 * Service API pour communiquer avec le backend Node.js
 * Permet la synchronisation des synthèses entre appareils
 */

import { getCurrentUserId } from './userService\''''
)

# 2. Mettre à jour fetchAllSyntheses pour inclure userId
content = content.replace(
    '''export async function fetchAllSyntheses(): Promise<SynthesisDTO[]> {
  try {
    const response = await fetch(`${API_URL}/syntheses`)''',
    '''export async function fetchAllSyntheses(): Promise<SynthesisDTO[]> {
  try {
    const userId = await getCurrentUserId()
    const response = await fetch(`${API_URL}/syntheses?userId=${userId}`)'''
)

# 3. Mettre à jour createSynthesis pour inclure userId
content = content.replace(
    '''export async function createSynthesis(synthesis: SynthesisDTO): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/syntheses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(synthesis),
    })''',
    '''export async function createSynthesis(synthesis: SynthesisDTO): Promise<void> {
  try {
    const userId = await getCurrentUserId()
    const response = await fetch(`${API_URL}/syntheses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...synthesis, userId }),
    })'''
)

# 4. Mettre à jour syncSyntheses pour inclure userId
content = content.replace(
    '''export async function syncSyntheses(since: number = 0): Promise<SynthesisDTO[]> {
  try {
    const response = await fetch(`${API_URL}/sync?since=${since}`)''',
    '''export async function syncSyntheses(since: number = 0): Promise<SynthesisDTO[]> {
  try {
    const userId = await getCurrentUserId()
    const response = await fetch(`${API_URL}/sync?since=${since}&userId=${userId}`)'''
)

# 5. Mettre à jour fetchAllBooks pour inclure userId
content = content.replace(
    '''export async function fetchAllBooks(): Promise<BookDTO[]> {
  const response = await fetch(`${API_URL}/books`)
  return await response.json()
}''',
    '''export async function fetchAllBooks(): Promise<BookDTO[]> {
  const userId = await getCurrentUserId()
  const response = await fetch(`${API_URL}/books?userId=${userId}`)
  return await response.json()
}'''
)

# 6. Mettre à jour createBook pour inclure userId
content = content.replace(
    '''export async function createBook(book: BookDTO): Promise<void> {
  await fetch(`${API_URL}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  })
}''',
    '''export async function createBook(book: BookDTO): Promise<void> {
  const userId = await getCurrentUserId()
  await fetch(`${API_URL}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...book, userId }),
  })
}'''
)

# 7. Mettre à jour fetchAllBookNotes pour inclure userId
content = content.replace(
    '''export async function fetchAllBookNotes(): Promise<BookNoteDTO[]> {
  const response = await fetch(`${API_URL}/book-notes`)
  return await response.json()
}''',
    '''export async function fetchAllBookNotes(): Promise<BookNoteDTO[]> {
  const userId = await getCurrentUserId()
  const response = await fetch(`${API_URL}/book-notes?userId=${userId}`)
  return await response.json()
}'''
)

# 8. Mettre à jour createBookNote pour inclure userId
content = content.replace(
    '''export async function createBookNote(note: BookNoteDTO): Promise<void> {
  await fetch(`${API_URL}/book-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  })
}''',
    '''export async function createBookNote(note: BookNoteDTO): Promise<void> {
  const userId = await getCurrentUserId()
  await fetch(`${API_URL}/book-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...note, userId }),
  })
}'''
)

# 9. Mettre à jour fetchAllFlashcards pour inclure userId
content = content.replace(
    '''export async function fetchAllFlashcards(): Promise<FlashcardDTO[]> {
  const response = await fetch(`${API_URL}/flashcards`)
  return await response.json()
}''',
    '''export async function fetchAllFlashcards(): Promise<FlashcardDTO[]> {
  const userId = await getCurrentUserId()
  const response = await fetch(`${API_URL}/flashcards?userId=${userId}`)
  return await response.json()
}'''
)

# 10. Mettre à jour createFlashcard pour inclure userId
content = content.replace(
    '''export async function createFlashcard(flashcard: FlashcardDTO): Promise<void> {
  await fetch(`${API_URL}/flashcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flashcard),
  })
}''',
    '''export async function createFlashcard(flashcard: FlashcardDTO): Promise<void> {
  const userId = await getCurrentUserId()
  await fetch(`${API_URL}/flashcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...flashcard, userId }),
  })
}'''
)

# Écrire le fichier mis à jour
with open('api.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('OK - api.ts a ete mis a jour avec le support de user_id')
print('   - Import de getCurrentUserId ajoute')
print('   - Toutes les fonctions fetch incluent maintenant userId')
print('   - Toutes les fonctions create envoient userId au backend')
