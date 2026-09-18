import { FieldPalette } from '@/builder/components/FieldPalette';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2">
        <span className="text-sm text-[var(--color-text-secondary)]">
          Form <span className="num">{id}</span>
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Task 5 mengganti placeholder ini dengan BuilderCanvas. */}
        <FieldPalette onAdd={() => {}} />
        <section className="flex-1 p-6 text-[var(--color-text-muted)]">
          Kanvas kosong — tambahkan field dari palet.
        </section>
      </div>
    </main>
  );
}
