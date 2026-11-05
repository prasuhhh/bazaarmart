export function PanelRow({ label, detail, children }) {
  return (
    <li className="panel-row">
      <span className="panel-row-label" title={detail}>{label}{detail && <small>{detail}</small>}</span>
      {children && <span className="panel-row-actions">{children}</span>}
    </li>
  );
}

export default function ProfilePanel({ title, children }) {
  return (
    <section className="profile-panel">
      <h3>{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}
