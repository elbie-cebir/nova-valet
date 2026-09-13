'use client';

import {
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import type {
  AdminService,
  AdminTier,
  AdminAddOn,
  AdminPriceCell,
} from '@/lib/data/catalog-admin';
import {
  updateServiceAction,
  updateTierAction,
  updatePricesAction,
  updateAddOnAction,
  createAddOnAction,
  updateDepositAction,
  type ActionResult,
} from '@/app/[locale]/admin/catalog/actions';

const toEuros = (c: number) => (c / 100).toFixed(2);
const toCents = (s: string) => {
  const n = Math.round(parseFloat(s.replace(',', '.')) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const input: CSSProperties = {
  height: 40,
  borderRadius: 10,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border-strong)',
  color: 'var(--nv-ink)',
  padding: '0 12px',
  fontSize: 14,
  width: '100%',
};
const card: CSSProperties = {
  borderRadius: 16,
  padding: 18,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};
const label: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--nv-muted)',
  fontWeight: 600,
};
const btn: CSSProperties = {
  alignSelf: 'flex-start',
  height: 40,
  padding: '0 18px',
  borderRadius: 999,
  border: 0,
  background: 'var(--nv-lime)',
  color: 'var(--nv-bg)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 14,
};
const h2: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  letterSpacing: '-.02em',
  margin: '8px 0 0',
};

/** Save button + inline status shared by every sub-form. */
function SaveRow({ onSave }: { onSave: () => Promise<ActionResult> }) {
  const t = useTranslations('Admin');
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        type="button"
        disabled={pending}
        style={{ ...btn, opacity: pending ? 0.6 : 1 }}
        onClick={() =>
          start(async () => {
            const r = await onSave();
            setStatus(r.ok ? 'ok' : 'err');
          })
        }
      >
        {pending ? t('catSaving') : t('catSave')}
      </button>
      {status === 'ok' && (
        <span style={{ color: 'var(--nv-lime)', fontSize: 13 }}>
          {t('catSaved')}
        </span>
      )}
      {status === 'err' && (
        <span style={{ color: 'var(--nv-err)', fontSize: 13 }}>
          {t('catError')}
        </span>
      )}
    </div>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>{title}</span>
      {children}
    </label>
  );
}

/** Three side-by-side per-locale text inputs. */
function LocaleRow({
  title,
  value,
  onChange,
  textarea,
}: {
  title: string;
  value: { nl: string; en: string; fr: string };
  onChange: (v: { nl: string; en: string; fr: string }) => void;
  textarea?: boolean;
}) {
  const t = useTranslations('Admin');
  const cols = [
    ['nl', t('colNl')],
    ['en', t('colEn')],
    ['fr', t('colFr')],
  ] as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>{title}</span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
          gap: 8,
        }}
      >
        {cols.map(([k, colLabel]) => (
          <div
            key={k}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontSize: 10, color: 'var(--nv-faint)' }}>
              {colLabel}
            </span>
            {textarea ? (
              <textarea
                style={{
                  ...input,
                  height: 60,
                  padding: 10,
                  resize: 'vertical',
                }}
                value={value[k]}
                onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              />
            ) : (
              <input
                style={input}
                value={value[k]}
                onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceForm({ service }: { service: AdminService }) {
  const t = useTranslations('Admin');
  const [name, setName] = useState({
    nl: service.nameNl,
    en: service.nameEn,
    fr: service.nameFr,
  });
  const [desc, setDesc] = useState({
    nl: service.descNl,
    en: service.descEn,
    fr: service.descFr,
  });
  const [active, setActive] = useState(service.active);
  return (
    <div style={card}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--nv-faint)',
        }}
      >
        {service.key}
      </div>
      <LocaleRow title={t('catName')} value={name} onChange={setName} />
      <LocaleRow
        title={t('catDesc')}
        value={desc}
        onChange={setDesc}
        textarea
      />
      <label
        style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        {t('catActive')}
      </label>
      <SaveRow
        onSave={() =>
          updateServiceAction({ id: service.id, name, desc, active })
        }
      />
    </div>
  );
}

function TierForm({ tier }: { tier: AdminTier }) {
  const t = useTranslations('Admin');
  const [lab, setLab] = useState({
    nl: tier.labelNl,
    en: tier.labelEn,
    fr: tier.labelFr,
  });
  const [desc, setDesc] = useState({
    nl: tier.descNl,
    en: tier.descEn,
    fr: tier.descFr,
  });
  return (
    <div style={card}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--nv-faint)',
        }}
      >
        {tier.key}
      </div>
      <LocaleRow title={t('catLabel')} value={lab} onChange={setLab} />
      <LocaleRow title={t('catSizeDesc')} value={desc} onChange={setDesc} />
      <SaveRow
        onSave={() => updateTierAction({ id: tier.id, label: lab, desc })}
      />
    </div>
  );
}

function AddOnForm({ addOn }: { addOn: AdminAddOn }) {
  const t = useTranslations('Admin');
  const [name, setName] = useState({
    nl: addOn.nameNl,
    en: addOn.nameEn,
    fr: addOn.nameFr,
  });
  const [amount, setAmount] = useState(toEuros(addOn.amountCents));
  const [active, setActive] = useState(addOn.active);
  return (
    <div style={card}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--nv-faint)',
        }}
      >
        {addOn.key}
      </div>
      <LocaleRow title={t('catName')} value={name} onChange={setName} />
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ maxWidth: 160 }}>
          <Field title={t('catAmount')}>
            <input
              style={input}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t('catActive')}
        </label>
      </div>
      <SaveRow
        onSave={() =>
          updateAddOnAction({
            id: addOn.id,
            name,
            amountCents: toCents(amount),
            active,
          })
        }
      />
    </div>
  );
}

function NewAddOnForm() {
  const t = useTranslations('Admin');
  const [key, setKey] = useState('');
  const [name, setName] = useState({ nl: '', en: '', fr: '' });
  const [amount, setAmount] = useState('0.00');
  return (
    <div style={{ ...card, borderStyle: 'dashed' }}>
      <div style={label}>{t('catNewAddon')}</div>
      <div style={{ maxWidth: 220 }}>
        <Field title={t('catKey')}>
          <input
            style={input}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="pet_hair"
          />
        </Field>
      </div>
      <LocaleRow title={t('catName')} value={name} onChange={setName} />
      <div style={{ maxWidth: 160 }}>
        <Field title={t('catAmount')}>
          <input
            style={input}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <SaveRow
        onSave={() =>
          createAddOnAction({ key, name, amountCents: toCents(amount) })
        }
      />
    </div>
  );
}

function DepositForm({ depositCents }: { depositCents: number }) {
  const t = useTranslations('Admin');
  const [amount, setAmount] = useState(toEuros(depositCents));
  return (
    <div style={card}>
      <div style={{ maxWidth: 200 }}>
        <Field title={t('catDeposit')}>
          <input
            style={input}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <div style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
        {t('catDepositHelp')}
      </div>
      <SaveRow
        onSave={() => updateDepositAction({ amountCents: toCents(amount) })}
      />
    </div>
  );
}

function PriceMatrixForm({
  services,
  tiers,
  prices,
}: {
  services: AdminService[];
  tiers: AdminTier[];
  prices: AdminPriceCell[];
}) {
  const t = useTranslations('Admin');
  const initial: Record<string, string> = {};
  for (const s of services) {
    for (const tier of tiers) {
      const cell = prices.find(
        (p) => p.serviceId === s.id && p.tierId === tier.id,
      );
      initial[`${s.id}|${tier.id}`] = toEuros(cell?.amountCents ?? 0);
    }
  }
  const [grid, setGrid] = useState(initial);
  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 520 }}>
        <thead>
          <tr>
            <th style={{ ...label, textAlign: 'left', padding: 6 }}>
              {t('catService')}
            </th>
            {tiers.map((tier) => (
              <th key={tier.id} style={{ ...label, padding: 6 }}>
                {tier.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: 6, fontSize: 13 }}>{s.key}</td>
              {tiers.map((tier) => {
                const k = `${s.id}|${tier.id}`;
                return (
                  <td key={tier.id} style={{ padding: 4 }}>
                    <input
                      style={{ ...input, width: 90 }}
                      inputMode="decimal"
                      value={grid[k]}
                      onChange={(e) =>
                        setGrid({ ...grid, [k]: e.target.value })
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <SaveRow
        onSave={() => {
          const cells = Object.entries(grid).map(([k, v]) => {
            const [serviceId, tierId] = k.split('|');
            return { serviceId, tierId, amountCents: toCents(v) };
          });
          return updatePricesAction({ cells });
        }}
      />
    </div>
  );
}

export function CatalogEditor({
  services,
  tiers,
  addOns,
  prices,
  depositCents,
}: {
  services: AdminService[];
  tiers: AdminTier[];
  addOns: AdminAddOn[];
  prices: AdminPriceCell[];
  depositCents: number;
}) {
  const t = useTranslations('Admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={h2}>{t('catDeposit')}</h2>
      <DepositForm depositCents={depositCents} />

      <h2 style={h2}>{t('catPrices')}</h2>
      <PriceMatrixForm services={services} tiers={tiers} prices={prices} />

      <h2 style={h2}>{t('catServices')}</h2>
      {services.map((s) => (
        <ServiceForm key={s.id} service={s} />
      ))}

      <h2 style={h2}>{t('catSizes')}</h2>
      {tiers.map((tier) => (
        <TierForm key={tier.id} tier={tier} />
      ))}

      <h2 style={h2}>{t('catAddons')}</h2>
      {addOns.map((a) => (
        <AddOnForm key={a.id} addOn={a} />
      ))}
      <NewAddOnForm />
    </div>
  );
}
