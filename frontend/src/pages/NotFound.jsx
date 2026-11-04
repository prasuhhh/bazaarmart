import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="intro">
      <span className="eyebrow">404</span>
      <h2>Page not found.</h2>
      <p>The page you're looking for doesn't exist.</p>
      <div className="hero-actions"><Link className="primary" to="/">Back to home</Link></div>
    </section>
  );
}
