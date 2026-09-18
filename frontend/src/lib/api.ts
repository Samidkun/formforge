import type { Schema } from '../builder/types';

export interface FormDetail {
  id: string;
  title: string;
  slug: string;
  status: string;
  draft_schema: Schema;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

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
