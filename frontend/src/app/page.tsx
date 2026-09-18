import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-semibold">FormForge</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Belum ada form yang dipilih.
      </p>
      <Link
        href="/forms/new/edit"
        className="mt-6 inline-block rounded bg-[var(--color-accent-primary)] px-4 py-2 font-medium text-[var(--color-bg-primary)]"
      >
        Buat form
      </Link>
    </main>
  );
}
