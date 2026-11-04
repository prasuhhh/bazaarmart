import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Loads a GET path. A null path loads nothing. The last data stays visible
// while the next path loads, so filters and hovers don't flash empty.
export function useFetch(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState(current => ({ ...current, loading: true, error: null }));
    api(path)
      .then(({ data }) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(error => { if (!cancelled) setState({ data: null, loading: false, error }); });
    return () => { cancelled = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion(current => current + 1), []);
  return { ...state, reload };
}
