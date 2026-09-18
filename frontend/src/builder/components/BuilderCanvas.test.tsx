import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderCanvas } from './BuilderCanvas';
import type { Schema } from '../types';

describe('BuilderCanvas', () => {
  it('menampilkan pesan kosong bila belum ada field', () => {
    const schema: Schema = { fields: [] };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey={null}
        onSelect={() => {}}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );
    expect(screen.getByText(/Tarik atau tambahkan field dari palet/i)).toBeInTheDocument();
  });

  it('merender setiap item field dengan label dan tipenya', () => {
    const schema: Schema = {
      fields: [
        { key: 'f_1', type: 'text', label: 'Nama' },
        { key: 'f_2', type: 'email', label: 'Email Kantor', required: true },
      ],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey="f_1"
        onSelect={() => {}}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );

    expect(screen.getByText('Nama')).toBeInTheDocument();
    expect(screen.getByText('Email Kantor')).toBeInTheDocument();
  });

  it('memanggil onSelect saat item diklik', async () => {
    const onSelect = vi.fn();
    const schema: Schema = {
      fields: [{ key: 'f_1', type: 'text', label: 'Nama' }],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey={null}
        onSelect={onSelect}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );

    await userEvent.click(screen.getByText('Nama'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('f_1');
  });

  it('memanggil onSelect(null) saat background kanvas diklik', async () => {
    const onSelect = vi.fn();
    const schema: Schema = {
      fields: [{ key: 'f_1', type: 'text', label: 'Nama' }],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey="f_1"
        onSelect={onSelect}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );

    await userEvent.click(screen.getByLabelText('Kanvas Form'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('memanggil onRemove saat tombol hapus diklik', async () => {
    const onRemove = vi.fn();
    const schema: Schema = {
      fields: [{ key: 'f_1', type: 'text', label: 'Nama' }],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey={null}
        onSelect={() => {}}
        onRemove={onRemove}
        onMove={() => {}}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hapus field f_1/i }));
    expect(onRemove).toHaveBeenCalledWith('f_1');
  });
});
