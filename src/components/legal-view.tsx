import { Link } from '@/i18n/navigation';
import type { BusinessDetails } from '@/lib/data/business';

/**
 * Shared renderer for /privacy and /terms. Title + back label are passed in
 * (already localized); the body is owner-authored multi-paragraph plain text
 * rendered with preserved line breaks. The business line is data only.
 */
export function LegalView({
  title,
  body,
  backLabel,
  business,
}: {
  title: string;
  body: string;
  backLabel: string;
  business: BusinessDetails | null;
}) {
  return (
    <main
      style={{
        maxWidth: 760,
        width: '100%',
        margin: '0 auto',
        padding: '36px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <Link
        href="/"
        style={{ color: 'var(--nv-muted)', fontSize: 14, fontWeight: 600 }}
      >
        ‹ {backLabel}
      </Link>
      <h1 style={{ fontSize: 'clamp(30px,4vw,48px)', lineHeight: 1.05 }}>
        {title}
      </h1>
      <div
        style={{
          whiteSpace: 'pre-line',
          fontSize: 15,
          lineHeight: 1.65,
          color: 'var(--nv-muted)',
        }}
      >
        {body}
      </div>
      {business && (
        <footer
          style={{
            marginTop: 12,
            paddingTop: 16,
            borderTop: '1px solid var(--nv-border)',
            fontSize: 13,
            color: 'var(--nv-faint)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ color: 'var(--nv-muted)', fontWeight: 600 }}>
            {business.legalName}
          </span>
          <span>{business.address}</span>
          <span className="nv-mono">{business.vatNumber}</span>
          <span>
            {business.contactEmail} · {business.contactPhone}
          </span>
        </footer>
      )}
    </main>
  );
}
