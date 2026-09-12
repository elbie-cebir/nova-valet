import { TEMPLATES } from './templates';

export interface TemplateStatus {
  name: string;
  language: string;
  status: string;
  category?: string;
}

interface Deps {
  fetchImpl?: typeof fetch;
}

function cfg(): { token: string; waba: string; version: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !waba) return null;
  return {
    token,
    waba,
    version: process.env.WHATSAPP_API_VERSION || 'v22.0',
  };
}

/**
 * List the message templates on the WABA with their approval status. Failure-safe:
 * a missing config, network error, or Graph error returns `{ ok: false, ... }`
 * rather than throwing.
 */
export async function fetchTemplateStatuses(
  deps: Deps = {},
): Promise<{ ok: boolean; templates: TemplateStatus[]; error?: string }> {
  const f = deps.fetchImpl ?? fetch;
  const c = cfg();
  if (!c) return { ok: false, templates: [], error: 'not_configured' };
  try {
    const url = `https://graph.facebook.com/${c.version}/${c.waba}/message_templates?fields=name,status,category,language&limit=200`;
    const res = await f(url, {
      headers: { Authorization: `Bearer ${c.token}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: unknown;
      data?: TemplateStatus[];
    };
    if (!res.ok) {
      return {
        ok: false,
        templates: [],
        error: data?.error ? JSON.stringify(data.error) : `graph_${res.status}`,
      };
    }
    return { ok: true, templates: data?.data ?? [] };
  } catch (e) {
    return {
      ok: false,
      templates: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** The templates the app sends and therefore depends on being APPROVED. */
export const REQUIRED_TEMPLATES: string[] = [
  TEMPLATES.confirmation,
  TEMPLATES.reminder,
  TEMPLATES.balance,
  TEMPLATES.onMyWay,
];

export interface PreflightResult {
  ok: boolean;
  approved: string[];
  missing: { name: string; status: string }[];
  error?: string;
}

/**
 * Pre-flight: verify every required template has an APPROVED version on the WABA.
 * Returns a structured result so a run can refuse / log clearly instead of
 * failing silently at send time. A name counts as approved if any language
 * version is APPROVED.
 */
export async function checkTemplatesApproved(
  required: string[] = REQUIRED_TEMPLATES,
  deps: Deps = {},
): Promise<PreflightResult> {
  const res = await fetchTemplateStatuses(deps);
  if (!res.ok) {
    return {
      ok: false,
      approved: [],
      missing: required.map((name) => ({ name, status: 'unverified' })),
      error: res.error,
    };
  }
  const approvedNames = new Set(
    res.templates.filter((t) => t.status === 'APPROVED').map((t) => t.name),
  );
  const approved = required.filter((n) => approvedNames.has(n));
  const missing = required
    .filter((n) => !approvedNames.has(n))
    .map((name) => ({
      name,
      status: res.templates.find((t) => t.name === name)?.status ?? 'MISSING',
    }));
  return { ok: missing.length === 0, approved, missing };
}
