export interface User {
  id: string
  name: string
  avatar?: string
  color: string // Couleur du profil pour la différenciation visuelle
  createdAt: Date
  lastActive: Date
}
