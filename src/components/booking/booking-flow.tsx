'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LOCALES } from '@/i18n/routing';
import { formatMoney } from '@/lib/format';
import {
  lookupTravelFeeAction,
  getUpcomingSlotsAction,
  reserveBookingAction,
  type SlotView,
  type TravelFeeView,
} from '@/app/[locale]/book/actions';

interface ServiceOpt {
  id: string;
  nameKey: string;
  descKey: string;
  fromCents: number;
}
interface TierOpt {
  id: string;
  key: string;
  labelKey: string;
}
interface AddOnOpt {
  id: string;
  nameKey: string;
  amountCents: number;
}
interface PriceCell {
  serviceId: string;
  sizeKey: string;
  amountCents: number;
}

const TOTAL_STEPS = 6;

const card = {
  borderRadius: 16,
  padding: 16,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
};
const inputStyle = {
  height: 52,
  borderRadius: 14,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border-strong)',
  color: 'var(--nv-ink)',
  padding: '0 16px',
  fontSize: 16,
  width: '100%',
};
const labelStyle = { fontSize: 13, fontWeight: 600 };

export function BookingFlow(props: {
  locale: string;
  currency: string;
  depositCents: number;
  services: ServiceOpt[];
  tiers: TierOpt[];
  addOns: AddOnOpt[];
  priceMatrix: PriceCell[];
}) {
  const {
    locale,
    currency,
    depositCents,
    services,
    tiers,
    addOns,
    priceMatrix,
  } = props;
  const t = useTranslations('Booking');
  const tc = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [size, setSize] = useState('');
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [notes, setNotes] = useState('');
  const [travel, setTravel] = useState<TravelFeeView | null>(null);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [slotId, setSlotId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');

  const money = (c: number) => formatMoney(c, currency, locale);
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;

  // ----- derived totals (display only; server recomputes authoritatively) -----
  const tierPrice = useMemo(() => {
    const cell = priceMatrix.find(
      (p) => p.serviceId === serviceId && p.sizeKey === size,
    );
    return cell?.amountCents ?? 0;
  }, [priceMatrix, serviceId, size]);
  const addOnsTotal = useMemo(
    () =>
      addOns
        .filter((a) => addOnIds.includes(a.id))
        .reduce((s, a) => s + a.amountCents, 0),
    [addOns, addOnIds],
  );
  const travelFee = travel?.inArea ? travel.feeCents : 0;
  const subtotal = tierPrice + addOnsTotal;
  const total = subtotal + travelFee;
  const deposit = Math.min(depositCents, total);

  // ----- load slots when reaching step 5 -----
  useEffect(() => {
    if (step === 5 && slots === null) {
      startTransition(async () => setSlots(await getUpcomingSlotsAction()));
    }
  }, [step, slots]);

  const validPostcode = /^\d{4,}$/.test(postcode.trim());
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const canContinue = (): boolean => {
    switch (step) {
      case 1:
        return !!serviceId;
      case 2:
        return !!size;
      case 3:
        return true;
      case 4:
        return (
          address.trim().length >= 3 &&
          validPostcode &&
          !!travel &&
          travel.inArea
        );
      case 5:
        return !!slotId;
      case 6:
        return (
          name.trim().length >= 1 &&
          phone.trim().length >= 6 &&
          validEmail &&
          agree
        );
      default:
        return false;
    }
  };

  function checkPostcode() {
    if (!validPostcode) {
      setTravel(null);
      return;
    }
    startTransition(async () => {
      setTravel(await lookupTravelFeeAction(postcode.trim()));
    });
  }

  function toggleAddOn(id: string) {
    setAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function next() {
    setError('');
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    // final step → reserve
    startTransition(async () => {
      const res = await reserveBookingAction({
        serviceId,
        size,
        addOnIds,
        address: address.trim(),
        postcode: postcode.trim(),
        notes: notes.trim(),
        slotId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        agree,
        locale,
      });
      if (res.ok) {
        router.push(`/book/pending/${res.reference}`);
      } else if (res.reason === 'slot_taken') {
        setError(t('errorSlotTaken'));
        setSlots(null);
        setSlotId('');
        setStep(5);
      } else if (res.reason === 'out_of_area') {
        setError(t('errorOutOfArea'));
        setStep(4);
      } else {
        setError(t('errorGeneric'));
      }
    });
  }

  const stepTitle = ['s1t', 's2t', 's3t', 's4t', 's5t', 's6t'][step - 1];
  const sizeLabel = tiers.find((tr) => tr.key === size)?.labelKey;

  return (
    <main
      style={{
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        padding: '24px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* progress + step label */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {step > 1 ? (
            <button
              onClick={() => {
                setError('');
                setStep(step - 1);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: 'var(--nv-surface-2)',
                border: '1px solid var(--nv-border-strong)',
                color: 'var(--nv-ink)',
                fontSize: 18,
              }}
              aria-label={t('back')}
            >
              ‹
            </button>
          ) : (
            <span style={{ width: 40 }} />
          )}
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--nv-muted)' }}
          >
            {t('step', { current: step, total: TOTAL_STEPS })}
          </span>
          <span style={{ width: 40 }} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${TOTAL_STEPS},1fr)`,
            gap: 4,
          }}
        >
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                borderRadius: 999,
                background: i < step ? 'var(--nv-lime)' : 'var(--nv-border)',
              }}
            />
          ))}
        </div>
      </div>

      <h1 style={{ fontSize: 'clamp(28px,4vw,40px)', lineHeight: 1.05 }}>
        {t(stepTitle)}
      </h1>

      {/* ===== STEP 1: service ===== */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => setServiceId(s.id)}
              style={{
                ...card,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                textAlign: 'left',
                borderColor:
                  serviceId === s.id ? 'var(--nv-lime)' : 'var(--nv-border)',
                color: 'var(--nv-ink)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 17,
                }}
              >
                {tc(s.nameKey)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                {t('from')}{' '}
                <span className="nv-mono">{money(s.fromCents)}</span>
              </span>
            </button>
          ))}
          <p style={{ fontSize: 13, color: 'var(--nv-muted)', margin: 0 }}>
            {t('s1note')}
          </p>
        </div>
      )}

      {/* ===== STEP 2: size ===== */}
      {step === 2 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))',
            gap: 10,
          }}
        >
          {tiers.map((tr) => {
            const cell = priceMatrix.find(
              (p) => p.serviceId === serviceId && p.sizeKey === tr.key,
            );
            return (
              <button
                key={tr.id}
                onClick={() => setSize(tr.key)}
                style={{
                  ...card,
                  textAlign: 'left',
                  borderColor:
                    size === tr.key ? 'var(--nv-lime)' : 'var(--nv-border)',
                  color: 'var(--nv-ink)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {tc(tr.labelKey)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
                  {tc(`Tiers.${tr.key}.desc`)}
                </div>
                <div
                  className="nv-mono"
                  style={{
                    fontSize: 14,
                    marginTop: 8,
                    color: 'var(--nv-lime)',
                  }}
                >
                  {money(cell?.amountCents ?? 0)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== STEP 3: add-ons ===== */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 14, color: 'var(--nv-muted)', margin: 0 }}>
            {t('s3sub')}
          </p>
          {addOns.map((a) => {
            const on = addOnIds.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggleAddOn(a.id)}
                style={{
                  ...card,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  borderColor: on ? 'var(--nv-lime)' : 'var(--nv-border)',
                  color: 'var(--nv-ink)',
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: on ? 'var(--nv-lime)' : 'transparent',
                    border: `1px solid ${on ? 'var(--nv-lime)' : 'var(--nv-border-strong)'}`,
                    color: 'var(--nv-bg)',
                    fontSize: 13,
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>
                  {tc(a.nameKey)}
                </span>
                <span
                  className="nv-mono"
                  style={{ fontSize: 14, color: 'var(--nv-muted)' }}
                >
                  +{money(a.amountCents)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== STEP 4: location ===== */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 14, color: 'var(--nv-muted)', margin: 0 }}>
            {t('s4sub')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>{t('street')}</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('streetPh')}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>{t('postcode')}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value);
                  setTravel(null);
                }}
                onBlur={checkPostcode}
                placeholder={t('postcodePh')}
                inputMode="numeric"
                style={{
                  ...inputStyle,
                  width: 140,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              {travel && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: travel.inArea
                      ? 'rgba(214,240,77,.14)'
                      : 'rgba(255,138,126,.14)',
                    color: travel.inArea ? 'var(--nv-lime)' : 'var(--nv-err)',
                  }}
                >
                  {travel.inArea
                    ? `${t('inArea')} · ${money(travel.feeCents)}`
                    : t('outOfArea')}
                </span>
              )}
            </div>
            {travel && !travel.inArea && (
              <span style={{ fontSize: 13, color: 'var(--nv-err)' }}>
                {t('outOfAreaBlocked')}
              </span>
            )}
            {!travel && (
              <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                {t('checkPostcode')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              {t('notes')}{' '}
              <span style={{ color: 'var(--nv-faint)', fontWeight: 400 }}>
                {t('optional')}
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPh')}
              style={{ ...inputStyle, height: 80, padding: 14, resize: 'none' }}
            />
          </div>
          <p
            className="nv-mono"
            style={{ fontSize: 12, color: 'var(--nv-faint)', margin: 0 }}
          >
            {t('travelNote')}
          </p>
        </div>
      )}

      {/* ===== STEP 5: date/time ===== */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 14, color: 'var(--nv-muted)', margin: 0 }}>
            {t('s5sub')}
          </p>
          {slots === null && (
            <p style={{ color: 'var(--nv-muted)' }}>{t('reserving')}</p>
          )}
          {slots !== null && slots.length === 0 && (
            <p style={{ color: 'var(--nv-muted)' }}>{t('noSlots')}</p>
          )}
          {slots !== null && slots.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.map((sl) => {
                const start = new Date(sl.startAt);
                const end = new Date(sl.endAt);
                const day = new Intl.DateTimeFormat(bcp47, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }).format(start);
                const tf = new Intl.DateTimeFormat(bcp47, {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const on = slotId === sl.id;
                return (
                  <button
                    key={sl.id}
                    onClick={() => setSlotId(sl.id)}
                    style={{
                      ...card,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      borderColor: on ? 'var(--nv-lime)' : 'var(--nv-border)',
                      color: 'var(--nv-ink)',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{day}</span>
                    <span
                      className="nv-mono"
                      style={{ fontSize: 14, color: 'var(--nv-muted)' }}
                    >
                      {tf.format(start)}–{tf.format(end)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 6: contact ===== */}
      {step === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 14, color: 'var(--nv-muted)', margin: 0 }}>
            {t('s6sub')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>{t('fullName')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('fullNamePh')}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>{t('mobile')}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+32 4XX XX XX XX"
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
              {t('phoneHelp')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>{t('email')}</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
              {t('emailHelp')}
            </span>
          </div>
          <button
            onClick={() => setAgree(!agree)}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              background: 'none',
              border: 0,
              padding: '6px 0',
              textAlign: 'left',
              color: 'inherit',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: agree ? 'var(--nv-lime)' : 'transparent',
                border: `1px solid ${agree ? 'var(--nv-lime)' : 'var(--nv-border-strong)'}`,
                color: 'var(--nv-bg)',
                fontSize: 13,
              }}
            >
              {agree ? '✓' : ''}
            </span>
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--nv-muted)',
              }}
            >
              {t('agree')}
            </span>
          </button>
        </div>
      )}

      {/* ===== summary + continue ===== */}
      <div
        style={{
          ...card,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 8,
        }}
      >
        {travelFee > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: 'var(--nv-muted)',
            }}
          >
            <span>{t('travelFee')}</span>
            <span className="nv-mono">{money(travelFee)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
            {t('total')}
          </span>
          <span className="nv-mono" style={{ fontSize: 22 }}>
            {money(total)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--nv-muted)',
          }}
        >
          <span>{t('depositNow')}</span>
          <span className="nv-mono">{money(deposit)}</span>
        </div>
        {size && sizeLabel && (
          <div style={{ fontSize: 12, color: 'var(--nv-faint)' }}>
            {t('size')}: {tc(sizeLabel)}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>{error}</div>
        )}
        <button
          onClick={next}
          disabled={!canContinue() || pending}
          style={{
            height: 54,
            borderRadius: 999,
            border: 0,
            background:
              canContinue() && !pending
                ? 'var(--nv-lime)'
                : 'var(--nv-surface-2)',
            color:
              canContinue() && !pending ? 'var(--nv-bg)' : 'var(--nv-faint)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            cursor: canContinue() && !pending ? 'pointer' : 'not-allowed',
          }}
        >
          {pending
            ? t('reserving')
            : step === TOTAL_STEPS
              ? t('reserveAndPay')
              : t('continue')}
        </button>
      </div>
    </main>
  );
}
