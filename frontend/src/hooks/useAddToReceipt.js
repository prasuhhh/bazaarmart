import { useCallback } from 'react';
import { useNotice } from '../context/NoticeContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';

export function useAddToReceipt() {
  const { addItem } = useReceipt();
  const { showSuccess } = useNotice();

  return useCallback((product, colour) => {
    addItem(product, colour);
    showSuccess(`${product.productName} added to receipt.`);
  }, [addItem, showSuccess]);
}
