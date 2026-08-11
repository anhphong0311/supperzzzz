const crypto = require('crypto')

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex')
    const candidateBuf = Buffer.from(candidate, 'hex')
    const hashBuf = Buffer.from(hash, 'hex')
    if (candidateBuf.length !== hashBuf.length) return false
    return crypto.timingSafeEqual(candidateBuf, hashBuf)
  } catch {
    return false
  }
}

module.exports = { hashPassword, verifyPassword }
