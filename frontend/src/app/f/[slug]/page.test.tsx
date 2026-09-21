import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PublicFormPage from './page';

describe('PublicFormPage (/f/[slug])', () => {
  const mockSlug = 'contact-us';
  const mockSchema = {
    fields: [
      { key: 'name', type: 'text', label: 'Name', required: true },
      { key: 'email', type: 'email', label: 'Email', required: true },
    ],
  };

  const mockFormData = {
    slug: mockSlug,
    title: 'Contact Us Form',
    version_id: 'v123',
    schema: mockSchema,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    render(<PublicFormPage params={Promise.resolve({ slug: mockSlug })} />);
    expect(screen.getByText('Memuat form...')).toBeDefined();
  });

  it('renders 404 state when form is not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: async () => ({ success: false, error: { message: 'Not found' } }),
    } as Response);

    render(<PublicFormPage params={{ slug: mockSlug }} />);

    expect(await screen.findByText('Form Tidak Ditemukan')).toBeDefined();
  });

  it('renders error state when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ success: false, error: { message: 'Database failure' } }),
    } as Response);

    render(<PublicFormPage params={{ slug: mockSlug }} />);

    expect(await screen.findByText('Database failure')).toBeDefined();
  });

  it('renders form and submits to edge API with session_id', async () => {
    let submitPayload: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes(`/f/${mockSlug}/submit`)) {
        submitPayload = JSON.parse(init?.body as string);
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            data: { submission_id: 'sub_123', status: 'complete' },
          }),
        } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: mockFormData,
        }),
      } as Response;
    });

    render(<PublicFormPage params={{ slug: mockSlug }} />);

    expect(await screen.findByText('Contact Us Form')).toBeDefined();
    expect(screen.getByLabelText(/Name/i)).toBeDefined();

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'alice@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitPayload).not.toBeNull();
      expect(submitPayload.session_id).toBeDefined();
      expect(submitPayload.status).toBe('complete');
      expect(submitPayload.answers).toEqual([
        { field_key: 'name', value: 'Alice' },
        { field_key: 'email', value: 'alice@example.com' },
      ]);
    });

    expect(await screen.findByText(/Thank You!/i)).toBeDefined();
  });

  it('supports params passed as a Promise', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: mockFormData }),
    } as Response);

    const paramsPromise = Promise.resolve({ slug: mockSlug });
    await act(async () => {
      render(<PublicFormPage params={paramsPromise} />);
    });

    expect(await screen.findByText('Contact Us Form')).toBeDefined();
  });

  it('dispatches view event on form load', async () => {
    const events: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes(`/f/${mockSlug}/event`)) {
        events.push(JSON.parse(init?.body as string));
        return { status: 204, ok: true } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: mockFormData }),
      } as Response;
    });

    render(<PublicFormPage params={{ slug: mockSlug }} />);

    await waitFor(() => {
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'view',
            session_id: expect.any(String),
          }),
        ])
      );
    });
  });

  it('dispatches telemetry events to edge API on interaction and submit', async () => {
    const events: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes(`/f/${mockSlug}/event`)) {
        events.push(JSON.parse(init?.body as string));
        return { status: 204, ok: true } as Response;
      }
      if (url.includes(`/f/${mockSlug}/submit`)) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, data: { submission_id: 'sub_123', status: 'complete' } }),
        } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: mockFormData }),
      } as Response;
    });

    render(<PublicFormPage params={{ slug: mockSlug }} />);
    await screen.findByText('Contact Us Form');

    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.focus(nameInput);
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    fireEvent.blur(nameInput);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.focus(emailInput);
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.blur(emailInput);

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'view' }),
          expect.objectContaining({ type: 'start' }),
          expect.objectContaining({ type: 'field_blur', field_key: 'name' }),
          expect.objectContaining({ type: 'field_blur', field_key: 'email' }),
          expect.objectContaining({ type: 'complete' }),
        ])
      );
    });
  });

  it('triggers debounced partial autosave and displays autosave badge', async () => {
    let partialSubmitPayload: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes(`/f/${mockSlug}/submit`)) {
        const body = JSON.parse(init?.body as string);
        if (body.status === 'partial') {
          partialSubmitPayload = body;
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            data: { submission_id: 'sub_partial_1', status: 'partial' },
          }),
        } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: mockFormData }),
      } as Response;
    });

    render(<PublicFormPage params={{ slug: mockSlug }} />);
    expect(await screen.findByText('Contact Us Form')).toBeDefined();

    vi.useFakeTimers();

    const nameInput = screen.getByLabelText(/Name/i);
    act(() => {
      fireEvent.change(nameInput, { target: { value: 'Bob' } });
    });

    // Should show "Menyimpan draf..."
    expect(screen.getByText('Menyimpan draf...')).toBeDefined();

    // Advance 3 seconds for debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(partialSubmitPayload).not.toBeNull();
    expect(partialSubmitPayload.status).toBe('partial');
    expect(partialSubmitPayload.answers).toEqual([{ field_key: 'name', value: 'Bob' }]);

    // Should show "Tersimpan otomatis"
    expect(screen.getByText('Tersimpan otomatis')).toBeDefined();

    vi.useRealTimers();
  });
});
