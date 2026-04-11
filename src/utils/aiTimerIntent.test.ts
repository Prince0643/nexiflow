import { describe, expect, it } from '@jest/globals'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { isStartTimerIntent, isStopTimerIntent } = require('../../api/aiTimerIntent.cjs')

describe('aiTimerIntent', () => {
  describe('isStartTimerIntent', () => {
    it('matches explicit timer and time start phrases', () => {
      expect(isStartTimerIntent('please start my timer')).toBe(true)
      expect(isStartTimerIntent('please start my time')).toBe(true)
      expect(isStartTimerIntent('clock me in')).toBe(true)
      expect(isStartTimerIntent('clock in now')).toBe(true)
    })

    it('does not match stop phrases', () => {
      expect(isStartTimerIntent('please stop my timer')).toBe(false)
      expect(isStartTimerIntent('please stop my time')).toBe(false)
    })
  })

  describe('isStopTimerIntent', () => {
    it('matches explicit timer and time stop phrases', () => {
      expect(isStopTimerIntent('please stop my timer')).toBe(true)
      expect(isStopTimerIntent('please stop my time')).toBe(true)
      expect(isStopTimerIntent('end my time')).toBe(true)
      expect(isStopTimerIntent('clock out')).toBe(true)
    })

    it('does not match start phrases', () => {
      expect(isStopTimerIntent('please start my timer')).toBe(false)
      expect(isStopTimerIntent('please start my time')).toBe(false)
    })
  })
})
