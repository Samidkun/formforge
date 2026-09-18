import { BuilderView } from '@/builder/components/BuilderView';
import { emptySchema } from '@/builder/schema';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuilderView initialSchema={emptySchema()} title={`Edit Form ${id}`} />;
}
