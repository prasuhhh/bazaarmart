import { useNotice } from '../context/NoticeContext.jsx';

export default function Notice() {
  const { notice } = useNotice();
  if (!notice) return null;
  return <div className={`notice ${notice.type}`} role="status">{notice.text}</div>;
}
