import React, { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null)
  const [staffId, setStaffId] = useState(null)
  const [staffName, setStaffName] = useState(null)
  const [needsWizard, setNeedsWizard] = useState(false)

  const value = {
    role,
    staffId,
    staffName,
    needsWizard,
    // Du nhan vien duoc nang len vai tro Admin, van giu ten that de quy trach
    // nhiem trong "Nguoi thuc hien" - chi khi dang nhap bang mat khau Admin
    // dung chung (khong co identity ca nhan) moi hien nhan chung "Quan tri vien".
    performedByLabel: staffName || 'Quản trị viên',
    login: (r, identity) => {
      setRole(r)
      if (identity) {
        setStaffId(identity.id)
        setStaffName(identity.display_name)
        setNeedsWizard(r === 'staff' && identity.wizard_completed === 0)
      } else {
        setStaffId(null)
        setStaffName(null)
        setNeedsWizard(false)
      }
    },
    dismissWizard: () => setNeedsWizard(false),
    logout: () => {
      setRole(null)
      setStaffId(null)
      setStaffName(null)
      setNeedsWizard(false)
    }
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
