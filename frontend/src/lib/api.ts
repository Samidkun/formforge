import type { Schema } from '../builder/types';

export interface FormDetail {
  id: string;
  title: string;
  slug: string;
  status: string;
  draft_schema: Schema;
  current_version_id?: string | null;
}

export interface PublishResult {
  form: FormDetail;
  version: {
    id?: string;
    form_id?: string;
    version_no: number;
    schema?: Schema;
    published_at?: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function authHeaders(token?: string): Record<string, string> {
  const resolved = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
  return resolved ? { Authorization: `Bearer ${resolved}` } : {};
}

export async function fetchForm(id: string, token?: string): Promise<FormDetail> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/forms/${id}`, {
    method: 'GET',
    headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || `Gagal memuat form (status: ${res.status})`);
  }

  return json.data as FormDetail;
}

export async function saveDraft(id: string, schema: Schema, token?: string): Promise<FormDetail> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/forms/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ draft_schema: schema }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || `Gagal menyimpan draft (status: ${res.status})`);
  }

  return json.data as FormDetail;
}

export async function publishForm(
  id: string,
  token?: string
): Promise<{ success: boolean; data: PublishResult; meta?: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/forms/${id}/publish`, {
    method: 'POST',
    headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || `Gagal mempublikasikan form (status: ${res.status})`);
  }

  return json;
}

export async function getResponses(
  formId: string,
  status?: string,
  page: number = 1,
  token?: string
): Promise<{ data: { items: any[] }; meta: { total: number; current_page: number; last_page: number; per_page: number } }> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/forms/${formId}/responses${query}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch responses');
  }
  return res.json();
}

export function exportResponsesUrl(formId: string, token?: string): string {
  const resolvedToken = token !== undefined ? token : (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');
  return `${API_BASE}/api/forms/${formId}/responses/export?token=${resolvedToken || ''}`;
}

export const api = {
  fetchForm,
  getForm: fetchForm,
  saveDraft,
  publishForm,
  getResponses,
  exportResponsesUrl,
};

export default api;
