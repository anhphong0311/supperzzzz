import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'

export default function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    return toast.subscribe((item) => {
      setItems((prev) => [...prev, item])
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      }, 4500)
    })
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100 }}>
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.type === 'error' ? 'error' : ''}`} style={{ position: 'static' }}>
          {item.message}
        </div>
      ))}
    </div>
  )
}
