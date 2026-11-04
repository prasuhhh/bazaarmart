import { Link } from 'react-router-dom';

// Marks a page whose full design arrives in a later build step.
export default function Placeholder({ caption, title, children, linkTo, linkLabel }) {
  return (
    <section className="dashed-box placeholder-page">
      <p className="caption">{caption}</p>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {linkTo && <Link className="primary" to={linkTo}>{linkLabel}</Link>}
    </section>
  );
}
