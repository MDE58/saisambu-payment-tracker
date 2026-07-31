import React from 'react'
import { Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import PaymentsScreen from './screens/PaymentsScreen'
import AddEditScreen from './screens/AddEditScreen'
import ReceiptsScreen from './screens/ReceiptsScreen'
import ReportsScreen from './screens/ReportsScreen'
import SettingsScreen from './screens/SettingsScreen'
import InvoicesScreen from './screens/InvoicesScreen'
import InvoiceEditScreen from './screens/InvoiceEditScreen'
import ClientsScreen from './screens/ClientsScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/"             element={<HomeScreen />} />
      <Route path="/payments"     element={<PaymentsScreen />} />
      <Route path="/add-edit"     element={<AddEditScreen />} />
      <Route path="/receipts"     element={<ReceiptsScreen />} />
      <Route path="/reports"      element={<ReportsScreen />} />
      <Route path="/settings"     element={<SettingsScreen />} />
      <Route path="/invoices"     element={<InvoicesScreen />} />
      <Route path="/invoice-edit" element={<InvoiceEditScreen />} />
      <Route path="/clients"      element={<ClientsScreen />} />
    </Routes>
  )
}
