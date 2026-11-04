import { useParams } from 'react-router-dom';
import Placeholder from './Placeholder.jsx';

export default function SharedShelf() {
  const { shareId } = useParams();
  return (
    <Placeholder caption={`Shelf ${shareId}`} title="Shared shelves open soon." linkTo="/map" linkLabel="Go to the store map">
      The public shelf view arrives in a later step.
    </Placeholder>
  );
}
