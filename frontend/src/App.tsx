import { Routes, Route } from "react-router-dom"
import ProductList from "./pages/ProductList"
import ProductDetail from "./pages/ProductDetail"
import AdminStock from "./pages/AdminStock"
import Login from "./pages/Login"

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductList />} />
      <Route path="/products/:slug" element={<ProductDetail />} />
      <Route path="/admin" element={<AdminStock />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App