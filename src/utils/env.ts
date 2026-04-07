type AppEnv = Record<string, string | undefined>

const getRawEnv = (): AppEnv => {
  const viteEnv = (import.meta as ImportMeta & { env?: AppEnv }).env
  if (viteEnv) {
    return viteEnv
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env as AppEnv
  }

  return {}
}

export const getEnvValue = (key: string): string | undefined => getRawEnv()[key]

export const getApiBaseUrl = (): string => getEnvValue('VITE_API_BASE_URL') || '/api'
