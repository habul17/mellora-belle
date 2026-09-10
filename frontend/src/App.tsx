import { Routes, Route } from "react-router-dom"
import ProductList from "./pages/ProductList"
import ProductDetail from "./pages/ProductDetail"
import AdminStock from "./pages/AdminStock"
import Login from "./pages/Login"
import Cart from "./pages/Cart"

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductList />} />
      <Route path="/products/:slug" element={<ProductDetail />} />
      <Route path="/admin" element={<AdminStock />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cart" element={<Cart />} />
    </Routes>
  )
}

export default App