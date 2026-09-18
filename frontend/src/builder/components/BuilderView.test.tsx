import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderView } from './BuilderView';
import { schemaReducer } from '../schema';
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

  it('menampilkan tombol Publish dan memanggil onPublish saat diklik', async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();

    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        onPublish={onPublish}
      />
    );

    const publishBtn = screen.getByRole('button', { name: /Publish/i });
    expect(publishBtn).toBeInTheDocument();
    expect(publishBtn).toBeEnabled();

    await user.click(publishBtn);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('men-disable tombol Publish saat isPublishing=true', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        isPublishing={true}
        onPublish={vi.fn()}
      />
    );

    const publishBtn = screen.getByRole('button', { name: /Publishing.../i });
    expect(publishBtn).toBeDisabled();
  });

  it('menampilkan badge Published dan link publik saat status="published"', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        status="published"
        slug="pendaftaran-siswa"
      />
    );

    expect(screen.getByText('Published')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /\/f\/pendaftaran-siswa/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/f/pendaftaran-siswa');
  });

  it('menyediakan tombol copy link untuk menyalin URL publik', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        status="published"
        slug="pendaftaran-siswa"
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy/i });
    expect(copyBtn).toBeInTheDocument();

    await user.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/f/pendaftaran-siswa'));
    expect(await screen.findByText(/Copied!/i)).toBeInTheDocument();
  });

  it('menampilkan pesan publishError jika terjadi kesalahan publish', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        publishError="Cannot publish form with zero fields."
      />
    );

    expect(screen.getByText('Cannot publish form with zero fields.')).toBeInTheDocument();
  });

  it('menampilkan tab navigasi Builder (aktif), link Responses, dan link Analytics ke /forms/:id/analytics', () => {
    render(
      <BuilderView
        schema={mockSchema}
        dispatch={vi.fn()}
        title="Form Pendaftaran"
        formId="form-abc"
      />
    );

    expect(screen.getByText('Builder')).toBeInTheDocument();
    const responsesLink = screen.getByRole('link', { name: /Responses/i });
    expect(responsesLink).toBeInTheDocument();
    expect(responsesLink).toHaveAttribute('href', '/forms/form-abc/responses');
    const analyticsLink = screen.getByRole('link', { name: /Analytics/i });
    expect(analyticsLink).toBeInTheDocument();
    expect(analyticsLink).toHaveAttribute('href', '/forms/form-abc/analytics');
  });

  it('meneruskan blok logic dari FieldConfigPanel ke schema state (end-to-end via reducer)', async () => {
    const user = userEvent.setup();

    // Harness: pakai reducer asli supaya jalur dispatch → schema state benar-benar teruji,
    // bukan sekadar memastikan sebuah fungsi dipanggil.
    function Harness() {
      const [schema, dispatch] = React.useReducer(schemaReducer, {
        fields: [
          { key: 'f_1', type: 'choice' as const, label: 'Langganan?', options: ['Ya', 'Tidak'] },
          { key: 'f_2', type: 'email' as const, label: 'Email' },
        ],
      });
      return (
        <>
          <BuilderView schema={schema} dispatch={dispatch} title="Form Logic" />
          <pre data-testid="schema-json">{JSON.stringify(schema)}</pre>
        </>
      );
    }

    render(<Harness />);

    // Pilih field kedua (f_2) lewat canvas — pakai teks key supaya unik
    // (label "Email" juga muncul sebagai nama tipe di palet).
    await user.click(screen.getByText(/·\s*f_2/));

    // Aktifkan syarat tampil.
    const toggle = await screen.findByLabelText(/Aktifkan syarat tampil/i);
    await user.click(toggle);

    // Logic harus benar-benar tersimpan di schema state, bukan hilang di tengah jalan.
    await waitFor(() => {
      const parsed = JSON.parse(screen.getByTestId('schema-json').textContent || '{}');
      const f2 = parsed.fields.find((f: { key: string }) => f.key === 'f_2');
      expect(f2.logic).toBeDefined();
      expect(f2.logic.showIf.field).toBe('f_1');
    });

    // Matikan lagi → blok logic harus terhapus sepenuhnya.
    await user.click(toggle);
    await waitFor(() => {
      const parsed = JSON.parse(screen.getByTestId('schema-json').textContent || '{}');
      const f2 = parsed.fields.find((f: { key: string }) => f.key === 'f_2');
      expect(f2.logic).toBeUndefined();
    });
  });
});
