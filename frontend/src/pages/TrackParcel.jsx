import { useParams } from 'react-router-dom';
import Placeholder from './Placeholder.jsx';

export default function TrackParcel() {
  const { orderNo } = useParams();
  if (!orderNo) {
    return (
      <Placeholder caption="Track parcel" title="No live parcel right now." linkTo="/orders" linkLabel="See your orders">
        When an order is on its way, you can follow it from here.
      </Placeholder>
    );
  }
  return (
    <Placeholder caption="Track parcel" title={`#${orderNo}`} linkTo="/orders" linkLabel="See your orders">
      The route map and delivery journey arrive in a later step.
    </Placeholder>
  );
}
