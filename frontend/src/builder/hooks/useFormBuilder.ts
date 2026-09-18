import { useEffect, useReducer, useState } from 'react';
import { schemaReducer, emptySchema } from '../schema';
import { fetchForm, saveDraft } from '../../lib/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useFormBuilder(formId: string, token?: string) {
  const [schema, dispatch] = useReducer(schemaReducer, emptySchema());
  const [title, setTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      setIsLoading(true);
      setError(null);
      try {
        const form = await fetchForm(formId, token);
        if (cancelled) return;
        setTitle(form.title);
        if (form.draft_schema && Array.isArray(form.draft_schema.fields)) {
          dispatch({ type: 'replace', schema: form.draft_schema });
        }
        setIsLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat form');
        setIsLoading(false);
      }
    }

    loadForm();

    return () => {
      cancelled = true;
    };
  }, [formId, token]);

  const save = async () => {
    setSaveStatus('saving');
    try {
      await saveDraft(formId, schema, token);
      setSaveStatus('saved');
    } catch (err: unknown) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Gagal menyimpan draft');
    }
  };

  return {
    schema,
    dispatch,
    title,
    isLoading,
    error,
    saveStatus,
    save,
  };
}
