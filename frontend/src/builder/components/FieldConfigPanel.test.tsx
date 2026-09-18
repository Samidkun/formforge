import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldConfigPanel } from './FieldConfigPanel';
import type { Field } from '../types';

describe('FieldConfigPanel', () => {
  it('menampilkan placeholder saat tidak ada field yang dipilih', () => {
    render(<FieldConfigPanel selectedField={null} onUpdate={() => {}} onSetOptions={() => {}} />);
    expect(screen.getByText(/Pilih field di kanvas/i)).toBeInTheDocument();
  });

  it('menampilkan konfigurasi label dan required saat field dipilih', () => {
    const field: Field = { key: 'f_1', type: 'text', label: 'Nama Lengkap', required: true };
    render(<FieldConfigPanel selectedField={field} onUpdate={() => {}} onSetOptions={() => {}} />);

    expect(screen.getByDisplayValue('Nama Lengkap')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Wajib diisi/i })).toBeChecked();
  });

  it('memanggil onUpdate saat label diubah', async () => {
    const onUpdate = vi.fn();
    const field: Field = { key: 'f_1', type: 'text', label: 'Nama' };
    render(<FieldConfigPanel selectedField={field} onUpdate={onUpdate} onSetOptions={() => {}} />);

    const input = screen.getByLabelText(/Label Field/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Email Kantor');

    expect(onUpdate).toHaveBeenCalledWith('f_1', { label: 'Email Kantor' });
  });

  it('menampilkan editor opsi HANYA untuk tipe choice atau multi_choice', () => {
    const textField: Field = { key: 'f_1', type: 'text', label: 'Nama' };
    const { rerender } = render(
      <FieldConfigPanel selectedField={textField} onUpdate={() => {}} onSetOptions={() => {}} />
    );
    expect(screen.queryByLabelText(/Opsi Pilihan/i)).not.toBeInTheDocument();

    const choiceField: Field = { key: 'f_2', type: 'choice', label: 'Paket', options: ['A', 'B'] };
    rerender(<FieldConfigPanel selectedField={choiceField} onUpdate={() => {}} onSetOptions={() => {}} />);
    expect(screen.getByLabelText(/Opsi Pilihan/i)).toBeInTheDocument();
  });

  it('memanggil onSetOptions saat opsi diubah', async () => {
    const onSetOptions = vi.fn();
    const choiceField: Field = { key: 'f_2', type: 'choice', label: 'Paket', options: ['A', 'B'] };
    render(<FieldConfigPanel selectedField={choiceField} onUpdate={() => {}} onSetOptions={onSetOptions} />);

    const textarea = screen.getByLabelText(/Opsi Pilihan/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Opsi 1\nOpsi 2\nOpsi 3');

    expect(onSetOptions).toHaveBeenCalledWith('f_2', ['Opsi 1', 'Opsi 2', 'Opsi 3']);
  });
});
