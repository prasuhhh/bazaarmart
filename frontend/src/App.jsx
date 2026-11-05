import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './components/layout/Shell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminProducts from './pages/AdminProducts.jsx';
import BrowseZone from './pages/BrowseZone.jsx';
import Counter from './pages/Counter.jsx';
import Credits from './pages/Credits.jsx';
import NotFound from './pages/NotFound.jsx';
import Orders from './pages/Orders.jsx';
import ProductSheet, { LastProductSheet } from './pages/ProductSheet.jsx';
import Profile from './pages/Profile.jsx';
import SavedShelf from './pages/SavedShelf.jsx';
import SharedShelf from './pages/SharedShelf.jsx';
import SignIn from './pages/SignIn.jsx';
import StoreMap from './pages/StoreMap.jsx';
import TrackParcel from './pages/TrackParcel.jsx';
import { useDesignScale } from './layout/useDesignScale.js';

const FIRST_ZONE = '/zone/A';

export default function App() {
  useDesignScale();
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<StoreMap />} />
        <Route path="/zone" element={<Navigate to={FIRST_ZONE} replace />} />
        <Route path="/zone/:zoneCode" element={<BrowseZone />} />
        <Route path="/p" element={<LastProductSheet />} />
        <Route path="/p/:sku" element={<ProductSheet />} />
        <Route path="/counter" element={<Counter />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/track" element={<TrackParcel />} />
        <Route path="/track/:orderNo" element={<TrackParcel />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/s/:shareId" element={<SharedShelf />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/saved" element={<SavedShelf />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/admin/products" element={<AdminProducts />} />
        </Route>

        <Route path="/login" element={<Navigate to="/signin" replace />} />
        <Route path="/register" element={<Navigate to="/signin" replace state={{ mode: 'register' }} />} />
        <Route path="/products" element={<Navigate to={FIRST_ZONE} replace />} />
        <Route path="/cart" element={<Navigate to="/counter" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
