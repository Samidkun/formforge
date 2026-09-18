import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldPalette } from './FieldPalette';
import { FIELD_TYPES, FIELD_LABELS } from '../fieldTypes';

describe('FieldPalette', () => {
  it('menampilkan satu tombol untuk setiap 9 field type', () => {
    render(<FieldPalette onAdd={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('label tiap tombol memakai nama manusiawi dari FIELD_LABELS', () => {
    render(<FieldPalette onAdd={() => {}} />);
    for (const t of FIELD_TYPES) {
      expect(screen.getByRole('button', { name: `Tambah field ${FIELD_LABELS[t]}` })).toBeInTheDocument();
    }
  });

  it('memanggil onAdd dengan tipe yang benar saat diklik', async () => {
    const onAdd = vi.fn();
    render(<FieldPalette onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tambah field Email' }));
    expect(onAdd).toHaveBeenCalledWith('email');
  });
});
