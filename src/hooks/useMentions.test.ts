import { useMentions } from './useMentions'

// Mock the userService
jest.mock('../services/userService', () => ({
  userService: {
    getUserById: jest.fn(),
    getUsersForCompany: jest.fn()
  }
}))

// Mock data
const mockCurrentUser = {
  uid: 'user1',
  companyId: 'company1'
}

const mockTask = {
  assigneeId: 'assignee1'
}

const mockUsers = [
  { id: 'assignee1', name: 'John Doe', email: 'john@example.com', role: 'employee' },
  { id: 'admin1', name: 'Jane Admin', email: 'jane@example.com', role: 'admin' },
  { id: 'superadmin1', name: 'Bob Super', email: 'bob@example.com', role: 'super_admin' }
]

describe('useMentions', () => {
  it('should be defined', () => {
    expect(useMentions).toBeDefined()
  })

  it('should be a function', () => {
    expect(typeof useMentions).toBe('function')
  })
})