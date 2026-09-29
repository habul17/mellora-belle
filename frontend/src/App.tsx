import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import ProductList from "./pages/ProductList"
import ProductDetail from "./pages/ProductDetail"
import AdminStock from "./pages/AdminStock"
import AdminProducts from "./pages/AdminProducts"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Cart from "./pages/Cart"
import Checkout from "./pages/Checkout"
import Orders from "./pages/Orders"
import OrderDetail from "./pages/OrderDetail"
import AdminOrders from "./pages/AdminOrders"
import AdminSecurity from "./pages/AdminSecurity"
import Contact from "./pages/policies/Contact"
import Shipping from "./pages/policies/Shipping"
import Refunds from "./pages/policies/Refunds"
import Pricing from "./pages/policies/Pricing"
import Terms from "./pages/policies/Terms"
import Privacy from "./pages/policies/Privacy"
import NotFound from "./pages/NotFound"
import Header from "./components/Header"
import Footer from "./components/Footer"
import ScrollToTop from "./components/ScrollToTop"
import PageViewTracker from "./components/PageViewTracker"

function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <ScrollToTop />
      <Header />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<ProductList />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/admin" element={<AdminStock />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/shipping" element={<Shipping />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
      <PageViewTracker />
    </div>
  )
}

export default App
