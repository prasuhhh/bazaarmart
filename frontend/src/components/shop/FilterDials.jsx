import { Fragment, useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../formatPrice.js';
import Dial from '../ui/Dial.jsx';

const SLIDE_DELAY_MS = 250;
const PRICE_STEP = 50;
const USES = ['gym', 'commute', 'studio'];
const VIEWS = ['shelf', 'list', 'bench'];

function BudgetDial({ floor, ceiling, filters }) {
  const chosenMin = Number(filters.get('minPrice')) || floor;
  const chosenMax = Number(filters.get('maxPrice')) || ceiling;
  const [range, setRange] = useState({ min: chosenMin, max: chosenMax });
  const timer = useRef(null);

  useEffect(() => { setRange({ min: chosenMin, max: chosenMax }); }, [chosenMin, chosenMax]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function slide(next) {
    setRange(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => filters.setFilters({
      minPrice: next.min > floor ? next.min : null,
      maxPrice: next.max < ceiling ? next.max : null
    }), SLIDE_DELAY_MS);
  }

  const sliderProps = { type: 'range', min: floor, max: ceiling, step: PRICE_STEP };
  return (
    <Dial label="Budget ⟷ Premium" isActive={Boolean(filters.get('minPrice') || filters.get('maxPrice'))}>
      <p className="dial-value">{formatPrice(range.min)} – {formatPrice(range.max)}</p>
      <label className="slider">From
        <input {...sliderProps} value={range.min} onChange={event => slide({ ...range, min: Math.min(Number(event.target.value), range.max) })} />
      </label>
      <label className="slider">To
        <input {...sliderProps} value={range.max} onChange={event => slide({ ...range, max: Math.max(Number(event.target.value), range.min) })} />
      </label>
    </Dial>
  );
}

function CheckList({ name, options, filters }) {
  const chosen = filters.listOf(name);
  return (
    <div className="dial-options">
      {options.map(option => (
        <label key={option}>
          <input type="checkbox" checked={chosen.includes(option)} onChange={() => filters.toggleInList(name, option)} />
          {option}
        </label>
      ))}
    </div>
  );
}

function InlineChoices({ label, ariaLabel = label, options, separator, labelOf = option => option, isOn, onPick }) {
  return (
    <div className="pill inline-pill" role="group" aria-label={ariaLabel}>
      {label && <span>{label}</span>}
      {options.map((option, index) => (
        <Fragment key={option}>
          {index > 0 && <span className="separator" aria-hidden="true">{separator}</span>}
          <button type="button" className={isOn(option) ? 'on' : ''} aria-pressed={isOn(option)} onClick={() => onPick(option)}>{labelOf(option)}</button>
        </Fragment>
      ))}
    </div>
  );
}

const capitalise = word => word[0].toUpperCase() + word.slice(1);
const unique = values => [...new Set(values.filter(Boolean))].sort();

// The options come from the whole zone, so a choice doesn't hide the others.
export default function FilterDials({ zoneProducts, filters, benchCount }) {
  const prices = zoneProducts.map(product => product.productPrice);
  const floor = Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP;
  const ceiling = Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP;
  const links = ['wired', 'wireless'].filter(link => zoneProducts.some(product => product.connectivity === link));
  const uses = USES.filter(use => zoneProducts.some(product => product.use?.includes(use)));
  const brands = unique(zoneProducts.map(product => product.brand));
  const colours = unique(zoneProducts.flatMap(product => product.colours ?? []));
  const chosenLink = filters.get('connectivity');
  const isBench = filters.view === 'bench';

  return (
    <div className="dials">
      {!isBench && zoneProducts.length > 0 && (
        <>
          {ceiling > floor && <BudgetDial floor={floor} ceiling={ceiling} filters={filters} />}
          {links.length > 1 && (
            <InlineChoices ariaLabel="Connection" options={links} separator="/" labelOf={capitalise} isOn={link => chosenLink === link}
              onPick={link => filters.setFilters({ connectivity: chosenLink === link ? null : link })} />
          )}
          {uses.length > 0 && (
            <InlineChoices label="Use:" options={uses} separator="·" isOn={use => filters.listOf('use').includes(use)}
              onPick={use => filters.toggleInList('use', use)} />
          )}
          {brands.length > 0 && (
            <Dial label="Brand" isActive={filters.listOf('brand').length > 0}><CheckList name="brand" options={brands} filters={filters} /></Dial>
          )}
          {colours.length > 0 && (
            <Dial label="Colour" isActive={filters.listOf('colour').length > 0}><CheckList name="colour" options={colours} filters={filters} /></Dial>
          )}
          {filters.hasFilters && <button type="button" className="link-button" onClick={filters.clearFilters}>Clear dials</button>}
        </>
      )}
      <div className="dial-view">
        <InlineChoices label="View:" options={VIEWS} separator="|" isOn={view => filters.view === view}
          onPick={view => filters.setFilters({ view: view === 'shelf' ? null : view })} />
        {benchCount > 0 && !isBench && <small className="muted">{benchCount} on bench</small>}
      </div>
    </div>
  );
}
