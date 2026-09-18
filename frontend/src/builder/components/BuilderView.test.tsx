import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderView } from './BuilderView';
import type { Schema } from '../types';

describe('BuilderView component', () => {
  const mockSchema: Schema = {
    fields: [
      { key: 'f_1', type: 'text', label: 'Nama Lengkap' },
    ],
  };

  it('menampilkan status loading saat isLoading=true', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Ujian"
        isLoading={true}
      />
    );

    expect(screen.getByText('Memuat form...')).toBeInTheDocument();
    expect(screen.queryByText('Form Ujian')).not.toBeInTheDocument();
  });

  it('menampilkan judul form dan tombol Simpan Draft', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Form Pendaftaran')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Simpan Draft/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('menampilkan indikator Menyimpan dan men-disable tombol saat saveStatus="saving"', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        saveStatus="saving"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Menyimpan...')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Simpan Draft/i });
    expect(button).toBeDisabled();
  });

  it('menampilkan indikator Draft tersimpan saat saveStatus="saved"', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        saveStatus="saved"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Draft tersimpan')).toBeInTheDocument();
  });

  it('menampilkan indikator Gagal simpan saat saveStatus="error"', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        saveStatus="error"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Gagal simpan')).toBeInTheDocument();
  });

  it('memanggil onSave saat tombol Simpan Draft diklik', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        saveStatus="idle"
        onSave={onSave}
      />
    );

    const button = screen.getByRole('button', { name: /Simpan Draft/i });
    await user.click(button);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
