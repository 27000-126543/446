import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Simulation from '@/pages/Simulation'
import Monitor from '@/pages/Monitor'
import Alerts from '@/pages/Alerts'
import Recommendations from '@/pages/Recommendations'
import Approvals from '@/pages/Approvals'
import Reports from '@/pages/Reports'
import Performance from '@/pages/Performance'
import Models from '@/pages/Models'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/simulation/:id" element={<Simulation />} />
          <Route path="/simulation/:id/monitor" element={<Monitor />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/models" element={<Models />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
