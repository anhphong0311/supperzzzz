import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function RequireAdmin({ children }) {
  const { role } = useAuth()
  if (role !== 'admin') return <Navigate to="/" replace />
  return children
}
