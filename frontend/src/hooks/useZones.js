import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function useZones() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api('/zones')
      .then(({ data }) => { if (!cancelled) setZones(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return zones;
}
