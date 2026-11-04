import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';

const SEARCH_DELAY_MS = 250;
const LISTBOX_ID = 'command-results';

function isTypingField(element) {
  return element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName);
}

const productResult = product => ({
  key: product.productId,
  label: product.productName,
  hint: product.productId,
  to: `/p/${product.productId}`
});

export default function CommandBox({ zones }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [products, setProducts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = useDebounce(text.trim(), SEARCH_DELAY_MS);

  useEffect(() => {
    function focusOnSlash(event) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingField(document.activeElement)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', focusOnSlash);
    return () => window.removeEventListener('keydown', focusOnSlash);
  }, []);

  useEffect(() => {
    if (!query) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    api(`/search?q=${encodeURIComponent(query)}`)
      .then(({ data }) => { if (!cancelled) setProducts(data); })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, [query]);

  const results = useMemo(() => {
    if (!query) return [];
    const needle = query.toLowerCase();
    const zoneMatches = zones
      .filter(zone => zone.name.toLowerCase().includes(needle))
      .map(zone => ({ key: `zone-${zone.code}`, label: zone.name, hint: `Zone ${zone.code}`, to: `/zone/${zone.code}` }));
    return [...products.map(productResult), ...zoneMatches];
  }, [query, products, zones]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  function go(result) {
    setText('');
    setProducts([]);
    setIsOpen(false);
    inputRef.current?.blur();
    navigate(result.to);
  }

  // Enter can arrive before the debounced search has run, so it searches directly.
  async function submit() {
    if (activeIndex >= 0) {
      go(results[activeIndex]);
      return;
    }
    const typed = text.trim();
    if (!typed) return;
    try {
      const { data } = await api(`/search?q=${encodeURIComponent(typed)}`);
      if (data.length) go(productResult(data[0]));
      else if (results.length) go(results[0]);
      else setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setActiveIndex(index => (index <= 0 ? results.length - 1 : index - 1));
    }
  }

  const showResults = isOpen && Boolean(query);

  return (
    <div className="command">
      <input
        ref={inputRef}
        className="command-input"
        type="text"
        role="combobox"
        value={text}
        placeholder={'GO TO · code "T-04-117" or "linen shirt"'}
        aria-label="Go to a product code or search"
        aria-expanded={showResults}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeIndex >= 0 ? `${LISTBOX_ID}-${activeIndex}` : undefined}
        autoComplete="off"
        onChange={event => { setText(event.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showResults && (
        <ul className="command-results" id={LISTBOX_ID} role="listbox" aria-label="Search results">
          {results.map((result, index) => (
            <li
              key={result.key}
              id={`${LISTBOX_ID}-${index}`}
              className="command-result"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={event => { event.preventDefault(); go(result); }}
            >
              <span>{result.label}</span>
              <small>{result.hint}</small>
            </li>
          ))}
          {!results.length && <li className="command-empty" role="option" aria-selected="false" aria-disabled="true">No matches yet.</li>}
        </ul>
      )}
    </div>
  );
}
