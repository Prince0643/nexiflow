import { describe, expect, it } from '@jest/globals'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { sanitizeAIReply } = require('../../api/aiReplyFormatting.cjs')

describe('aiReplyFormatting', () => {
  it('removes markdown emphasis markers', () => {
    expect(sanitizeAIReply('You logged **8 hours** this week.')).toBe('You logged 8 hours this week.')
    expect(sanitizeAIReply('Estimated earnings are __$25__.')).toBe('Estimated earnings are $25.')
  })

  it('returns trimmed plain text for normal replies', () => {
    expect(sanitizeAIReply('  Simple reply.  ')).toBe('Simple reply.')
  })
})
