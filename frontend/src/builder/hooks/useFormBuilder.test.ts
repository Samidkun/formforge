import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormBuilder } from './useFormBuilder';
import * as api from '../../lib/api';

describe('useFormBuilder hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menginisialisasi schema kosong saat memuat', () => {
    vi.spyOn(api, 'fetchForm').mockImplementation(() => new Promise(() => {})); // pending
    const { result } = renderHook(() => useFormBuilder('uuid-1'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.schema).toEqual({ fields: [] });
    expect(result.current.saveStatus).toBe('idle');
  });

  it('memuat schema dan title dari API', async () => {
    vi.spyOn(api, 'fetchForm').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Pendaftaran Anggota',
      slug: 'pendaftaran-anggota',
      status: 'draft',
      draft_schema: { fields: [{ key: 'f_1', type: 'text', label: 'Nama' }] },
    });

    const { result } = renderHook(() => useFormBuilder('uuid-1'));

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.title).toBe('Pendaftaran Anggota');
    expect(result.current.schema.fields).toHaveLength(1);
    expect(result.current.schema.fields[0].key).toBe('f_1');
  });

  it('menangani error saat fetchForm gagal', async () => {
    vi.spyOn(api, 'fetchForm').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFormBuilder('uuid-1'));

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadError).toBe('Network error');
    expect(result.current.error).toBe('Network error');
  });

  it('menyimpan schema saat save dipanggil dan mengubah status jadi saved', async () => {
    vi.spyOn(api, 'fetchForm').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Test Form',
      slug: 'test-form',
      status: 'draft',
      draft_schema: { fields: [] },
    });
    const saveSpy = vi.spyOn(api, 'saveDraft').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Test Form',
      slug: 'test-form',
      status: 'draft',
      draft_schema: { fields: [{ key: 'f_1', type: 'text', label: 'Teks' }] },
    });

    const { result } = renderHook(() => useFormBuilder('uuid-1', 'auth-token-123'));
    await act(async () => {});

    act(() => {
      result.current.dispatch({ type: 'add_field', fieldType: 'text' });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(saveSpy).toHaveBeenCalledWith(
      'uuid-1',
      expect.objectContaining({
        fields: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
      }),
      'auth-token-123'
    );
    expect(result.current.saveStatus).toBe('saved');
  });

  it('mengatur saveStatus error saat saveDraft gagal tanpa mengubah loadError', async () => {
    vi.spyOn(api, 'fetchForm').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Test Form',
      slug: 'test-form',
      status: 'draft',
      draft_schema: { fields: [] },
    });
    vi.spyOn(api, 'saveDraft').mockRejectedValueOnce(new Error('Failed to save'));

    const { result } = renderHook(() => useFormBuilder('uuid-1'));
    await act(async () => {});

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.saveStatus).toBe('error');
    expect(result.current.saveError).toBe('Failed to save');
    expect(result.current.loadError).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
