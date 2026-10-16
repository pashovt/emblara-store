import { useEffect, useState } from 'react';
import { useCart } from '../store/cart.jsx';
import { gbp } from '../lib/utils.js';

// Where Stripe sends the buyer after paying. Whether the order is paid is
// decided by the server (it only changes on Stripe's signed webhook), so this
// page asks the server and waits a few seconds if the webhook is a moment behind.
export default function OrderSuccess() {
  const { clear } = useCart();
  const [state, setState] = useState({ phase: 'checking' });

  useEffect(() => {
    const session = new URLSearchParams(window.location.search).get('session_id');
    if (!session) {
      setState({ phase: 'unknown' });
      return undefined;
    }
    let stop = false;
    (async () => {
      for (let i = 0; i < 12 && !stop; i += 1) {
        try {
          const res = await fetch(`/api/order-status?session=${encodeURIComponent(session)}`);
          const data = await res.json();
          if (res.ok && data.paid) {
            clear();
            setState({ phase: 'paid', ...data });
            return;
          }
          if (!res.ok) break;
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!stop) setState({ phase: 'pending' });
    })();
    return () => {
      stop = true;
    };
  }, [clear]);

  return (
    <div className="page page--checkout">
      <section className="confirm" role="status">
        {state.phase === 'paid' && (
          <>
            <p className="eyebrow">Order {state.number}</p>
            <h1 className="h2">Thank you. Your order is <em>paid</em>.</h1>
            <p>We’ve received {gbp(state.total_pence / 100)}. Keep your order number. We’ll send your digital proof to approve before anything is made, and confirm delivery times with it.</p>
          </>
        )}
        {state.phase === 'checking' && <h1 className="h2">Confirming your <em>payment</em>…</h1>}
        {state.phase === 'pending' && (
          <>
            <h1 className="h2">We’re still <em>confirming</em> your payment.</h1>
            <p>If you completed payment, your order should appear on our side within a minute. This page can be reloaded to check again. If it still hasn’t updated, contact us with the time of your payment and we’ll sort it out.</p>
          </>
        )}
        {state.phase === 'unknown' && <h1 className="h2">No order to <em>show</em>.</h1>}
        <a className="pill pill--copper pill--lg" href="#/shop">Back to the shop</a>
      </section>
    </div>
  );
}
