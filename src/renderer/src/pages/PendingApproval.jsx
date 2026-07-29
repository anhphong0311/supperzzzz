import React from 'react'
import HistoryView from '../components/HistoryView.jsx'

export default function PendingApproval() {
  return (
    <HistoryView
      title="Bài chờ duyệt"
      description="Các bài đăng vào nhóm yêu cầu quản trị viên duyệt trước khi hiển thị công khai."
      initialStatus="PENDING_APPROVAL"
    />
  )
}
