import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from '../auth'
import ProtectedRoute from '../components/ProtectedRoute'
import LoginScreen from '../pages/Login/LoginScreen'
import SignupScreen from '../pages/Signup/SignupScreen'
import Dashboard from '../pages/Dashboard/Dashboard'
import ModuleDetailScreen from '../pages/ModuleDetail/ModuleDetailScreen'

export default function Routes() {
  return (
    <RouterRoutes>
      <Route
        path="/"
        element={
          isAuthenticated() ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/login"
        element={
          isAuthenticated() ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginScreen />
          )
        }
      />
      <Route path="/signup" element={<SignupScreen />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/module/:moduleId"
        element={
          <ProtectedRoute>
            <ModuleDetailScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievements"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </RouterRoutes>
  )
}
