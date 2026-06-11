const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`)
  }

  return response.json()
}
