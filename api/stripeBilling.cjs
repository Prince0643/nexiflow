// Stripe billing helpers. DB pool and the shared upgrade function are injected so this is unit-testable.

const paymentIntentId = (obj) =>
  typeof obj?.payment_intent === 'string' ? obj.payment_intent : obj?.payment_intent?.id || null;

// Idempotent: row-locks the transaction; a second call (redirect + webhook race) is a no-op.
async function finalizeStripeSession(pool, applyPaidPlanUpgrade, session) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT * FROM payment_transactions WHERE checkout_session_id = ? LIMIT 1 FOR UPDATE',
      [session.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return { status: 'not_found' };
    }
    const transaction = rows[0];
    const metadata = JSON.parse(transaction.metadata || '{}');
    if (transaction.status === 'paid') {
      await connection.commit();
      return { status: 'already_paid', pricingLevel: metadata.pricing_level };
    }

    metadata.stripe_payment_intent_id = paymentIntentId(session);
    const metadataJson = JSON.stringify(metadata);
    await connection.execute('UPDATE payment_transactions SET metadata = ? WHERE id = ?', [metadataJson, transaction.id]);
    const result = await applyPaidPlanUpgrade(connection, {
      orderId: session.id,
      transaction: { ...transaction, metadata: metadataJson }
    });
    await connection.commit();
    return { status: 'paid', pricingLevel: result.pricingLevel };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

// Dispatches a verified Stripe event. Returns a short label of what was done.
async function handleStripeEvent(pool, applyPaidPlanUpgrade, event) {
  const obj = event.data?.object;
  switch (event.type) {
    case 'checkout.session.completed':
      if (obj.payment_status !== 'paid') return 'awaiting_async_payment';
      // fallthrough
    case 'checkout.session.async_payment_succeeded':
      return (await finalizeStripeSession(pool, applyPaidPlanUpgrade, obj)).status;

    case 'checkout.session.async_payment_failed':
      await pool.execute(
        `UPDATE payment_transactions SET status = 'failed', failed_at = NOW()
         WHERE checkout_session_id = ? AND status = 'pending'`,
        [obj.id]
      );
      return 'failed';

    case 'checkout.session.expired':
      await pool.execute(
        `UPDATE payment_transactions SET status = 'expired' WHERE checkout_session_id = ? AND status = 'pending'`,
        [obj.id]
      );
      return 'expired';

    case 'charge.refunded':
    case 'charge.dispute.created': {
      const key = event.type === 'charge.refunded' ? 'stripe_refunded' : 'stripe_disputed';
      const intent = paymentIntentId(obj);
      if (!intent) return 'ignored';
      // Record only; the company is intentionally not downgraded automatically.
      const [result] = await pool.execute(
        `UPDATE payment_transactions
         SET metadata = JSON_SET(metadata, '$.${key}', true, '$.${key}_at', ?)
         WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.stripe_payment_intent_id')) = ?`,
        [new Date().toISOString(), intent]
      );
      console.warn(`Stripe ${event.type} for payment_intent ${intent}; transactions flagged: ${result?.affectedRows ?? 0}`);
      return key.replace('stripe_', '');
    }

    default:
      return 'ignored';
  }
}

module.exports = { finalizeStripeSession, handleStripeEvent };
