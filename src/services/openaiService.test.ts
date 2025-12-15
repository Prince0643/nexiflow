import { openaiService } from './openaiService'

describe('OpenAI Service', () => {
  it('should be defined', () => {
    expect(openaiService).toBeDefined()
  })

  it('should have generateResponse method', () => {
    expect(typeof openaiService.generateResponse).toBe('function')
  })

  it('should have generateResponseWithContext method', () => {
    expect(typeof openaiService.generateResponseWithContext).toBe('function')
  })
})