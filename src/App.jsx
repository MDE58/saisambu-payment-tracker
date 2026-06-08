import React from 'react'
import { Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import PaymentsScreen from './screens/PaymentsScreen'
import AddEditScreen from './screens/AddEditScreen'
import ReceiptsScreen from './screens/ReceiptsScreen'
import ReportsScreen from './screens/ReportsScreen'
import SettingsScreen from './screens/SettingsScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/"         element={<HomeScreen />} />
      <Route path="/payments" element={<PaymentsScreen />} />
      <Route path="/add-edit" element={<AddEditScreen />} />
      <Route path="/receipts" element={<ReceiptsScreen />} />
      <Route path="/reports"  element={<ReportsScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  )
}
