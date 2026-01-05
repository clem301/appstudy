import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({
  children,
  className = '',
  onClick,
  hoverable = true,
}: CardProps) {
  const Component = onClick || hoverable ? motion.div : 'div'

  return (
    <Component
      className={`glass-card p-6 ${className}`}
      onClick={onClick}
      whileHover={hoverable ? { y: -4, scale: 1.01 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </Component>
  )
}
