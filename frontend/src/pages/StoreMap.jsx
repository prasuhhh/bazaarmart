import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Conveyor from '../components/shop/Conveyor.jsx';
import FloorPlan from '../components/shop/FloorPlan.jsx';
import KitShelf from '../components/shop/KitShelf.jsx';
import PeekPanel from '../components/shop/PeekPanel.jsx';
import ShelfPicker from '../components/shop/ShelfPicker.jsx';
import { useDebounce } from '../hooks/useDebounce.js';

const PEEK_DELAY_MS = 120;

export default function StoreMap() {
  const { zones } = useOutletContext();
  const [peekCode, setPeekCode] = useState(null);
  const [saving, setSaving] = useState(null);
  const shownCode = useDebounce(peekCode, PEEK_DELAY_MS);
  const activeCode = peekCode ?? zones[0]?.code;
  const shownZone = zones.find(zone => zone.code === shownCode) ?? zones[0];

  return (
    <div className="store-map">
      <div className="map-top">
        {zones.length ? <FloorPlan zones={zones} activeCode={activeCode} onPeek={setPeekCode} /> : <p className="empty">Unlocking the store…</p>}
        <PeekPanel zone={shownZone} />
      </div>
      <Conveyor />
      <KitShelf onSave={setSaving} />
      {saving && <ShelfPicker product={saving} onClose={() => setSaving(null)} />}
    </div>
  );
}
