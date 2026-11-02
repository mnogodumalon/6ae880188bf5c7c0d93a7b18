import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Terminabstimmungen, Terminvorschlaege, Teilnehmer, Rueckmeldungen, AlternativeTerminvorschlaege } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
/** Entities this hook can load — the same keys the journey layer uses. */
export type DashboardEntity = 'terminabstimmungen' | 'terminvorschlaege' | 'teilnehmer' | 'rueckmeldungen' | 'alternative_terminvorschlaege';

export interface DashboardDataOptions {
  /** Entities this page does NOT need (picked through useRecordSearch instead).
   *  Every flow page mounts this hook on its own route, so without `omit` a
   *  page that searches 3.000 guests server-side would still pull all 3.000
   *  through the side door. */
  omit?: DashboardEntity[];
}

export function useDashboardData(options: DashboardDataOptions = {}) {
  // A string key, not the array: an inline `omit={['gaeste']}` is a new array
  // on every render and would restart the fetch forever.
  const omitKey = (options.omit ?? []).slice().sort().join('|');
  const [terminabstimmungen, setTerminabstimmungen] = useState<Terminabstimmungen[]>([]);
  const [terminvorschlaege, setTerminvorschlaege] = useState<Terminvorschlaege[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [rueckmeldungen, setRueckmeldungen] = useState<Rueckmeldungen[]>([]);
  const [alternativeTerminvorschlaege, setAlternativeTerminvorschlaege] = useState<AlternativeTerminvorschlaege[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /** Lists the signed-in user may not read (403 on the platform). They load as
   *  empty and the rest of the page loads normally — one forbidden list used to
   *  empty the whole dashboard (05.10.2026). Hide a block whose list is here. */
  const [forbidden, setForbidden] = useState<DashboardEntity[]>([]);

  // Every list on its own: a 403 is „not yours“, any other failure is an error.
  const settle = useCallback((settled: PromiseSettledResult<unknown>[]) => {
    const denied: DashboardEntity[] = [];
    let failure: unknown = null;
    // null = this list failed for another reason: its current data stays
    const pick = <T,>(i: number, key: DashboardEntity): T[] | null => {
      const s = settled[i];
      if (s.status === 'fulfilled') return s.value as T[];
      if ((s.reason as { status?: number } | null)?.status === 403) { denied.push(key); return []; }
      failure = failure ?? s.reason;
      return null;
    };
    { const rows = pick<Terminabstimmungen>(0, 'terminabstimmungen'); if (rows) setTerminabstimmungen(rows); }
    { const rows = pick<Terminvorschlaege>(1, 'terminvorschlaege'); if (rows) setTerminvorschlaege(rows); }
    { const rows = pick<Teilnehmer>(2, 'teilnehmer'); if (rows) setTeilnehmer(rows); }
    { const rows = pick<Rueckmeldungen>(3, 'rueckmeldungen'); if (rows) setRueckmeldungen(rows); }
    { const rows = pick<AlternativeTerminvorschlaege>(4, 'alternative_terminvorschlaege'); if (rows) setAlternativeTerminvorschlaege(rows); }
    setForbidden(prev => (prev.join('|') === denied.join('|') ? prev : denied));
    return failure;
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    try {
      const failure = settle(await Promise.allSettled([
        omit.has('terminabstimmungen') ? Promise.resolve([] as Terminabstimmungen[]) : LivingAppsService.getTerminabstimmungen(),
        omit.has('terminvorschlaege') ? Promise.resolve([] as Terminvorschlaege[]) : LivingAppsService.getTerminvorschlaege(),
        omit.has('teilnehmer') ? Promise.resolve([] as Teilnehmer[]) : LivingAppsService.getTeilnehmer(),
        omit.has('rueckmeldungen') ? Promise.resolve([] as Rueckmeldungen[]) : LivingAppsService.getRueckmeldungen(),
        omit.has('alternative_terminvorschlaege') ? Promise.resolve([] as AlternativeTerminvorschlaege[]) : LivingAppsService.getAlternativeTerminvorschlaege(),
      ]));
      if (failure) throw failure;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, [omitKey, settle]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    async function silentRefresh() {
      try {
        // a failed list keeps its stale data out of the way: settle() only
        // replaces what loaded or was refused
        settle(await Promise.allSettled([
          omit.has('terminabstimmungen') ? Promise.resolve([] as Terminabstimmungen[]) : LivingAppsService.getTerminabstimmungen(),
          omit.has('terminvorschlaege') ? Promise.resolve([] as Terminvorschlaege[]) : LivingAppsService.getTerminvorschlaege(),
          omit.has('teilnehmer') ? Promise.resolve([] as Teilnehmer[]) : LivingAppsService.getTeilnehmer(),
          omit.has('rueckmeldungen') ? Promise.resolve([] as Rueckmeldungen[]) : LivingAppsService.getRueckmeldungen(),
          omit.has('alternative_terminvorschlaege') ? Promise.resolve([] as AlternativeTerminvorschlaege[]) : LivingAppsService.getAlternativeTerminvorschlaege(),
        ]));
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    // assistant:data-changed comes from the assistant (<la-klar-assistant>)
    // after every mutation. The element additionally fires the legacy
    // dashboard-refresh event for OLD deployed bundles — do NOT subscribe to
    // both here, or every mutation fetches twice.
    window.addEventListener('assistant:data-changed', handleRefresh);
    return () => window.removeEventListener('assistant:data-changed', handleRefresh);
  }, [omitKey, settle]);

  const terminabstimmungenMap = useMemo(() => {
    const m = new Map<string, Terminabstimmungen>();
    terminabstimmungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [terminabstimmungen]);

  const terminvorschlaegeMap = useMemo(() => {
    const m = new Map<string, Terminvorschlaege>();
    terminvorschlaege.forEach(r => m.set(r.record_id, r));
    return m;
  }, [terminvorschlaege]);

  const teilnehmerMap = useMemo(() => {
    const m = new Map<string, Teilnehmer>();
    teilnehmer.forEach(r => m.set(r.record_id, r));
    return m;
  }, [teilnehmer]);

  return { terminabstimmungen, setTerminabstimmungen, terminvorschlaege, setTerminvorschlaege, teilnehmer, setTeilnehmer, rueckmeldungen, setRueckmeldungen, alternativeTerminvorschlaege, setAlternativeTerminvorschlaege, loading, error, fetchAll, forbidden, terminabstimmungenMap, terminvorschlaegeMap, teilnehmerMap };
}

/** The hook's return — the `data` prop of DashboardOverview in the Ready-Wrapper form. */
export type DashboardData = ReturnType<typeof useDashboardData>;