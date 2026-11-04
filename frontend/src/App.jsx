import { Route, Routes } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import Notice from './components/Notice.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminProducts from './pages/AdminProducts.jsx';
import Cart from './pages/Cart.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import Orders from './pages/Orders.jsx';
import Products from './pages/Products.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Notice />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/products" element={<Products />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/products" element={<AdminProducts />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
