// Sandbox-only handoff. Reconcile from current billing data, never an event snapshot.
import { createHmac, timingSafeEqual } from 'node:crypto';

const maxBody = 262144;
const webhookPath = '/webhooks/stripe/billing';

function validSignature(body, header, secret, now) {
  if (!Buffer.isBuffer(body) || body.length > maxBody ||
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

export function createSandboxBillingReconciler({ secret, customer, reconcile, project, receipts, now = () => Date.now() / 1000 }) {
  if (typeof secret !== 'string' || secret.length < 32 ||
      typeof customer !== 'string' || !/^cus_[A-Za-z0-9]{1,64}$/.test(customer) ||
      typeof reconcile !== 'function' || (project !== undefined && typeof project !== 'function') ||
      !['reserve', 'complete', 'abandon'].every(method => typeof receipts?.[method] === 'function')) {
    throw new Error('Invalid sandbox configuration');
  }

  let pending = Promise.resolve();
  let queued = 0;
  function enqueue(eventId = null) {
    if (queued >= 100) return Promise.resolve({ status: 503, result: 'retry' });
    queued++;
    const run = pending.then(async () => {
      let lease;
      try {
        lease = await receipts.reserve(customer, eventId);
        if (lease.state === 'duplicate') return { status: 200, result: 'duplicate' };
        if (lease.state !== 'reserved') return { status: 503, result: 'retry' };
        const confirmed = await reconcile(customer);
        if (project) await project(confirmed, { customer, owner: lease.owner });
        await receipts.complete(customer, eventId, lease.owner);
      } catch {
        if (lease?.owner) {
          try { await receipts.abandon(customer, lease.owner); } catch { /* lease expires automatically */ }
        }
        return { status: 503, result: 'retry' };
      }
      return { status: 200, result: 'reconciled' };
    });
    pending = run.then(() => { queued--; });
    return run;
  }

  async function accept(body, signature) {
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
    return enqueue(event.id);
  }

  return { accept, refresh: () => enqueue() };
}

async function boundedBody(stream) {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, length);
      length += value.byteLength;
      if (length > maxBody) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export function createSandboxBillingRuntime(config) {
  const { accept, refresh } = createSandboxBillingReconciler(config);
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname !== webhookPath || url.search) return Response.json({ result: 'not_found' }, { status: 404 });
      if (request.method !== 'POST') return Response.json({ result: 'method_not_allowed' }, { status: 405 });
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
        return Response.json({ result: 'unsupported_media_type' }, { status: 415 });
      }
      const body = await boundedBody(request.body);
      if (!body) return Response.json({ result: 'payload_too_large' }, { status: 413 });
      const { status, result } = await accept(body, request.headers.get('Stripe-Signature'));
      return Response.json({ result }, { status });
    },
    // A scheduling tick uses the same queue and reconciliation as an event.
    scheduled: refresh,
  };
}
