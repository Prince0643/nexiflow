import { describe, expect, it, jest } from '@jest/globals'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { finalizeStripeSession, handleStripeEvent } = require('../../api/stripeBilling.cjs')

// Fake pool: one in-memory transaction row; the locked SELECT reflects status changes made by apply.
function makeHarness(status = 'pending') {
  const row: any = { id: 't1', company_id: 'c1', status, metadata: JSON.stringify({ pricing_level: 'office' }) }
  const apply = jest.fn(async (_conn: any, { transaction }: any) => {
    row.status = 'paid'
    row.metadata = transaction.metadata
    return { pricingLevel: 'office' }
  })
  const connection: any = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql: string) => (sql.startsWith('SELECT') ? [[{ ...row }]] : [{ affectedRows: 1 }])
  }
  const pool: any = { getConnection: async () => connection, execute: jest.fn(async () => [{ affectedRows: 1 }]) }
  return { row, apply, pool }
}

describe('stripeBilling', () => {
  it('finalizes once and is a no-op on replay', async () => {
    const { apply, pool, row } = makeHarness()
    const session = { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1' }
    expect((await finalizeStripeSession(pool, apply, session)).status).toBe('paid')
    expect((await finalizeStripeSession(pool, apply, session)).status).toBe('already_paid')
    expect(apply).toHaveBeenCalledTimes(1)
    expect(JSON.parse(row.metadata).stripe_payment_intent_id).toBe('pi_1')
  })

  it('does not finalize an unpaid completed session', async () => {
    const { apply, pool } = makeHarness()
    const event = { type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'unpaid' } } }
    expect(await handleStripeEvent(pool, apply, event)).toBe('awaiting_async_payment')
    expect(apply).not.toHaveBeenCalled()
  })

  it('ignores unknown events and records refunds without upgrading', async () => {
    const { apply, pool } = makeHarness()
    expect(await handleStripeEvent(pool, apply, { type: 'foo.bar', data: { object: {} } })).toBe('ignored')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const refund = { type: 'charge.refunded', data: { object: { payment_intent: 'pi_1' } } }
    expect(await handleStripeEvent(pool, apply, refund)).toBe('refunded')
    expect(apply).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
