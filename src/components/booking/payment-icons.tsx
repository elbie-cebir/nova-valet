/**
 * Inline brand marks for the payment method picker. Approximations of the
 * official Bancontact / Visa / Mastercard logos — swap for the providers'
 * official assets before production (their brand guidelines).
 */

export function BancontactIcon() {
  return (
    <svg
      width="40"
      height="26"
      viewBox="0 0 40 26"
      role="img"
      aria-hidden="true"
    >
      <rect width="40" height="26" rx="4" fill="#fff" />
      <rect x="6" y="8" width="16" height="10" rx="2" fill="#1e4fa3" />
      <rect x="18" y="8" width="16" height="10" rx="2" fill="#ffd800" />
      <rect x="16" y="8" width="8" height="10" fill="#0a3d91" opacity="0.9" />
    </svg>
  );
}

function VisaMark() {
  return (
    <svg
      width="34"
      height="22"
      viewBox="0 0 34 22"
      role="img"
      aria-hidden="true"
    >
      <rect width="34" height="22" rx="3" fill="#fff" />
      <text
        x="17"
        y="15"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontStyle="italic"
        fontSize="10"
        fill="#1a1f71"
      >
        VISA
      </text>
    </svg>
  );
}

function MastercardMark() {
  return (
    <svg
      width="34"
      height="22"
      viewBox="0 0 34 22"
      role="img"
      aria-hidden="true"
    >
      <rect width="34" height="22" rx="3" fill="#fff" />
      <circle cx="14" cy="11" r="6" fill="#eb001b" />
      <circle cx="20" cy="11" r="6" fill="#f79e1b" opacity="0.9" />
    </svg>
  );
}

export function CardBrands() {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <VisaMark />
      <MastercardMark />
    </span>
  );
}
