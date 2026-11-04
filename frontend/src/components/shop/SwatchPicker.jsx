export default function SwatchPicker({ colours, chosen, onChoose }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour">
      {colours.map(colour => (
        <button
          key={colour}
          type="button"
          role="radio"
          className={`pill${colour === chosen ? ' on' : ''}`}
          aria-checked={colour === chosen}
          onClick={() => onChoose(colour)}
        >{colour}</button>
      ))}
    </div>
  );
}
