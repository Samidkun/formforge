import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForm, saveDraft } from './api';

describe('API Client — fetchForm & saveDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchForm mengembalikan FormDetail saat respons sukses', async () => {
    const mockForm = {
      id: 'uuid-1',
      title: 'Survey Mahasiswa',
      slug: 'survey-mahasiswa',
      status: 'draft',
      draft_schema: { fields: [{ key: 'f_1', type: 'text', label: 'Nama' }] },
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockForm, meta: {} }),
    } as Response);

    const result = await fetchForm('uuid-1');
    expect(result).toEqual(mockForm);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/uuid-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchForm menyertakan header Authorization jika token diberikan', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'uuid-1' } }),
    } as Response);

    await fetchForm('uuid-1', 'secret-token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/uuid-1'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      })
    );
  });

  it('fetchForm melempar error saat server mengembalikan gagal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: { message: 'Not found' } }),
    } as Response);

    await expect(fetchForm('uuid-unknown')).rejects.toThrow(/Not found/);
  });

  it('fetchForm melempar default error saat respon tidak ok dan json kosong', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('invalid json');
      },
    } as unknown as Response);

    await expect(fetchForm('uuid-err')).rejects.toThrow(/status: 500/);
  });

  it('saveDraft mengirim PATCH dengan draft_schema', async () => {
    const schema = { fields: [{ key: 'f_1', type: 'text' as const, label: 'Alamat' }] };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'uuid-1', draft_schema: schema } }),
    } as Response);

    await saveDraft('uuid-1', schema);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/uuid-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ draft_schema: schema }),
      })
    );
  });

  it('saveDraft menyertakan token authorization saat diberikan', async () => {
    const schema = { fields: [] };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'uuid-1', draft_schema: schema } }),
    } as Response);

    await saveDraft('uuid-1', schema, 'my-auth-token');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/uuid-1'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-auth-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('saveDraft melempar error saat server gagal menyimpan', async () => {
    const schema = { fields: [] };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ success: false, error: { message: 'Invalid schema' } }),
    } as Response);

    await expect(saveDraft('uuid-1', schema)).rejects.toThrow(/Invalid schema/);
  });
});
