import React from 'react'
import { JOB_STATUS_LABEL_VI, JOB_STATUS_COLOR } from '../constants/statusMap'

export default function StatusBadge({ status }) {
  const label = JOB_STATUS_LABEL_VI[status] || status
  const color = JOB_STATUS_COLOR[status] || 'gray'
  return <span className={`badge badge-${color}`}>{label}</span>
}
