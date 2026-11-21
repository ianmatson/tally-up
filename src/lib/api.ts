export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T = void>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = options.body !== undefined
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, data?.error ?? 'Something went wrong')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404
