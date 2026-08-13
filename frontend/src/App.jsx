import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import Playground from "./pages/Playground"
import Providers from "./pages/Providers"
import Teams from "./pages/Teams"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import TeamManager from "./pages/TeamManager"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/team-manager" element={<TeamManager />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
