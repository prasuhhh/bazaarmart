import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';

export default function Credits() {
  const { data: credits, error } = useFetch('/credits');
  return (
    <section className="credits">
      <p className="muted credits-note">
        Brand and product names are trademarks of their owners. Openly licensed photos are credited below.
        Brand images are used only for a non-commercial student lab demo.
      </p>
      {error && <p className="empty">{error.message}</p>}
      {credits && (
        <table>
          <thead><tr><th>SKU</th><th>Product</th><th>Credit</th></tr></thead>
          <tbody>
            {credits.map(({ productId, productName, image }) => (
              <tr key={productId}>
                <td><Link to={`/p/${productId}`}>{productId}</Link></td>
                <td>{productName}</td>
                <td>{image.sourcePage ? <a href={image.sourcePage} target="_blank" rel="noreferrer">{image.attribution}</a> : image.attribution}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
