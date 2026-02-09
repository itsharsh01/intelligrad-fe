/**
 * Auth module: login/register via backend API, token stored in localStorage.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const STORAGE_KEY = 'intelligrad_auth'

export type User = {
  id: number
  email: string
  name?: string
}

type AuthResponse = {
  access_token: string
  token_type?: string
  user: { id: number; email: string }
}

function getStoredAuth(): { access_token: string; token_type: string; user: User } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (
      data &&
      typeof data === 'object' &&
      'access_token' in data &&
      'user' in data &&
      typeof (data as { access_token: unknown }).access_token === 'string' &&
      (data as { user: unknown }).user &&
      typeof (data as { user: unknown }).user === 'object'
    ) {
      const auth = data as { access_token: string; token_type?: string; user: { id: number; email: string; name?: string } }
      return {
        access_token: auth.access_token,
        token_type: auth.token_type ?? 'bearer',
        user: {
          id: auth.user.id,
          email: auth.user.email,
          name: auth.user.name,
        },
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function getAccessToken(): string | null {
  const auth = getStoredAuth()
  return auth?.access_token ?? null
}

export function getStoredUser(): User | null {
  return getStoredAuth()?.user ?? null
}

function persistAuth(access_token: string, token_type: string, user: User): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token, token_type, user }))
  } catch {
    // ignore
  }
}

export function logout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function isAuthenticated(): boolean {
  return getStoredUser() != null
}

export async function login(
  email: string,
  password: string,
  remember_me: boolean = false
): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      remember_me,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Invalid email or password. Please try again.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default message
    }
    throw new Error(message)
  }
  const data = (await res.json()) as AuthResponse
  // console.log('Login API response:', data)
  const user: User = { id: data.user.id, email: data.user.email }
  persistAuth(data.access_token, data.token_type ?? 'bearer', user)
  return user
}

export async function register(email: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Registration failed. Please try again.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default message
    }
    throw new Error(message)
  }
  const data = (await res.json()) as AuthResponse
  const user: User = { id: data.user.id, email: data.user.email }
  persistAuth(data.access_token, data.token_type ?? 'bearer', user)
  return user
}
