/**
 * API Client for the Google ADK & Vertex AI Agent Engine FastAPI Gateway.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8083';

function getAuthHeaders() {
  const token = localStorage.getItem('agent0_google_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function authenticateGoogleToken(idToken) {
  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Google authentication failed.');
  }

  return await res.json();
}

export async function fetchUserProfile() {
  const token = localStorage.getItem('agent0_google_token');
  if (!token) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('agent0_google_token');
        localStorage.removeItem('agent0_user');
      }
      return null;
    }

    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

export async function sendChatMessage({ message, sessionId }) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Agent Engine error (${res.status})`);
  }

  return await res.json();
}

export async function summarizeText({ text, style = 'bullet points', sessionId }) {
  const res = await fetch(`${BASE_URL}/summarize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, style, session_id: sessionId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Summarization failed (${res.status})`);
  }

  return await res.json();
}

export async function solveMath({ problem, showSteps = true, sessionId }) {
  const res = await fetch(`${BASE_URL}/math`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ problem, show_steps: showSteps, session_id: sessionId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Math calculation failed (${res.status})`);
  }

  return await res.json();
}
