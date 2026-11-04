import { NavLink, Link } from 'react-router-dom';
import type { Manifest } from '@/types';
import { useTheme } from '@/lib/theme';
import { useLibrary } from '@/lib/library';

interface Props {
  manifest: Manifest;
  /** Left side of the strap: date / issue number. */
  strapLeft?: React.ReactNode;
  strapRight?: React.ReactNode;
  tagline?: string;
}

const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' } as const;

export function Masthead({ manifest, strapLeft, strapRight, tagline }: Props) {
  const { theme, cycle } = useTheme();
  const { state } = useLibrary();
  const savedCount = Object.keys(state.saved).length;

  return (
    <header className="masthead">
      <div className="strap">
        <div className="strap-left">{strapLeft}</div>
        <div className="strap-right">
          {strapRight}
          <button type="button" className="strap-button" onClick={cycle} aria-label={`Theme: ${THEME_LABEL[theme]}. Click to change.`}>
            <span aria-hidden="true">◐</span> {THEME_LABEL[theme]}
          </button>
        </div>
      </div>

      <Link to="/" className="nameplate">
        {manifest.publicationName}
      </Link>
      {tagline && <p className="tagline">{tagline}</p>}

      <nav className="sections" aria-label="Editions">
        {manifest.editions.map((e) => (
          <NavLink
            key={e.slug}
            to={`/${e.slug}`}
            className={({ isActive }) => `section-link${isActive ? ' is-active' : ''}`}
            style={{ '--accent-l': e.accent.light, '--accent-d': e.accent.dark } as React.CSSProperties}
          >
            {e.name}
          </NavLink>
        ))}
        <NavLink to="/reading-list" className={({ isActive }) => `section-link section-link--list${isActive ? ' is-active' : ''}`}>
          Reading list{savedCount > 0 && <span className="count-badge">{savedCount}</span>}
        </NavLink>
        <NavLink to="/archive" className={({ isActive }) => `section-link section-link--list${isActive ? ' is-active' : ''}`}>
          Old archive
        </NavLink>
      </nav>
    </header>
  );
}
