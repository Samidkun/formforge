import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForm, saveDraft, publishForm, getAnalytics, uploadFile, api } from './api';

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

  it('fetches form analytics summary with proper headers', async () => {
    const mockAnalytics = {
      success: true,
      data: {
        funnel: { views: 100, starts: 50, completes: 25, conversion_rate: 50.0 },
        dropoff: [
          { field_key: 'f_name', label: 'Nama', type: 'text', interactions: 50, dropouts: 10, drop_rate: 20.0 },
        ],
        daily: [
          { date: '2026-09-18', views: 100, starts: 50, completes: 25 },
        ],
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAnalytics,
      })
    );

    const res = await getAnalytics('form-1', 'auth-token-xyz');
    expect(res).toEqual(mockAnalytics);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/form-1/analytics'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer auth-token-xyz',
        }),
      })
    );
  });

  it('getAnalytics is available on default api object', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })
    );

    await api.getAnalytics('form-1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/form-1/analytics'),
      expect.anything()
    );
  });

  it('getAnalytics throws error when server returns error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: { message: 'Forbidden access to form analytics' },
        }),
      })
    );

    await expect(getAnalytics('form-1')).rejects.toThrow(/Forbidden access to form analytics/);
  });

  describe('uploadFile', () => {
    it('sends FormData to /api/uploads and returns data', async () => {
      const mockFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const mockData = {
        id: 'upload-123',
        filename: 'document.pdf',
        mime: 'application/pdf',
        size: 7,
        url: '/storage/uploads/document.pdf',
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockData }),
      } as Response);

      const result = await uploadFile(mockFile, 'test-token');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/uploads'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: expect.any(FormData),
        })
      );
    });

    it('throws error when server responds with failure', async () => {
      const mockFile = new File(['hello'], 'large.png', { type: 'image/png' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ success: false, error: { message: 'File size exceeds 10MB limit.' } }),
      } as Response);

      await expect(uploadFile(mockFile)).rejects.toThrow(/File size exceeds 10MB limit\./);
    });

    it('throws default error when server response is not ok and json is invalid', async () => {
      const mockFile = new File(['hello'], 'bad.png', { type: 'image/png' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json');
        },
      } as unknown as Response);

      await expect(uploadFile(mockFile)).rejects.toThrow(/status: 500/);
    });

    it('is exported on api default object', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: '1',
            filename: 'test.txt',
            mime: 'text/plain',
            size: 4,
            url: '/storage/uploads/test.txt',
          },
        }),
      } as Response);

      const res = await api.uploadFile(mockFile);
      expect(res.filename).toBe('test.txt');
    });
  });
});
