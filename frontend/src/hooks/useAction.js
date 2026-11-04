import { useCallback, useState } from 'react';
import { useNotice } from '../context/NoticeContext.jsx';

// Runs one API change with a busy flag and notices. Returns whether it worked, so
// a form can stay open after a failure. A 401 already shows "Session expired".
export function useAction() {
  const { showSuccess, showError, clearNotice } = useNotice();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (task, successMessage) => {
    setBusy(true);
    clearNotice();
    try {
      const result = await task();
      showSuccess(successMessage ?? result?.message);
      return true;
    } catch (error) {
      if (error.status !== 401) showError(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [clearNotice, showError, showSuccess]);

  return { busy, run };
}
