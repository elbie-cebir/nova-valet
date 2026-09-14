import { Link } from '@/i18n/navigation';

/**
 * Shared admin list pager. Renders ‹ current/total › as prev/next links on the
 * given path (query param `p`). Copy-free (arrows + numbers only).
 */
export function Pager({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const linkStyle = { color: 'var(--nv-ink)', fontSize: 18, padding: '0 6px' };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
        color: 'var(--nv-muted)',
      }}
    >
      {page > 1 ? (
        <Link href={`${basePath}?p=${page - 1}`} style={linkStyle}>
          ‹
        </Link>
      ) : (
        <span />
      )}
      <span>
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`${basePath}?p=${page + 1}`} style={linkStyle}>
          ›
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
