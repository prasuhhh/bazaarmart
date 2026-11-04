import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNotice } from './NoticeContext.jsx';

const BENCH_KEY = 'bazaarmart_bench';
const MAX_ON_BENCH = 4;
const BenchContext = createContext(null);

function readBench() {
  try {
    const skus = JSON.parse(localStorage.getItem(BENCH_KEY) || '[]');
    return Array.isArray(skus) ? skus : [];
  } catch {
    return [];
  }
}

function writeBench(skus) {
  try {
    localStorage.setItem(BENCH_KEY, JSON.stringify(skus));
  } catch {
    // The bench still works for this visit if storage is blocked.
  }
}

export function BenchProvider({ children }) {
  const [skus, setSkus] = useState(readBench);
  const { showInfo } = useNotice();

  const save = useCallback(next => {
    writeBench(next);
    setSkus(next);
  }, []);

  const toggleBench = useCallback(sku => {
    if (skus.includes(sku)) {
      save(skus.filter(entry => entry !== sku));
    } else if (skus.length >= MAX_ON_BENCH) {
      showInfo(`The bench holds ${MAX_ON_BENCH} products. Take one off first.`);
    } else {
      save([...skus, sku]);
    }
  }, [skus, save, showInfo]);

  const value = useMemo(() => ({ skus, toggleBench, isOnBench: sku => skus.includes(sku) }), [skus, toggleBench]);
  return <BenchContext.Provider value={value}>{children}</BenchContext.Provider>;
}

export const useBench = () => useContext(BenchContext);
