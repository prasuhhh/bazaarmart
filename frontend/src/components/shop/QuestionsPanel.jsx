import { createPortal } from 'react-dom';
import { useFetch } from '../../hooks/useFetch.js';
import FeedbackForm from './FeedbackForm.jsx';

// The form sits in the row under the panels, so it renders into `formSlot`.
export default function QuestionsPanel({ sku, formSlot }) {
  const path = `/products/${encodeURIComponent(sku)}/questions`;
  const { data: questions, error, reload } = useFetch(path);

  return (
    <section className="dashed-box sheet-panel">
      <p className="caption">Q&amp;A</p>
      {error && <p className="muted">{error.message}</p>}
      {questions?.length === 0 && <p className="muted">No questions yet.</p>}
      <ul className="feedback-list">
        {questions?.map(question => (
          <li key={question._id}>
            <p>Q: {question.text}</p>
            <small>{question.answer ? `A: ${question.answer}` : 'Waiting for an answer'}</small>
          </li>
        ))}
      </ul>
      {formSlot && createPortal(
        <FeedbackForm path={path} label="Ask a question" button="Ask" signInText="Sign in to ask" onPosted={reload} />,
        formSlot
      )}
    </section>
  );
}
