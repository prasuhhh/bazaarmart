import { useFetch } from '../../hooks/useFetch.js';
import FeedbackForm from './FeedbackForm.jsx';

const RATINGS = [5, 4, 3, 2, 1];
const stars = rating => '★'.repeat(rating) + '☆'.repeat(5 - rating);

export default function OwnerNotes({ sku }) {
  const path = `/products/${encodeURIComponent(sku)}/reviews`;
  const { data: reviews, error, reload } = useFetch(path);

  return (
    <section className="dashed-box sheet-panel">
      <p className="caption">Owner notes (reviews)</p>
      {error && <p className="muted">{error.message}</p>}
      {reviews?.length === 0 && <p className="muted">No owner notes yet.</p>}
      <ul className="feedback-list">
        {reviews?.map(review => (
          <li key={review._id}>
            <small><span aria-label={`${review.rating} out of 5`}>{stars(review.rating)}</span> · {review.user?.username ?? 'Member'}</small>
            <p>{review.text}</p>
          </li>
        ))}
      </ul>
      <FeedbackForm path={path} label="Write a note" button="Post note" signInText="Sign in to leave a note" onPosted={reload}>
        <select name="rating" aria-label="Rating" defaultValue="5">
          {RATINGS.map(rating => <option key={rating} value={rating}>{stars(rating)}</option>)}
        </select>
      </FeedbackForm>
    </section>
  );
}
