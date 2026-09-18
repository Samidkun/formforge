import { useEffect, useReducer, useState } from 'react';
import { schemaReducer, emptySchema } from '../schema';
import { fetchForm, saveDraft, publishForm } from '../../lib/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useFormBuilder(formId: string, token?: string) {
  const [schema, dispatch] = useReducer(schemaReducer, emptySchema());
  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [status, setStatus] = useState<string>('draft');
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const form = await fetchForm(formId, token);
        if (cancelled) return;
        setTitle(form.title);
        setSlug(form.slug || '');
        setStatus(form.status || 'draft');
        if (form.current_version_id) {
          setCurrentVersionId(form.current_version_id);
        }
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

  const publish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    try {
      const res = await publishForm(formId, token);
      if (res.data?.form?.status) {
        setStatus(res.data.form.status);
      } else {
        setStatus('published');
      }
      if (res.data?.form?.slug) {
        setSlug(res.data.form.slug);
      }
      const versionId = res.data?.form?.current_version_id || res.data?.version?.id;
      if (versionId) {
        setCurrentVersionId(versionId);
      }
      if (res.data?.version?.version_no != null) {
        setPublishedVersion(res.data.version.version_no);
      }
      setIsPublishing(false);
      return res;
    } catch (err: unknown) {
      setIsPublishing(false);
      const msg = err instanceof Error ? err.message : 'Gagal mempublikasikan form';
      setPublishError(msg);
    }
  };

  return {
    schema,
    dispatch,
    title,
    slug,
    status,
    currentVersionId,
    publishedVersion,
    isLoading,
    loadError,
    error: loadError,
    saveError,
    saveStatus,
    save,
    isPublishing,
    publishError,
    publish,
  };
}
