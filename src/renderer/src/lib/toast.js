// Pub-sub toast don gian, khong can them thu vien ngoai.
const listeners = new Set()
let idCounter = 0

function emit(message, type) {
  const id = ++idCounter
  listeners.forEach((fn) => fn({ id, message, type }))
}

export const toast = {
  info: (message) => emit(message, 'info'),
  error: (message) => emit(message, 'error'),
  subscribe: (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
