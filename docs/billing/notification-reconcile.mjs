// Sandbox-only handoff. Reconcile from current billing data, never an event snapshot.
import { createHmac, timingSafeEqual } from 'node:crypto';

function validSignature(body, header, secret, now) {
  if (!Buffer.isBuffer(body) || body.length > 262144 ||
      typeof header !== 'string' || header.length > 2048) return false;
  const parts = header.split(',');
  const times = parts.filter(part => part.startsWith('t='));
  if (times.length !== 1 || !/^t=[0-9]{1,12}$/.test(times[0])) return false;
  const timestamp = times[0].slice(2);
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const digest = createHmac('sha256', secret).update(timestamp + '.').update(body).digest();
  return parts.some(part => /^v1=[0-9a-f]{64}$/.test(part) &&
    timingSafeEqual(digest, Buffer.from(part.slice(3), 'hex')));
}

function customerFor(event) {
  const object = event.data?.object;
  if (event.type === 'invoice.paid' && object?.object === 'invoice') return object.customer;
  if (event.type === 'customer.updated' && object?.object === 'customer') return object.id;
  return undefined;
}

export function createSandboxBillingReconciler({ secret, customer, reconcile, project, now = () => Date.now() / 1000 }) {
  if (typeof secret !== 'string' || secret.length < 32 ||
      typeof customer !== 'string' || !/^cus_[A-Za-z0-9]{1,64}$/.test(customer) ||
      typeof reconcile !== 'function' || (project !== undefined && typeof project !== 'function')) {
    throw new Error('Invalid sandbox configuration');
  }

  const completed = new Set();
  let pending = Promise.resolve();
  let queued = 0;
  return async function accept(body, signature) {
    if (!validSignature(body, signature, secret, now())) return { status: 400, result: 'bad_signature' };
    let event;
    try { event = JSON.parse(body.toString('utf8')); } catch {
      return { status: 400, result: 'invalid_event' };
    }
    if (event?.object !== 'event' || event.livemode !== false || event.account !== undefined ||
        typeof event.id !== 'string' || !/^evt_[A-Za-z0-9]{1,64}$/.test(event.id)) {
      return { status: 400, result: 'invalid_event' };
    }
    if (!['invoice.paid', 'customer.updated'].includes(event.type)) return { status: 200, result: 'ignored' };
    if (customerFor(event) !== customer) return { status: 400, result: 'wrong_customer' };
    if (queued >= 100) return { status: 503, result: 'retry' };
    queued++;
    const run = pending.then(async () => {
      if (completed.has(event.id)) return { status: 200, result: 'duplicate' };
      try {
        const confirmed = await reconcile(customer);
        if (project) await project(confirmed);
      } catch { return { status: 503, result: 'retry' }; }
      completed.add(event.id);
      if (completed.size > 1000) completed.delete(completed.values().next().value);
      return { status: 200, result: 'reconciled' };
    });
    pending = run.then(() => { queued--; });
    return run;
  };
}
