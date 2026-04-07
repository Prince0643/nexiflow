class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

class MockDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'

  createElement(tagName: string) {
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      children: [],
      appendChild(child: unknown) {
        this.children.push(child)
        return child
      }
    }
  }
}

const localStorage = new MemoryStorage()
const document = new MockDocument()
const windowTarget = new EventTarget()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage
})

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: document
})

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: Object.assign(windowTarget, {
    localStorage,
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
    setInterval: (...args: Parameters<typeof setInterval>) => setInterval(...args),
    clearInterval: (...args: Parameters<typeof clearInterval>) => clearInterval(...args),
    dispatchEvent: windowTarget.dispatchEvent.bind(windowTarget),
    addEventListener: windowTarget.addEventListener.bind(windowTarget),
    removeEventListener: windowTarget.removeEventListener.bind(windowTarget)
  })
})

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true }
})

const encodeBase64 = (value: string) => Buffer.from(value, 'binary').toString('base64')
const decodeBase64 = (value: string) => Buffer.from(value, 'base64').toString('binary')

Object.defineProperty(globalThis, 'btoa', {
  configurable: true,
  value: encodeBase64
})

Object.defineProperty(globalThis, 'atob', {
  configurable: true,
  value: decodeBase64
})

Object.defineProperty(globalThis.window, 'btoa', {
  configurable: true,
  value: encodeBase64
})

Object.defineProperty(globalThis.window, 'atob', {
  configurable: true,
  value: decodeBase64
})
