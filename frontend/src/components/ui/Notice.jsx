import { useNotice } from '../../context/NoticeContext.jsx';

export default function Notice() {
  const { notice, clearNotice } = useNotice();
  if (!notice) return null;
  return (
    <div className={`toast ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      <button type="button" onClick={clearNotice} aria-label="Dismiss">×</button>
    </div>
  );
}
