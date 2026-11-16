import type { Complaint } from './data'

export type Notice = { id: number; kind: 'important' | 'normal'; title: string; date: string }
export type PublicDashboard = {
  user: { username: string; displayName: string }
  complaints: Complaint[]
  notices: Notice[]
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: '요청을 처리하지 못했습니다.' }))
    throw new Error(body.message || '요청을 처리하지 못했습니다.')
  }
  const type = response.headers.get('content-type') || ''
  if (type.includes('application/json')) return response.json()
  return response.text() as T
}
