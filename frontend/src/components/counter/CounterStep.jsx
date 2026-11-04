export default function CounterStep({ number, title, summary, isDone, isOpen, onOpen, children }) {
  return (
    <section className={`counter-step${isOpen ? ' open' : ''}`}>
      <span className="step-number" aria-hidden="true">{number}</span>
      <div className="step-body">
        <button type="button" className="step-head" aria-expanded={isOpen} onClick={onOpen}>
          <h3>{title}</h3>
          {!isOpen && <span className="muted">{summary}{isDone && ' (change)'}</span>}
        </button>
        {isOpen && <div className="step-content">{children}</div>}
      </div>
    </section>
  );
}
