import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="not-found">
      <p className="caption">Aisle 404</p>
      <h2>This aisle doesn't exist.</h2>
      <p className="muted">The page you're looking for isn't on the floor plan. Try the GO TO box above, or head back in.</p>
      <div className="form-actions">
        <Link className="primary" to="/map">Back to the store map</Link>
        <Link className="outline" to="/zone">Browse a zone</Link>
      </div>
    </section>
  );
}
