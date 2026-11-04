import { Navigate, Route, Routes } from 'react-router-dom';
import { loadManifest, useAsync } from '@/lib/data';
import { EditionPage } from '@/pages/EditionPage';
import { ReadingList } from '@/pages/ReadingList';
import { LegacyArchive } from '@/pages/LegacyArchive';

export default function App() {
  const manifest = useAsync(loadManifest, 'manifest');

  if (manifest.status === 'loading') return <p className="loading boot">Setting the type…</p>;
  if (manifest.status === 'error') {
    return (
      <div className="notice boot">
        <h2>The press is down</h2>
        <p>
          The edition manifest could not be loaded ({manifest.error}).{' '}
          <button type="button" className="link-button" onClick={() => location.reload()}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  const m = manifest.data;
  const first = m.editions.find((e) => e.latest) ?? m.editions[0];
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${first?.slug ?? 'general'}`} replace />} />
      <Route path="/reading-list" element={<ReadingList manifest={m} />} />
      <Route path="/archive" element={<LegacyArchive manifest={m} />} />
      <Route path="/archive/:date" element={<LegacyArchive manifest={m} />} />
      <Route path="/:slug" element={<EditionPage manifest={m} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
