import { isDocker, resolveServiceUrl } from './runtime';

export interface ListmonkTemplate {
  id: number;
  name: string;
  type: 'tx' | 'campaign' | 'campaign_visual';
  subject?: string;
  body: string;
  body_source?: string | null;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ListmonkTemplatePayload {
  name: string;
  type: 'tx' | 'campaign' | 'campaign_visual';
  subject: string;
  body: string;
}

interface ListmonkApiResponse<T> {
  data: T;
  message?: string;
}

/**
 * Resolve Listmonk base URL and credentials securely from environment variables.
 * Never logs or exposes LISTMONK_API_TOKEN.
 */
function getListmonkConfig() {
  const rawUrl = process.env.LISTMONK_API_URL || process.env.LISTMONK_BASE_URL || 'http://localhost:9000';
  let baseUrl = rawUrl;

  if (isDocker()) {
    baseUrl = resolveServiceUrl(rawUrl, 'listmonk', 9000);
  } else {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname === 'listmonk') {
        parsed.hostname = 'localhost';
        parsed.port = '9000';
        baseUrl = parsed.toString();
      }
    } catch {
      // Keep rawUrl if parsing fails
    }
  }

  baseUrl = baseUrl.replace(/\/$/, '');
  const username = process.env.LISTMONK_API_USER || process.env.LISTMONK_USER || 'n8n-production';
  const token = process.env.LISTMONK_API_TOKEN;

  if (!token) {
    throw new Error('LISTMONK_API_TOKEN is not configured in the environment');
  }

  const authHeader = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;

  return { baseUrl, authHeader };
}

/**
 * Reusable request helper for Listmonk API.
 * Ensures Basic Auth, timeout handling, error normalization, and payload extraction.
 */
export async function listmonkRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { baseUrl, authHeader } = getListmonkConfig();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const targetUrl = `${baseUrl}${normalizedEndpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', authHeader);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(10000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error';
    throw new Error(`Failed to connect to Listmonk at ${baseUrl}: ${message}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errorJson = (await res.json()) as { message?: string; error?: string };
      detail = errorJson.message || errorJson.error || '';
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = res.statusText;
      }
    }
    // Avoid exposing any raw payload that might accidentally echo sensitive info
    const safeDetail = detail.length > 200 ? `${detail.slice(0, 200)}...` : detail;
    throw new Error(
      `Listmonk API error (HTTP ${res.status}): ${safeDetail || res.statusText}`
    );
  }

  // Handle empty bodies (e.g. 204 or empty 200)
  if (res.status === 204) {
    return {} as T;
  }

  const data = (await res.json()) as ListmonkApiResponse<T> | T;
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as ListmonkApiResponse<T>).data;
  }

  return data as T;
}

/**
 * Retrieve a Listmonk template by ID: GET /api/templates/{id}
 */
export async function getListmonkTemplate(id: number): Promise<ListmonkTemplate> {
  if (!id || id <= 0) {
    throw new Error(`Invalid Listmonk template ID: ${id}`);
  }
  return listmonkRequest<ListmonkTemplate>(`/api/templates/${id}`, {
    method: 'GET',
  });
}

/**
 * Create a new Listmonk template: POST /api/templates
 */
export async function createListmonkTemplate(
  payload: ListmonkTemplatePayload
): Promise<ListmonkTemplate> {
  return listmonkRequest<ListmonkTemplate>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing Listmonk template: PUT /api/templates/{id}
 */
export async function updateListmonkTemplate(
  id: number,
  payload: ListmonkTemplatePayload
): Promise<ListmonkTemplate> {
  if (!id || id <= 0) {
    throw new Error(`Invalid Listmonk template ID: ${id}`);
  }
  return listmonkRequest<ListmonkTemplate>(`/api/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
