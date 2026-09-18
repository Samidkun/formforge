import { describe, it, expect } from 'vitest';
import {
  schemaReducer, emptySchema, nextFieldKey, addField, canAddField, MAX_FIELDS,
} from './schema';
import type { Schema } from './types';

const withFields = (n: number): Schema => ({
  fields: Array.from({ length: n }, (_, i) => ({
    key: `f_${i + 1}`, type: 'text' as const, label: `F${i + 1}`,
  })),
});

describe('emptySchema', () => {
  it('mulai dari nol field', () => {
    expect(emptySchema()).toEqual({ fields: [] });
  });
});

describe('nextFieldKey', () => {
  it('memberi f_1 pada schema kosong', () => {
    expect(nextFieldKey(emptySchema())).toBe('f_1');
  });

  it('melanjutkan dari nomor tertinggi, bukan dari panjang array', () => {
    // f_2 dihapus → panjang 1, tapi nomor tertinggi tetap 3 → berikutnya f_4
    const s: Schema = { fields: [
      { key: 'f_1', type: 'text', label: 'A' },
      { key: 'f_3', type: 'text', label: 'C' },
    ] };
    expect(nextFieldKey(s)).toBe('f_4');
  });

  it('tidak menabrak key non-standar', () => {
    const s: Schema = { fields: [{ key: 'f_9', type: 'text', label: 'X' }] };
    expect(nextFieldKey(s)).toBe('f_10');
  });
});

describe('addField', () => {
  it('menambahkan field dengan key dan label default dari tipe', () => {
    const s = addField(emptySchema(), 'email');
    expect(s.fields).toHaveLength(1);
    expect(s.fields[0].key).toBe('f_1');
    expect(s.fields[0].type).toBe('email');
    expect(s.fields[0].label).toBe('Email');
  });

  it('tidak memutasi schema lama (immutable)', () => {
    const before = emptySchema();
    const after = addField(before, 'text');
    expect(before.fields).toHaveLength(0);
    expect(after).not.toBe(before);
  });
});

describe('canAddField', () => {
  it('true di bawah batas', () => {
    expect(canAddField(withFields(MAX_FIELDS - 1))).toBe(true);
  });
  it('false tepat di batas', () => {
    expect(canAddField(withFields(MAX_FIELDS))).toBe(false);
  });
});

describe('schemaReducer — add_field', () => {
  it('menambah field baru di akhir', () => {
    const s = schemaReducer(withFields(1), { type: 'add_field', fieldType: 'rating' });
    expect(s.fields).toHaveLength(2);
    expect(s.fields[1]).toMatchObject({ key: 'f_2', type: 'rating', label: 'Rating' });
  });

  it('menolak menambah melewati MAX_FIELDS', () => {
    const full = withFields(MAX_FIELDS);
    const s = schemaReducer(full, { type: 'add_field', fieldType: 'text' });
    expect(s.fields).toHaveLength(MAX_FIELDS);
    expect(s).toBe(full); // tidak berubah sama sekali
  });
});

describe('schemaReducer — remove_field', () => {
  it('membuang field berdasarkan key', () => {
    const s = schemaReducer(withFields(3), { type: 'remove_field', key: 'f_2' });
    expect(s.fields.map((f) => f.key)).toEqual(['f_1', 'f_3']);
  });

  it('key yang tidak ada = no-op yang tetap immutable', () => {
    const before = withFields(2);
    const s = schemaReducer(before, { type: 'remove_field', key: 'tidak_ada' });
    expect(s.fields).toEqual(before.fields);
    expect(s).not.toBe(before);
  });
});

describe('schemaReducer — move_field', () => {
  it('memindahkan field ke indeks tujuan', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_1', toIndex: 2 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_2', 'f_3', 'f_1']);
  });

  it('memindahkan ke atas', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_3', toIndex: 0 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_3', 'f_1', 'f_2']);
  });

  it('toIndex di luar batas dijepit ke dalam rentang', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_1', toIndex: 99 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_2', 'f_3', 'f_1']);
  });

  it('toIndex negatif dijepit ke nol', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_3', toIndex: -1 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_3', 'f_1', 'f_2']);
  });

  it('key tidak dikenal = no-op', () => {
    const before = withFields(2);
    const s = schemaReducer(before, { type: 'move_field', key: 'x', toIndex: 0 });
    expect(s.fields).toEqual(['f_1', 'f_2'].map((key, i) => ({ key, type: 'text' as const, label: `F${i + 1}` })));
  });
});

describe('schemaReducer — update_field', () => {
  it('mengubah label', () => {
    const s = schemaReducer(withFields(1), { type: 'update_field', key: 'f_1', patch: { label: 'Nama Lengkap' } });
    expect(s.fields[0].label).toBe('Nama Lengkap');
  });

  it('mengubah required tanpa menyentuh field lain', () => {
    const s = schemaReducer(withFields(2), { type: 'update_field', key: 'f_2', patch: { required: true } });
    expect(s.fields[0].required).toBeUndefined();
    expect(s.fields[1].required).toBe(true);
  });

  it('tidak bisa mengubah key atau type lewat patch', () => {
    const s = schemaReducer(withFields(1), {
      type: 'update_field', key: 'f_1',
      patch: { key: 'hacked', type: 'file' } as never,
    });
    expect(s.fields[0].key).toBe('f_1');
    expect(s.fields[0].type).toBe('text');
  });
});

describe('schemaReducer — set_options', () => {
  it('menyimpan opsi untuk field pilihan', () => {
    const s = schemaReducer(withFields(1), { type: 'set_options', key: 'f_1', options: ['A', 'B'] });
    expect(s.fields[0].options).toEqual(['A', 'B']);
  });

  it('membuang opsi kosong/whitespace dan mempertahankan urutan', () => {
    const s = schemaReducer(withFields(1), { type: 'set_options', key: 'f_1', options: [' A ', '', '   ', 'B'] });
    expect(s.fields[0].options).toEqual(['A', 'B']);
  });
});

describe('schemaReducer — set_logic', () => {
  it('menyimpan blok logic pada field yang ditargetkan', () => {
    const s = schemaReducer(withFields(2), {
      type: 'set_logic',
      key: 'f_2',
      logic: { showIf: { field: 'f_1', op: 'equals', value: 'Yes' } },
    });
    expect(s.fields[1].logic).toEqual({ showIf: { field: 'f_1', op: 'equals', value: 'Yes' } });
    expect(s.fields[0].logic).toBeUndefined();
  });

  it('logic=undefined menghapus blok logic (toggle off)', () => {
    const withLogic = schemaReducer(withFields(1), {
      type: 'set_logic',
      key: 'f_1',
      logic: { showIf: { field: 'f_1', op: 'filled' } },
    });
    expect(withLogic.fields[0].logic).toBeDefined();

    const s = schemaReducer(withLogic, { type: 'set_logic', key: 'f_1', logic: undefined });
    expect(s.fields[0].logic).toBeUndefined();
    expect('logic' in s.fields[0]).toBe(false);
  });

  it('tidak menyentuh field lain dan tetap immutable', () => {
    const before = withFields(3);
    const snapshot = JSON.stringify(before);
    const s = schemaReducer(before, {
      type: 'set_logic',
      key: 'f_2',
      logic: { showIf: { field: 'f_1', op: 'filled' } },
    });
    expect(s).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(s.fields[0]).toEqual(before.fields[0]);
    expect(s.fields[0]).toBe(before.fields[0]); // field lain dipertahankan by-reference (tidak disalin sia-sia)
    expect(s.fields[1]).not.toBe(before.fields[1]); // field yang diubah = objek baru
  });

  it('key tidak dikenal = no-op yang tetap immutable', () => {
    const before = withFields(1);
    const s = schemaReducer(before, { type: 'set_logic', key: 'tidak_ada', logic: undefined });
    expect(s.fields).toEqual(before.fields);
    expect(s).not.toBe(before);
  });
});

describe('schemaReducer — replace', () => {
  it('mengganti seluruh schema (dipakai saat memuat draft dari API)', () => {
    const loaded: Schema = { fields: [{ key: 'f_1', type: 'date', label: 'Tanggal' }] };
    const s = schemaReducer(withFields(5), { type: 'replace', schema: loaded });
    expect(s).toEqual(loaded);
  });
});

describe('schemaReducer — immutability menyeluruh', () => {
  it('setiap aksi mengembalikan objek baru dan tidak mengubah input', () => {
    const before = withFields(3);
    const snapshot = JSON.stringify(before);
    const actions = [
      { type: 'add_field', fieldType: 'text' },
      { type: 'remove_field', key: 'f_2' },
      { type: 'move_field', key: 'f_1', toIndex: 2 },
      { type: 'update_field', key: 'f_1', patch: { label: 'X' } },
      { type: 'set_options', key: 'f_1', options: ['Z'] },
    ] as const;
    for (const a of actions) {
      const out = schemaReducer(before, a as never);
      expect(out).not.toBe(before);
      expect(JSON.stringify(before)).toBe(snapshot);
    }
  });
});
