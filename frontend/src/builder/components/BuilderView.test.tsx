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

  it('menampilkan tab navigasi Builder (aktif) dan link Responses ke /forms/:id/responses', () => {
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
  });
});
