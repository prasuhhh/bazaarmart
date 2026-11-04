import Placeholder from './Placeholder.jsx';

export default function NotFound() {
  return (
    <Placeholder caption="404" title="This aisle doesn't exist." linkTo="/map" linkLabel="Back to the store map">
      The page you're looking for isn't on the floor plan.
    </Placeholder>
  );
}
