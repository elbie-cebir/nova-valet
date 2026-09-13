'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LOCALES } from '@/i18n/routing';
import { formatMoney } from '@/lib/format';
import { BUSINESS_TIMEZONE } from '@/config/constants';
import {
  lookupTravelFeeAction,
  getUpcomingSlotsAction,
  reserveBookingAction,
  type SlotView,
  type TravelFeeView,
} from '@/app/[locale]/book/actions';

interface ServiceOpt {
  id: string;
  name: string;
  desc: string;
  fromCents: number;
}
interface TierOpt {
  id: string;
  key: string;
  label: string;
  desc: string;
}
interface AddOnOpt {
  id: string;
  name: string;
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

function radio(on: boolean) {
  return {
    width: 22,
    height: 22,
    flexShrink: 0,
    borderRadius: 999,
    border: `2px solid ${on ? 'var(--nv-lime)' : 'var(--nv-border-strong)'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
}
function radioDot(on: boolean) {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: on ? 'var(--nv-lime)' : 'transparent',
  } as const;
}
function checkbox(on: boolean) {
  return {
    width: 22,
    height: 22,
    flexShrink: 0,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: on ? 'var(--nv-lime)' : 'transparent',
    border: `1px solid ${on ? 'var(--nv-lime)' : 'var(--nv-border-strong)'}`,
    color: 'var(--nv-bg)',
    fontSize: 13,
  } as const;
}

/** Small decorative car silhouette that grows with the tier. */
function CarGlyph({ on, scale }: { on: boolean; scale: number }) {
  const w = 26 + scale * 6;
  const color = on ? 'var(--nv-lime)' : 'var(--nv-muted)';
  return (
    <div
      aria-hidden
      style={{
        width: w,
        height: 20,
        position: 'relative',
        opacity: on ? 1 : 0.6,
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: w,
          height: 11,
          borderRadius: '6px 6px 3px 3px',
          background: color,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: w * 0.22,
          width: w * 0.55,
          height: 11,
          borderRadius: '5px 5px 0 0',
          background: color,
        }}
      />
    </div>
  );
}

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
  const [selectedDay, setSelectedDay] = useState('');
  const [slotId, setSlotId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');

  const money = (c: number) => formatMoney(c, currency, locale);
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  // Fixed business timezone so slot times read the same in any browser (ADR-015).
  const tz = BUSINESS_TIMEZONE;
  const dayFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  });
  const dowFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'short',
    timeZone: tz,
  });
  const dnumFmt = new Intl.DateTimeFormat(bcp47, {
    day: 'numeric',
    timeZone: tz,
  });
  const timeFmt = new Intl.DateTimeFormat(bcp47, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });

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

  const serviceName = services.find((s) => s.id === serviceId)?.name;
  const sizeLabel = tiers.find((tr) => tr.key === size)?.label;
  const selectedSlot = slots?.find((s) => s.id === slotId) ?? null;
  const chosenAddOns = addOns.filter((a) => addOnIds.includes(a.id));

  // ----- slots grouped into days for the day selector -----
  const days = useMemo(() => {
    if (!slots) return [];
    const seen = new Map<string, SlotView>();
    for (const s of slots) {
      const key = s.startAt.slice(0, 10);
      if (!seen.has(key)) seen.set(key, s);
    }
    return [...seen.entries()].map(([key, sample]) => ({ key, sample }));
  }, [slots]);
  const daySlots =
    slots?.filter((s) => s.startAt.slice(0, 10) === selectedDay) ?? [];

  // ----- load slots when reaching step 5 -----
  useEffect(() => {
    if (step === 5 && slots === null) {
      startTransition(async () => {
        const loaded = await getUpcomingSlotsAction();
        setSlots(loaded);
        if (loaded.length > 0) setSelectedDay(loaded[0].startAt.slice(0, 10));
      });
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
    startTransition(async () =>
      setTravel(await lookupTravelFeeAction(postcode.trim())),
    );
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
        phone: `+32 ${phone.trim()}`,
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

  return (
    <main
      style={{
        maxWidth: 1080,
        width: '100%',
        margin: '0 auto',
        padding: '24px 20px 64px',
      }}
    >
      {/* progress + step label (spans both columns) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 16,
        }}
      >
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

      <div className="nv-book-grid">
        {/* ================= LEFT: step content ================= */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minWidth: 0,
          }}
        >
          <h1 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.05 }}>
            {t(stepTitle)}
          </h1>

          {/* STEP 1: service */}
          {step === 1 && (
            <>
              {services.map((s) => {
                const on = serviceId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setServiceId(s.id)}
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
                    <span style={radio(on)}>
                      <span style={radioDot(on)} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 17,
                        }}
                      >
                        {s.name}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                        {t('from')}{' '}
                        <span className="nv-mono">{money(s.fromCents)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
              <p style={{ fontSize: 13, color: 'var(--nv-muted)', margin: 0 }}>
                {t('s1note')}
              </p>
            </>
          )}

          {/* STEP 2: size */}
          {step === 2 && (
            <>
              {serviceName && (
                <p
                  style={{ fontSize: 14, color: 'var(--nv-muted)', margin: 0 }}
                >
                  {t('s2sub')}{' '}
                  <strong style={{ color: 'var(--nv-ink)' }}>
                    {serviceName}
                  </strong>
                </p>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(min(100%,150px),1fr))',
                  gap: 10,
                }}
              >
                {tiers.map((tr, i) => {
                  const on = size === tr.key;
                  const cell = priceMatrix.find(
                    (p) => p.serviceId === serviceId && p.sizeKey === tr.key,
                  );
                  return (
                    <button
                      key={tr.id}
                      onClick={() => setSize(tr.key)}
                      style={{
                        ...card,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        textAlign: 'left',
                        borderColor: on ? 'var(--nv-lime)' : 'var(--nv-border)',
                        color: 'var(--nv-ink)',
                      }}
                    >
                      <CarGlyph on={on} scale={i} />
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 16,
                        }}
                      >
                        {tr.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
                        {tr.desc}
                      </div>
                      <div
                        className="nv-mono"
                        style={{ fontSize: 14, color: 'var(--nv-lime)' }}
                      >
                        {money(cell?.amountCents ?? 0)}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, color: 'var(--nv-muted)', margin: 0 }}>
                {t('notSure')}
              </p>
            </>
          )}

          {/* STEP 3: add-ons */}
          {step === 3 && (
            <>
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
                    <span style={checkbox(on)}>{on ? '✓' : ''}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>
                      {a.name}
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
            </>
          )}

          {/* STEP 4: location (postcode first, like the POC) */}
          {step === 4 && (
            <>
              <p style={{ fontSize: 14, color: 'var(--nv-muted)', margin: 0 }}>
                {t('s4sub')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>{t('postcode')}</label>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '8px 12px',
                        borderRadius: 999,
                        background: travel.inArea
                          ? 'rgba(214,240,77,.14)'
                          : 'rgba(255,138,126,.14)',
                        color: travel.inArea
                          ? 'var(--nv-lime)'
                          : 'var(--nv-err)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: travel.inArea
                            ? 'var(--nv-lime)'
                            : 'var(--nv-err)',
                        }}
                      />
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
                <label style={labelStyle}>{t('street')}</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('streetPh')}
                  style={inputStyle}
                />
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
                  style={{
                    ...inputStyle,
                    height: 80,
                    padding: 14,
                    resize: 'none',
                  }}
                />
              </div>
              <p
                className="nv-mono"
                style={{ fontSize: 12, color: 'var(--nv-faint)', margin: 0 }}
              >
                {t('travelNote')}
              </p>
            </>
          )}

          {/* STEP 5: date/time (day selector + times) */}
          {step === 5 && (
            <>
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
                <>
                  <div className="nv-day-row">
                    {days.map((d) => {
                      const on = d.key === selectedDay;
                      const dt = new Date(d.sample.startAt);
                      return (
                        <button
                          key={d.key}
                          onClick={() => setSelectedDay(d.key)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            minWidth: 64,
                            padding: '10px 8px',
                            borderRadius: 14,
                            background: on
                              ? 'var(--nv-lime)'
                              : 'var(--nv-surface)',
                            border: `1px solid ${on ? 'var(--nv-lime)' : 'var(--nv-border)'}`,
                            color: on ? 'var(--nv-bg)' : 'var(--nv-ink)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '.06em',
                              opacity: 0.8,
                            }}
                          >
                            {dowFmt.format(dt)}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontWeight: 700,
                              fontSize: 20,
                            }}
                          >
                            {dnumFmt.format(dt)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {daySlots.map((sl) => {
                      const on = slotId === sl.id;
                      const start = new Date(sl.startAt);
                      const end = new Date(sl.endAt);
                      return (
                        <button
                          key={sl.id}
                          onClick={() => setSlotId(sl.id)}
                          style={{
                            ...card,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            textAlign: 'left',
                            borderColor: on
                              ? 'var(--nv-lime)'
                              : 'var(--nv-border)',
                            color: 'var(--nv-ink)',
                          }}
                        >
                          <span style={radio(on)}>
                            <span style={radioDot(on)} />
                          </span>
                          <span className="nv-mono" style={{ fontSize: 15 }}>
                            {timeFmt.format(start)}–{timeFmt.format(end)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP 6: contact */}
          {step === 6 && (
            <>
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <div
                    style={{
                      width: 64,
                      height: 52,
                      borderRadius: 14,
                      background: 'var(--nv-surface)',
                      border: '1px solid var(--nv-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    +32
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="4XX XX XX XX"
                    inputMode="tel"
                    style={inputStyle}
                  />
                </div>
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
                  inputMode="email"
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
                <span style={checkbox(agree)}>{agree ? '✓' : ''}</span>
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
            </>
          )}
        </div>

        {/* ================= RIGHT: sticky "Selected" summary ================= */}
        <aside className="nv-book-aside">
          <div
            style={{
              ...card,
              borderRadius: 20,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--nv-muted)',
                fontWeight: 600,
              }}
            >
              {t('selected')}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--nv-muted)' }}>{t('service')}</span>
                <strong style={{ textAlign: 'right' }}>
                  {serviceName ?? '—'}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--nv-muted)' }}>{t('size')}</span>
                <strong style={{ textAlign: 'right' }}>
                  {sizeLabel ?? '—'}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--nv-muted)' }}>{t('addons')}</span>
                <strong style={{ textAlign: 'right' }}>
                  {chosenAddOns.length === 0
                    ? t('none')
                    : chosenAddOns.map((a) => a.name).join(', ')}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--nv-muted)' }}>{t('when')}</span>
                <strong style={{ textAlign: 'right' }}>
                  {selectedSlot
                    ? dayFmt.format(new Date(selectedSlot.startAt))
                    : '—'}
                </strong>
              </div>
              {travelFee > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ color: 'var(--nv-muted)' }}>
                    {t('travelFee')}
                  </span>
                  <span className="nv-mono">{money(travelFee)}</span>
                </div>
              )}
            </div>
            <div
              style={{
                borderTop: '1px solid var(--nv-border)',
                paddingTop: 12,
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
            {error && (
              <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>
                {error}
              </div>
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
                  canContinue() && !pending
                    ? 'var(--nv-bg)'
                    : 'var(--nv-faint)',
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
        </aside>
      </div>
    </main>
  );
}
