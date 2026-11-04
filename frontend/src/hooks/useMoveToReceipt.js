import { useCallback } from 'react';
import { useNotice } from '../context/NoticeContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';

// Adds a list of { product, colour, qty } and reports anything it had to leave behind.
export function useMoveToReceipt() {
  const { addItem, qtyOf } = useReceipt();
  const { showSuccess, showInfo } = useNotice();

  return useCallback(entries => {
    let moved = 0;
    for (const { product, colour, qty = 1 } of entries) {
      const room = product ? product.quantity - qtyOf(product.productId) : 0;
      const count = Math.min(qty, room);
      for (let copy = 0; copy < count; copy += 1) addItem(product, colour);
      if (count > 0) moved += 1;
    }
    const skipped = entries.length - moved;
    if (!moved) showInfo('Nothing could be added. Those items are out of stock or already in your receipt.');
    else if (skipped) showInfo(`${moved} added to your receipt. ${skipped} couldn't be added.`);
    else showSuccess(`${moved} ${moved === 1 ? 'item' : 'items'} added to your receipt.`);
  }, [addItem, qtyOf, showInfo, showSuccess]);
}
