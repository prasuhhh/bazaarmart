import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAction } from '../../hooks/useAction.js';
import { useFetch } from '../../hooks/useFetch.js';

function QuestionRow({ question, busy, onAnswer }) {
  const [answer, setAnswer] = useState('');
  const { product } = question;

  function submit(event) {
    event.preventDefault();
    onAnswer(question, answer);
  }

  return (
    <li>
      <small>{product ? `${product.productId} · ${product.productName}` : 'Product removed'}</small>
      <p>Q: {question.text}</p>
      <form className="inline-form" onSubmit={submit}>
        <input value={answer} maxLength="1000" onChange={event => setAnswer(event.target.value)} placeholder="Write an answer" aria-label={`Answer: ${question.text}`} required />
        <button className="outline" disabled={busy || !answer.trim()}>{busy ? 'Please wait…' : 'Answer'}</button>
      </form>
    </li>
  );
}

// An answered question leaves this list and shows on its product sheet.
export default function QuestionAnswers() {
  const { data: questions, error, reload } = useFetch('/admin/questions');
  const { busy, run } = useAction();

  async function answerQuestion(question, answer) {
    if (await run(() => api(`/admin/questions/${question._id}`, { method: 'PATCH', body: { answer } }))) reload();
  }

  if (error && error.status !== 401) return <p className="empty">{error.message}</p>;
  if (!questions) return <p className="empty">Loading questions…</p>;
  if (!questions.length) return <p className="empty">Every question has an answer.</p>;

  return (
    <ul className="question-list">
      {questions.map(question => <QuestionRow key={question._id} question={question} busy={busy} onAnswer={answerQuestion} />)}
    </ul>
  );
}
