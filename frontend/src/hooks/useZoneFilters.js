import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const FILTER_KEYS = ['minPrice', 'maxPrice', 'connectivity', 'use', 'brand', 'colour'];

// The URL is the only copy of the filters, so a filtered zone can be shared or reloaded.
export function useZoneFilters() {
  const [params, setParams] = useSearchParams();

  const setFilters = useCallback(changes => {
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const listOf = useCallback(key => (params.get(key) ?? '').split(',').filter(Boolean), [params]);

  const toggleInList = useCallback((key, value) => {
    const list = listOf(key);
    const next = list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];
    setFilters({ [key]: next.join(',') });
  }, [listOf, setFilters]);

  const clearFilters = useCallback(() => {
    setFilters(Object.fromEntries(FILTER_KEYS.map(key => [key, null])));
  }, [setFilters]);

  const apiQuery = useMemo(() => {
    const query = new URLSearchParams();
    for (const key of [...FILTER_KEYS, 'bay']) if (params.get(key)) query.set(key, params.get(key));
    return query.toString();
  }, [params]);

  return {
    apiQuery,
    bay: params.get('bay'),
    view: params.get('view') ?? 'shelf',
    hasFilters: FILTER_KEYS.some(key => params.get(key)),
    get: key => params.get(key),
    listOf,
    setFilters,
    toggleInList,
    clearFilters
  };
}
