import { BrowserRouter, Routes, Route } from "react-router-dom"
import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import Playground from "./pages/Playground"
import Providers from "./pages/Providers"
import Teams from "./pages/Teams"

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/teams" element={<Teams />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
