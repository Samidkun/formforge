import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForm, saveDraft, publishForm, api } from './api';

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
          Accept: 'application/json',
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

  it('publishes form successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            form: { id: 'f-1', status: 'published' },
            version: { version_no: 1 },
          },
        }),
      })
    );

    const res = await publishForm('f-1');
    expect(res.data.form.status).toBe('published');
    expect(res.data.version.version_no).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/f-1/publish'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('publishForm menyertakan header Authorization jika token diberikan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            form: { id: 'f-1', status: 'published' },
            version: { version_no: 1 },
          },
        }),
      })
    );

    await publishForm('f-1', 'publish-token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/f-1/publish'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer publish-token',
        }),
      })
    );
  });

  it('publishForm melempar error saat server mengembalikan gagal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          success: false,
          error: { message: 'Cannot publish form with zero fields.' },
        }),
      })
    );

    await expect(publishForm('f-1')).rejects.toThrow(/Cannot publish form with zero fields/);
  });

  it('fetches form responses list with pagination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { items: [{ id: 'sub-1', status: 'complete' }] },
          meta: { total: 1, current_page: 1, last_page: 1 },
        }),
      })
    );

    const res = await api.getResponses('form-1', 'complete', 1);
    expect(res.data.items.length).toBe(1);
    expect(res.meta.total).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/form-1/responses?status=complete'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('fetches form responses with page parameter when page > 1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { items: [] },
          meta: { total: 0, current_page: 2, last_page: 2, per_page: 25 },
        }),
      })
    );

    await api.getResponses('form-1', 'all', 2);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/form-1/responses?page=2'),
      expect.anything()
    );
  });

  it('getResponses throws error when server returns error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: { message: 'Forbidden access to form responses' },
        }),
      })
    );

    await expect(api.getResponses('form-1')).rejects.toThrow(/Forbidden access to form responses/);
  });

  it('generates export CSV URL with auth token parameter or direct link', () => {
    const url = api.exportResponsesUrl('form-1');
    expect(url).toContain('/api/forms/form-1/responses/export');
  });

  it('exportResponsesUrl includes auth token if present in localStorage', () => {
    const originalLocalStorage = global.localStorage;
    const getItemMock = vi.fn().mockReturnValue('test-token-12345');
    Object.defineProperty(global, 'localStorage', {
      value: { getItem: getItemMock },
      configurable: true,
      writable: true,
    });

    const url = api.exportResponsesUrl('form-1');
    expect(url).toContain('/api/forms/form-1/responses/export?token=test-token-12345');

    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });
});
