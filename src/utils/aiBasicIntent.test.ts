import { describe, expect, it } from '@jest/globals'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { isCurrentTimeIntent, isEarningsIntent, getSummaryPeriodFromPrompt } = require('../../api/aiBasicIntent.cjs')

describe('aiBasicIntent', () => {
  describe('isCurrentTimeIntent', () => {
    it('matches common current time questions', () => {
      expect(isCurrentTimeIntent('what time is it')).toBe(true)
      expect(isCurrentTimeIntent('what is the current time')).toBe(true)
      expect(isCurrentTimeIntent('time now?')).toBe(true)
    })

    it('does not match unrelated questions', () => {
      expect(isCurrentTimeIntent('where is the calendar')).toBe(false)
    })
  })

  describe('getSummaryPeriodFromPrompt', () => {
    it('extracts summary periods from prompt text', () => {
      expect(getSummaryPeriodFromPrompt('how much did I make today')).toBe('today')
      expect(getSummaryPeriodFromPrompt('how much did I render this week')).toBe('week')
      expect(getSummaryPeriodFromPrompt('what are my earnings this month')).toBe('month')
    })
  })

  describe('isEarningsIntent', () => {
    it('matches earnings or rendered questions for supported periods', () => {
      expect(isEarningsIntent('how much did I make today')).toBe(true)
      expect(isEarningsIntent('how much did I render this week')).toBe(true)
      expect(isEarningsIntent('what are my billable earnings this month')).toBe(true)
    })

    it('does not match when no supported period is present', () => {
      expect(isEarningsIntent('how much did I make')).toBe(false)
    })
  })
})
