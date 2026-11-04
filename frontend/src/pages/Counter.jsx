import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import CounterStep from '../components/counter/CounterStep.jsx';
import DeliverStep, { addressSummary } from '../components/counter/DeliverStep.jsx';
import ExtrasStrip from '../components/counter/ExtrasStrip.jsx';
import MockPayment from '../components/counter/MockPayment.jsx';
import PayStep, { paymentLabel } from '../components/counter/PayStep.jsx';
import ReceiptPanel from '../components/counter/ReceiptPanel.jsx';
import WhenStep from '../components/counter/WhenStep.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useQuote } from '../hooks/useQuote.js';
import Placeholder from './Placeholder.jsx';

const PAID_PAUSE_MS = 1200;
const NO_EXTRAS = { wrap: false, note: '', gst: false, gstin: '' };

export default function Counter() {
  const { user } = useAuth();
  const { items, clearReceipt } = useReceipt();
  const { showSuccess, showError, clearNotice } = useNotice();
  const navigate = useNavigate();
  const addresses = useFetch(user ? '/users/me/addresses' : null);

  const [address, setAddress] = useState(null);
  const [slot, setSlot] = useState(null);
  const [method, setMethod] = useState(null);
  const [extras, setExtras] = useState(NO_EXTRAS);
  const [coupon, setCoupon] = useState('');
  const [openStep, setOpenStep] = useState(1);
  const [isPaying, setIsPaying] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [busy, setBusy] = useState(false);
  const quoted = useQuote(items, coupon);

  // Collapses the finished step and opens the next one still to do.
  function moveOn(changes) {
    const next = { address, slot, method, ...changes };
    setOpenStep(!next.address ? 1 : !next.slot ? 2 : !next.method ? 3 : 0);
  }

  useEffect(() => {
    const preferred = addresses.data?.find(entry => entry.isDefault);
    if (!preferred || address) return;
    setAddress(preferred);
    moveOn({ address: preferred });
    // Only a newly loaded address list should pick the default.
  }, [addresses.data]);

  const finish = ({ message, data }) => {
    clearReceipt();
    showSuccess(message, { keep: true });
    // A guest order is opened with its phone, so a guest lands straight on the parcel.
    navigate(`/track/${data.orderNo}`, { state: user ? undefined : { phone: address.phone } });
  };

  useEffect(() => {
    if (!placed) return undefined;
    const timer = setTimeout(() => finish(placed), PAID_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [placed]);

  async function placeOrder() {
    setBusy(true);
    clearNotice();
    try {
      return await api('/orders', {
        method: 'POST',
        body: {
          items: items.map(({ productId, colour, qty }) => ({ productId, colour, qty })),
          address,
          slot,
          payment: { method },
          coupon: coupon || undefined,
          gift: { wrap: extras.wrap, note: extras.note || undefined },
          gst: { invoice: extras.gst, gstin: extras.gstin },
          ...(!user && { guest: { name: address.name, phone: address.phone } })
        }
      });
    } catch (error) {
      if (error.status !== 401) showError(error.message);
      quoted.reload();
      setBusy(false);
      setIsPaying(false);
      return null;
    }
  }

  async function handlePay() {
    if (method !== 'cod') {
      setIsPaying(true);
      return;
    }
    const result = await placeOrder();
    if (result) finish(result);
  }

  async function confirmPayment() {
    const result = await placeOrder();
    if (result) setPlaced(result);
  }

  if (!items.length && !placed) {
    return (
      <Placeholder caption="Counter" title="Your receipt is empty." linkTo="/map" linkLabel="Walk the store">
        Add something from the store floor, then come back to the counter.
      </Placeholder>
    );
  }

  const missing = !address ? 1 : !slot ? 2 : !method ? 3 : 0;
  const stepProps = number => ({ number, isOpen: openStep === number, onOpen: () => setOpenStep(openStep === number ? 0 : number) });

  return (
    <div className="counter">
      <div className="counter-steps">
        <CounterStep {...stepProps(1)} title="Deliver to" isDone={Boolean(address)} summary={address ? addressSummary(address) : 'Add where this should go'}>
          <DeliverStep
            saved={addresses.data}
            chosen={address}
            onAdded={addresses.reload}
            onChoose={next => { setAddress(next); moveOn({ address: next }); }}
          />
        </CounterStep>

        <CounterStep {...stepProps(2)} title="When" isDone={Boolean(slot)} summary={slot?.label ?? 'Today 6–9 pm · Tomorrow · Pick a day'}>
          <WhenStep chosen={slot} onChoose={next => { setSlot(next); moveOn({ slot: next }); }} />
        </CounterStep>

        <CounterStep {...stepProps(3)} title="Pay with" isDone={Boolean(method)} summary={paymentLabel(method) ?? 'UPI · Card · Netbanking · COD'}>
          <PayStep chosen={method} onChoose={next => { setMethod(next); moveOn({ method: next }); }} />
        </CounterStep>

        <ExtrasStrip extras={extras} onChange={setExtras} />
      </div>

      <ReceiptPanel
        quoted={quoted}
        coupon={coupon}
        onCoupon={setCoupon}
        blockedBy={missing ? `Finish step ${missing} to pay.` : null}
        busy={busy}
        onPay={handlePay}
      />

      {isPaying && (
        <MockPayment
          methodLabel={paymentLabel(method)}
          total={quoted.quote?.total ?? 0}
          isPaid={Boolean(placed)}
          busy={busy}
          onConfirm={confirmPayment}
          onCancel={() => setIsPaying(false)}
        />
      )}
    </div>
  );
}
