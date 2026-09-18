import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldConfigPanel } from './FieldConfigPanel';
import type { Field, FormField } from '../types';

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

  it('mempertahankan newline saat mengetik di textarea opsi meskipun options ter-filter', async () => {
    let currentField: Field = { key: 'f_2', type: 'choice', label: 'Paket', options: [] };
    const onSetOptions = vi.fn((key: string, options: string[]) => {
      // Simulasikan schemaReducer yang menghapus string kosong pada array opsi
      currentField = {
        ...currentField,
        options: options.map((o) => o.trim()).filter((o) => o !== ''),
      };
      rerender(
        <FieldConfigPanel
          selectedField={currentField}
          onUpdate={() => {}}
          onSetOptions={onSetOptions}
        />
      );
    });

    const { rerender } = render(
      <FieldConfigPanel
        selectedField={currentField}
        onUpdate={() => {}}
        onSetOptions={onSetOptions}
      />
    );

    const textarea = screen.getByLabelText(/Opsi Pilihan/i);
    await userEvent.type(textarea, 'A\n');

    expect(textarea).toHaveValue('A\n');
    expect(onSetOptions).toHaveBeenCalledWith('f_2', ['A', '']);
  });

  it('renders conditional logic configuration for fields with prior fields', () => {
    const priorField: FormField = { key: 'f_1', type: 'choice', label: 'Status', required: true, options: ['A', 'B'] };
    const currentField: FormField = { key: 'f_2', type: 'text', label: 'Detail', required: false };

    render(
      <FieldConfigPanel
        field={currentField}
        allFields={[priorField, currentField]}
        dispatch={vi.fn()}
      />
    );

    expect(screen.getAllByText(/Syarat Tampil/i)[0]).toBeDefined();
    expect(screen.getByLabelText(/Aktifkan syarat tampil/i)).toBeInTheDocument();
  });

  it('does not render conditional logic section when no prior fields exist', () => {
    const firstField: FormField = { key: 'f_1', type: 'text', label: 'First Field' };

    render(
      <FieldConfigPanel
        field={firstField}
        allFields={[firstField]}
        dispatch={vi.fn()}
      />
    );

    expect(screen.queryByText(/Syarat Tampil/i)).not.toBeInTheDocument();
  });

  it('enabling conditional logic and selecting trigger field, operator, and value dispatches UPDATE_FIELD action with updated field.logic', () => {
    const dispatch = vi.fn();
    const priorField1: FormField = { key: 'f_1', type: 'choice', label: 'Status', options: ['Aktif', 'Nonaktif'] };
    const priorField2: FormField = { key: 'f_2', type: 'text', label: 'Alasan' };
    const currentField: FormField = { key: 'f_3', type: 'text', label: 'Detail Lanjutan', required: false };

    render(
      <FieldConfigPanel
        field={currentField}
        allFields={[priorField1, priorField2, currentField]}
        dispatch={dispatch}
      />
    );

    const enableCheckbox = screen.getByLabelText(/Aktifkan syarat tampil/i);
    expect(enableCheckbox).not.toBeChecked();

    // Enable conditional logic
    fireEvent.click(enableCheckbox);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_FIELD',
        payload: expect.objectContaining({
          key: 'f_3',
          field: expect.objectContaining({
            logic: expect.objectContaining({
              showIf: expect.objectContaining({
                field: 'f_1',
                op: 'equals',
              }),
            }),
          }),
        }),
      })
    );

    // Select different trigger field (f_2)
    const triggerSelect = screen.getByLabelText(/Field Pemicu/i);
    fireEvent.change(triggerSelect, { target: { value: 'f_2' } });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_FIELD',
        payload: expect.objectContaining({
          key: 'f_3',
          field: expect.objectContaining({
            logic: expect.objectContaining({
              showIf: expect.objectContaining({
                field: 'f_2',
              }),
            }),
          }),
        }),
      })
    );

    // Select operator (not_equals)
    const opSelect = screen.getByLabelText(/Operator/i);
    fireEvent.change(opSelect, { target: { value: 'not_equals' } });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_FIELD',
        payload: expect.objectContaining({
          key: 'f_3',
          field: expect.objectContaining({
            logic: expect.objectContaining({
              showIf: expect.objectContaining({
                op: 'not_equals',
              }),
            }),
          }),
        }),
      })
    );

    // Enter value
    const valueInput = screen.getByLabelText(/Nilai Acuan/i);
    fireEvent.change(valueInput, { target: { value: 'Spesial' } });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_FIELD',
        payload: expect.objectContaining({
          key: 'f_3',
          field: expect.objectContaining({
            logic: {
              showIf: {
                field: 'f_2',
                op: 'not_equals',
                value: 'Spesial',
              },
            },
          }),
        }),
      })
    );
  });

  it('disabling conditional logic removes field.logic', () => {
    const dispatch = vi.fn();
    const priorField: FormField = { key: 'f_1', type: 'choice', label: 'Status', options: ['A', 'B'] };
    const currentField: FormField = {
      key: 'f_2',
      type: 'text',
      label: 'Detail',
      required: false,
      logic: {
        showIf: {
          field: 'f_1',
          op: 'equals',
          value: 'A',
        },
      },
    };

    render(
      <FieldConfigPanel
        field={currentField}
        allFields={[priorField, currentField]}
        dispatch={dispatch}
      />
    );

    const enableCheckbox = screen.getByLabelText(/Aktifkan syarat tampil/i);
    expect(enableCheckbox).toBeChecked();

    fireEvent.click(enableCheckbox);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_FIELD',
        payload: expect.objectContaining({
          key: 'f_2',
          field: expect.objectContaining({
            logic: undefined,
          }),
        }),
      })
    );
  });

  it('hides value input when operator is filled or empty', () => {
    const dispatch = vi.fn();
    const priorField: FormField = { key: 'f_1', type: 'text', label: 'Status' };
    const currentField: FormField = {
      key: 'f_2',
      type: 'text',
      label: 'Detail',
      logic: {
        showIf: {
          field: 'f_1',
          op: 'filled',
        },
      },
    };

    render(
      <FieldConfigPanel
        field={currentField}
        allFields={[priorField, currentField]}
        dispatch={dispatch}
      />
    );

    expect(screen.queryByLabelText(/Nilai Acuan/i)).not.toBeInTheDocument();
  });
});
