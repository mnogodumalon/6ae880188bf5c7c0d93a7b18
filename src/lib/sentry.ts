import * as Sentry from '@sentry/react';

const DSN = "https://a0a6a937e751b39ecf7303042f45cd6e@sentry.livinglogic.de/42";
/** Set per deployment (FRONTEND_SENTRY_ENVIRONMENT) or empty — then the
 *  environment is resolved at runtime below. */
const CONFIGURED_ENVIRONMENT = "";
/** The service version this bundle was built as — the SAME value that lands in
 *  the deployment's `version.json`. Exported so `lib/stale-bundle.ts` can tell a
 *  tab that is merely older than the live deployment apart from one whose asset
 *  is genuinely gone. One source for the fact; do not inject it a second time. */
export const BUNDLE_VERSION = "0.0.491";
const APPGROUP_ID = "6ae880188bf5c7c0d93a7b18";

/** Where this bundle runs decides the environment, not the build: the same
 *  bundle is served by the LA host itself (same-origin contract), so a copy on
 *  a staging host must not report as production. The sandbox preview (vite
 *  dev server on *.e2b.app) and a local dev server are „preview“ — until 27.10.2026 its errors landed
 *  between real customers' (JAVASCRIPT-REACT-20 came from a preview), and
 *  each dashboard was its own environment (184 of them), so production could
 *  not be filtered at all. The appgroup stays a tag. */
function resolveEnvironment(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (/\.e2b\.(app|dev)$/.test(host) || host === 'localhost' || host === '127.0.0.1') return 'preview';
  return CONFIGURED_ENVIRONMENT || host || 'production';
}

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: resolveEnvironment(),
    release: BUNDLE_VERSION || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Noise, not failure. React 19 hooks into the Navigation API and
    // intercepts its own transitions (`info === 'react-transition'`); the
    // browser runs a view transition for them. Reloading mid-flight, or
    // navigating again before one settles, aborts it — the promise rejects
    // with `AbortError: Transition was skipped` (or, when the document is
    // mid-change, `InvalidStateError: Transition was aborted because of
    // invalid state` — JAVASCRIPT-REACT-1X, 46 events), React does not catch
    // it, and it arrives here as an unhandled rejection at level=error.
    // Nothing broke for the user: the navigation still happens, only the
    // animation is dropped. Neither message nor `startViewTransition` exists
    // in our own code — do not go looking for it there.
    // „ResizeObserver loop completed with undelivered notifications“ is a
    // browser notice about a callback that changed layout again in the same
    // frame; the observer delivers next frame. ErrorBus filters it for the
    // toast channel, this is the report channel (issue 30.09.2026, < 800 px).
    ignoreErrors: ['Transition was skipped', 'Transition was aborted', 'ResizeObserver loop'],
  });
  if (APPGROUP_ID) {
    Sentry.setTag('appgroup_id', APPGROUP_ID);
  }
}

export interface FailedWrite {
  method: string;
  /** HTTP status; 0 = the request never got an answer (network). */
  status: number;
  /** REST error id (`illegal_field_value`, `no_app_permission`, …). */
  code?: string;
  /** The field the service named — its key, never its value. */
  field?: string;
  /** Entity the write went to (APP_IDS key), when known. */
  entity?: string;
}

/** A write the service refused, reported as its own Sentry event.
 *
 *  A failed save is the error customers notice first, and until 27.10.2026
 *  not one reached Sentry: the toast told the user, nothing told us. Only
 *  method, status, error id, field KEY and entity go out — no values, no
 *  record ids. Grouped across all dashboards by what failed (the appgroup is
 *  a tag), so one broken template shows up as one issue with many events.
 *  401 is not a failure of the dashboard (login screen); 403/429/5xx are
 *  reported as warnings (rights, rate limit, platform), the rest as errors. */
export function reportFailedWrite(w: FailedWrite): void {
  if (!DSN || w.status === 401) return;
  const level = w.status === 0 || w.status === 403 || w.status === 429 || w.status >= 500 ? 'warning' : 'error';
  const what = `${w.method} ${w.entity ?? 'record'} → ${w.status || 'network'}${w.code ? ` ${w.code}` : ''}${w.field ? ` (${w.field})` : ''}`;
  const tags: Record<string, string> = { failure_area: 'rest_write', http_status: String(w.status) };
  if (w.code) tags.rest_error = w.code;
  if (w.field) tags.field = w.field;
  if (w.entity) tags.entity = w.entity;
  if (typeof window !== 'undefined') tags.route = window.location.hash.split('?')[0].slice(0, 120);
  try {
    Sentry.captureMessage(`write refused: ${what}`, {
      level,
      tags,
      fingerprint: ['rest-write', w.method, String(w.status), w.code ?? '', w.field ?? ''],
    });
  } catch {
    // Sentry unavailable — reporting never breaks a save
  }
}

export { Sentry };
