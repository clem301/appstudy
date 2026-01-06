#!/usr/bin/env python3
"""
Script pour corriger tous les endroits où userId manque dans storage.ts
"""

# Lire le fichier original
with open('storage.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Corriger db.syntheses.put (résolution de conflit)
content = content.replace(
    '''          if (backendTime > localTime) {
            await db.syntheses.put({
              id: backendSyn.id,
              title: backendSyn.title,''',
    '''          if (backendTime > localTime) {
            const userId = await getCurrentUserId()
            await db.syntheses.put({
              id: backendSyn.id,
              userId,
              title: backendSyn.title,'''
)

# 2. Corriger db.books.add
content = content.replace(
    '''        if (!localBook) {
          await db.books.add({
            id: backendBook.id,
            title: backendBook.title,''',
    '''        if (!localBook) {
          const userId = await getCurrentUserId()
          await db.books.add({
            id: backendBook.id,
            userId,
            title: backendBook.title,'''
)

# 3. Corriger db.bookNotes.add
content = content.replace(
    '''        if (!localNote) {
          await db.bookNotes.add({
            id: backendNote.id,
            bookId: backendNote.bookId,''',
    '''        if (!localNote) {
          const userId = await getCurrentUserId()
          await db.bookNotes.add({
            id: backendNote.id,
            userId,
            bookId: backendNote.bookId,'''
)

# 4. Corriger db.flashcards.add
content = content.replace(
    '''        if (!localCard) {
          await db.flashcards.add({
            id: backendCard.id,
            synthesisId: backendCard.synthesisId,''',
    '''        if (!localCard) {
          const userId = await getCurrentUserId()
          await db.flashcards.add({
            id: backendCard.id,
            userId,
            synthesisId: backendCard.synthesisId,'''
)

# Écrire le fichier mis à jour
with open('storage.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('OK - storage.ts a ete corrige')
print('   - userId ajoute a toutes les operations db.add et db.put')
