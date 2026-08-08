import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  path: string; // absolute path, e.g. '/secure-messaging'
}

const SITE_URL = 'https://voiceid.online';

/** Builds the schema.org BreadcrumbList JSON-LD block for a crumb trail. */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

/** Visual breadcrumb trail. Always include Home as the implicit first crumb. */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ label: 'Home', path: '/' }, ...items];

  return (
    <nav aria-label="Breadcrumb" className="pt-24 sm:pt-28 px-4 sm:px-6 max-w-5xl mx-auto">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {i === 0 ? (
                <Link to={crumb.path} className="flex items-center gap-1 hover:text-black" aria-label="Home">
                  <Home size={14} aria-hidden="true" />
                </Link>
              ) : isLast ? (
                <span className="font-medium text-gray-900" aria-current="page">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="hover:text-black">{crumb.label}</Link>
              )}
              {!isLast && <ChevronRight size={14} className="text-gray-300" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
