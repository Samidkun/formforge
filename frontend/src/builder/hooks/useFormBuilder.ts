import { useEffect, useReducer, useState } from 'react';
import { schemaReducer, emptySchema } from '../schema';
import { fetchForm, saveDraft } from '../../lib/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useFormBuilder(formId: string, token?: string) {
  const [schema, dispatch] = useReducer(schemaReducer, emptySchema());
  const [title, setTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      setIsLoading(true);
      setLoadError(null);
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
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat form');
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
    setSaveError(null);
    try {
      await saveDraft(formId, schema, token);
      setSaveStatus('saved');
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan draft');
    }
  };

  return {
    schema,
    dispatch,
    title,
    isLoading,
    loadError,
    error: loadError,
    saveError,
    saveStatus,
    save,
  };
}
