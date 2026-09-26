import { Routes, Route } from "react-router-dom"
import ProductList from "./pages/ProductList"
import ProductDetail from "./pages/ProductDetail"
import AdminStock from "./pages/AdminStock"
import Login from "./pages/Login"
import Cart from "./pages/Cart"
import Checkout from "./pages/Checkout"
import Orders from "./pages/Orders"
import OrderDetail from "./pages/OrderDetail"
import AdminOrders from "./pages/AdminOrders"
import Contact from "./pages/policies/Contact"
import Shipping from "./pages/policies/Shipping"
import Refunds from "./pages/policies/Refunds"
import Pricing from "./pages/policies/Pricing"
import Terms from "./pages/policies/Terms"
import Privacy from "./pages/policies/Privacy"
import Header from "./components/Header"
import Footer from "./components/Footer"

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/admin" element={<AdminStock />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
      <Footer />
    </>
  )
}

export default App
