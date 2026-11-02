/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'terminabstimmungen'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.terminabstimmungen.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.terminabstimmungen.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.terminabstimmungen.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.terminabstimmungen              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   terminabstimmungen: abstimmungsnummer, titel, beschreibung, organisator_vorname, organisator_nachname, organisator_email, standarddauer_minuten, ort, …  ·  ← terminvorschlaege (list + contextual +) · ← teilnehmer (list + contextual +) · ← rueckmeldungen (list + contextual +) · ← alternative_terminvorschlaege (list + contextual +)
 *   terminvorschlaege: terminabstimmung, start, ende, ort_abweichend, meeting_link_abweichend, reihenfolge, anzahl_ja, anzahl_wenn_noetig, …  ·  → terminabstimmungen · ← rueckmeldungen (list + contextual +)
 *   teilnehmer: terminabstimmung, vorname, nachname, email, organisation, rolle, zugriffstoken, abstimmungslink, …  ·  → terminabstimmungen · ← rueckmeldungen (list + contextual +) · ← alternative_terminvorschlaege (list + contextual +)
 *   rueckmeldungen: terminabstimmung, terminvorschlag, teilnehmer, verfuegbarkeit, kommentar, antwortzeitpunkt, letzte_aenderung  ·  → terminabstimmungen · → terminvorschlaege · → teilnehmer
 *   alternative_terminvorschlaege: terminabstimmung, vorgeschlagen_von, start, ende, kommentar, status  ·  → terminabstimmungen · → teilnehmer
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Terminabstimmungen, Terminvorschlaege, Teilnehmer, Rueckmeldungen, AlternativeTerminvorschlaege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichTerminvorschlaege, enrichTeilnehmer, enrichRueckmeldungen, enrichAlternativeTerminvorschlaege } from '@/lib/enrich';
import type { EnrichedTerminvorschlaege, EnrichedTeilnehmer, EnrichedRueckmeldungen, EnrichedAlternativeTerminvorschlaege } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { TerminabstimmungenDialog, type TerminabstimmungenDialogDefaults } from '@/components/dialogs/TerminabstimmungenDialog';
import { TerminabstimmungenDetails } from '@/components/details/TerminabstimmungenDetails';
import { TerminvorschlaegeDialog, type TerminvorschlaegeDialogDefaults } from '@/components/dialogs/TerminvorschlaegeDialog';
import { TerminvorschlaegeDetails } from '@/components/details/TerminvorschlaegeDetails';
import { TeilnehmerDialog, type TeilnehmerDialogDefaults } from '@/components/dialogs/TeilnehmerDialog';
import { TeilnehmerDetails } from '@/components/details/TeilnehmerDetails';
import { RueckmeldungenDialog, type RueckmeldungenDialogDefaults } from '@/components/dialogs/RueckmeldungenDialog';
import { RueckmeldungenDetails } from '@/components/details/RueckmeldungenDetails';
import { AlternativeTerminvorschlaegeDialog, type AlternativeTerminvorschlaegeDialogDefaults } from '@/components/dialogs/AlternativeTerminvorschlaegeDialog';
import { AlternativeTerminvorschlaegeDetails } from '@/components/details/AlternativeTerminvorschlaegeDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'terminabstimmungen'; record: Terminabstimmungen }
  | { type: 'terminvorschlaege'; record: EnrichedTerminvorschlaege }
  | { type: 'teilnehmer'; record: EnrichedTeilnehmer }
  | { type: 'rueckmeldungen'; record: EnrichedRueckmeldungen }
  | { type: 'alternativeTerminvorschlaege'; record: EnrichedAlternativeTerminvorschlaege };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  terminabstimmungen: EntityCrudApi<Terminabstimmungen, TerminabstimmungenDialogDefaults>;
  terminvorschlaege: EntityCrudApi<Terminvorschlaege, TerminvorschlaegeDialogDefaults>;
  teilnehmer: EntityCrudApi<Teilnehmer, TeilnehmerDialogDefaults>;
  rueckmeldungen: EntityCrudApi<Rueckmeldungen, RueckmeldungenDialogDefaults>;
  alternativeTerminvorschlaege: EntityCrudApi<AlternativeTerminvorschlaege, AlternativeTerminvorschlaegeDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { terminabstimmungen: Terminabstimmungen[]; terminvorschlaege: EnrichedTerminvorschlaege[]; teilnehmer: EnrichedTeilnehmer[]; rueckmeldungen: EnrichedRueckmeldungen[]; alternativeTerminvorschlaege: EnrichedAlternativeTerminvorschlaege[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
  const [terminabstimmungenDialog, setTerminabstimmungenDialog] = useState<{ defaults?: TerminabstimmungenDialogDefaults; editing?: Terminabstimmungen } | null>(null);
  const [terminvorschlaegeDialog, setTerminvorschlaegeDialog] = useState<{ defaults?: TerminvorschlaegeDialogDefaults; editing?: Terminvorschlaege } | null>(null);
  const [teilnehmerDialog, setTeilnehmerDialog] = useState<{ defaults?: TeilnehmerDialogDefaults; editing?: Teilnehmer } | null>(null);
  const [rueckmeldungenDialog, setRueckmeldungenDialog] = useState<{ defaults?: RueckmeldungenDialogDefaults; editing?: Rueckmeldungen } | null>(null);
  const [alternativeTerminvorschlaegeDialog, setAlternativeTerminvorschlaegeDialog] = useState<{ defaults?: AlternativeTerminvorschlaegeDialogDefaults; editing?: AlternativeTerminvorschlaege } | null>(null);
  const enrichedTerminvorschlaege = useMemo(() => enrichTerminvorschlaege(data.terminvorschlaege, { terminabstimmungenMap: data.terminabstimmungenMap }), [data.terminvorschlaege, data.terminabstimmungenMap]);
  const enrichedTeilnehmer = useMemo(() => enrichTeilnehmer(data.teilnehmer, { terminabstimmungenMap: data.terminabstimmungenMap }), [data.teilnehmer, data.terminabstimmungenMap]);
  const enrichedRueckmeldungen = useMemo(() => enrichRueckmeldungen(data.rueckmeldungen, { terminabstimmungenMap: data.terminabstimmungenMap, terminvorschlaegeMap: data.terminvorschlaegeMap, teilnehmerMap: data.teilnehmerMap }), [data.rueckmeldungen, data.terminabstimmungenMap, data.terminvorschlaegeMap, data.teilnehmerMap]);
  const enrichedAlternativeTerminvorschlaege = useMemo(() => enrichAlternativeTerminvorschlaege(data.alternativeTerminvorschlaege, { terminabstimmungenMap: data.terminabstimmungenMap, teilnehmerMap: data.teilnehmerMap }), [data.alternativeTerminvorschlaege, data.terminabstimmungenMap, data.teilnehmerMap]);

  function detailTerminabstimmungen(record: Terminabstimmungen, push = false) {
    const item: OverlayItem = { type: 'terminabstimmungen', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTerminabstimmungen(fields: Terminabstimmungen['fields']) {
    const editing = terminabstimmungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTerminabstimmungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTerminabstimmungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('terminabstimmungen')} — ${t('crud_updated')}`, async () => {
        data.setTerminabstimmungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTerminabstimmungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTerminabstimmungenEntry(fields);
      undoToast(`${appLabel('terminabstimmungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTerminvorschlaege(record: Terminvorschlaege, push = false) {
    const rec = enrichedTerminvorschlaege.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'terminvorschlaege', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTerminvorschlaege(fields: Terminvorschlaege['fields']) {
    const editing = terminvorschlaegeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTerminvorschlaege(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTerminvorschlaegeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('terminvorschlaege')} — ${t('crud_updated')}`, async () => {
        data.setTerminvorschlaege(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTerminvorschlaegeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTerminvorschlaegeEntry(fields);
      undoToast(`${appLabel('terminvorschlaege')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTeilnehmer(record: Teilnehmer, push = false) {
    const rec = enrichedTeilnehmer.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'teilnehmer', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTeilnehmer(fields: Teilnehmer['fields']) {
    const editing = teilnehmerDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTeilnehmer(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTeilnehmerEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('teilnehmer')} — ${t('crud_updated')}`, async () => {
        data.setTeilnehmer(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTeilnehmerEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTeilnehmerEntry(fields);
      undoToast(`${appLabel('teilnehmer')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailRueckmeldungen(record: Rueckmeldungen, push = false) {
    const rec = enrichedRueckmeldungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'rueckmeldungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitRueckmeldungen(fields: Rueckmeldungen['fields']) {
    const editing = rueckmeldungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setRueckmeldungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateRueckmeldungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('rueckmeldungen')} — ${t('crud_updated')}`, async () => {
        data.setRueckmeldungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateRueckmeldungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createRueckmeldungenEntry(fields);
      undoToast(`${appLabel('rueckmeldungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAlternativeTerminvorschlaege(record: AlternativeTerminvorschlaege, push = false) {
    const rec = enrichedAlternativeTerminvorschlaege.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'alternativeTerminvorschlaege', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAlternativeTerminvorschlaege(fields: AlternativeTerminvorschlaege['fields']) {
    const editing = alternativeTerminvorschlaegeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAlternativeTerminvorschlaege(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAlternativeTerminvorschlaegeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('alternative_terminvorschlaege')} — ${t('crud_updated')}`, async () => {
        data.setAlternativeTerminvorschlaege(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAlternativeTerminvorschlaegeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAlternativeTerminvorschlaegeEntry(fields);
      undoToast(`${appLabel('alternative_terminvorschlaege')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <TerminabstimmungenDialog
        open={terminabstimmungenDialog !== null}
        onClose={() => setTerminabstimmungenDialog(null)}
        onSubmit={submitTerminabstimmungen}
        defaultValues={terminabstimmungenDialog?.defaults}
        recordId={terminabstimmungenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Terminabstimmungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Terminabstimmungen']}
      />
      <TerminvorschlaegeDialog
        open={terminvorschlaegeDialog !== null}
        onClose={() => setTerminvorschlaegeDialog(null)}
        onSubmit={submitTerminvorschlaege}
        defaultValues={terminvorschlaegeDialog?.defaults}
        recordId={terminvorschlaegeDialog?.editing?.record_id}
        terminabstimmungenList={data.terminabstimmungen}
        enablePhotoScan={AI_PHOTO_SCAN['Terminvorschlaege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Terminvorschlaege']}
      />
      <TeilnehmerDialog
        open={teilnehmerDialog !== null}
        onClose={() => setTeilnehmerDialog(null)}
        onSubmit={submitTeilnehmer}
        defaultValues={teilnehmerDialog?.defaults}
        recordId={teilnehmerDialog?.editing?.record_id}
        terminabstimmungenList={data.terminabstimmungen}
        enablePhotoScan={AI_PHOTO_SCAN['Teilnehmer']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Teilnehmer']}
      />
      <RueckmeldungenDialog
        open={rueckmeldungenDialog !== null}
        onClose={() => setRueckmeldungenDialog(null)}
        onSubmit={submitRueckmeldungen}
        defaultValues={rueckmeldungenDialog?.defaults}
        recordId={rueckmeldungenDialog?.editing?.record_id}
        terminabstimmungenList={data.terminabstimmungen}
        terminvorschlaegeList={data.terminvorschlaege}
        teilnehmerList={data.teilnehmer}
        enablePhotoScan={AI_PHOTO_SCAN['Rueckmeldungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Rueckmeldungen']}
      />
      <AlternativeTerminvorschlaegeDialog
        open={alternativeTerminvorschlaegeDialog !== null}
        onClose={() => setAlternativeTerminvorschlaegeDialog(null)}
        onSubmit={submitAlternativeTerminvorschlaege}
        defaultValues={alternativeTerminvorschlaegeDialog?.defaults}
        recordId={alternativeTerminvorschlaegeDialog?.editing?.record_id}
        terminabstimmungenList={data.terminabstimmungen}
        teilnehmerList={data.teilnehmer}
        enablePhotoScan={AI_PHOTO_SCAN['AlternativeTerminvorschlaege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['AlternativeTerminvorschlaege']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'terminabstimmungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.abstimmungsnummer ?? appLabel('terminabstimmungen')} subtitle={top.record.fields.antwortfrist ? formatDate(top.record.fields.antwortfrist) : undefined} />
                <TerminabstimmungenDetails
                  record={top.record}
                  terminvorschlaegeList={data.terminvorschlaege}
                  onOpenTerminvorschlaege={(r) => detailTerminvorschlaege(r, true)}
                  onAddTerminvorschlaege={perms.canWrite('terminvorschlaege') ? () => setTerminvorschlaegeDialog({ defaults: { terminabstimmung: createRecordUrl(APP_IDS.TERMINABSTIMMUNGEN, top.record.record_id) } }) : undefined}
                  teilnehmerList={data.teilnehmer}
                  onOpenTeilnehmer={(r) => detailTeilnehmer(r, true)}
                  onAddTeilnehmer={perms.canWrite('teilnehmer') ? () => setTeilnehmerDialog({ defaults: { terminabstimmung: createRecordUrl(APP_IDS.TERMINABSTIMMUNGEN, top.record.record_id) } }) : undefined}
                  rueckmeldungenList={data.rueckmeldungen}
                  onOpenRueckmeldungen={(r) => detailRueckmeldungen(r, true)}
                  onAddRueckmeldungen={perms.canWrite('rueckmeldungen') ? () => setRueckmeldungenDialog({ defaults: { terminabstimmung: createRecordUrl(APP_IDS.TERMINABSTIMMUNGEN, top.record.record_id) } }) : undefined}
                  alternativeTerminvorschlaegeList={data.alternativeTerminvorschlaege}
                  onOpenAlternativeTerminvorschlaege={(r) => detailAlternativeTerminvorschlaege(r, true)}
                  onAddAlternativeTerminvorschlaege={perms.canWrite('alternative_terminvorschlaege') ? () => setAlternativeTerminvorschlaegeDialog({ defaults: { terminabstimmung: createRecordUrl(APP_IDS.TERMINABSTIMMUNGEN, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'terminvorschlaege') {
            return (
              <>
                <RecordHeader title={top.record.fields.ort_abweichend ?? appLabel('terminvorschlaege')} subtitle={top.record.fields.start ? formatDate(top.record.fields.start) : undefined} />
                <TerminvorschlaegeDetails
                  record={top.record}
                  terminabstimmungenList={data.terminabstimmungen}
                  onOpenTerminabstimmungen={(r) => detailTerminabstimmungen(r, true)}
                  rueckmeldungenList={data.rueckmeldungen}
                  onOpenRueckmeldungen={(r) => detailRueckmeldungen(r, true)}
                  onAddRueckmeldungen={perms.canWrite('rueckmeldungen') ? () => setRueckmeldungenDialog({ defaults: { terminvorschlag: createRecordUrl(APP_IDS.TERMINVORSCHLAEGE, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'teilnehmer') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('teilnehmer')} subtitle={top.record.fields.einladung_versendet_am ? formatDate(top.record.fields.einladung_versendet_am) : undefined} />
                <TeilnehmerDetails
                  record={top.record}
                  terminabstimmungenList={data.terminabstimmungen}
                  onOpenTerminabstimmungen={(r) => detailTerminabstimmungen(r, true)}
                  rueckmeldungenList={data.rueckmeldungen}
                  onOpenRueckmeldungen={(r) => detailRueckmeldungen(r, true)}
                  onAddRueckmeldungen={perms.canWrite('rueckmeldungen') ? () => setRueckmeldungenDialog({ defaults: { teilnehmer: createRecordUrl(APP_IDS.TEILNEHMER, top.record.record_id) } }) : undefined}
                  alternativeTerminvorschlaegeList={data.alternativeTerminvorschlaege}
                  onOpenAlternativeTerminvorschlaege={(r) => detailAlternativeTerminvorschlaege(r, true)}
                  onAddAlternativeTerminvorschlaege={perms.canWrite('alternative_terminvorschlaege') ? () => setAlternativeTerminvorschlaegeDialog({ defaults: { vorgeschlagen_von: createRecordUrl(APP_IDS.TEILNEHMER, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'rueckmeldungen') {
            return (
              <>
                <RecordHeader title={appLabel('rueckmeldungen')} subtitle={top.record.fields.antwortzeitpunkt ? formatDate(top.record.fields.antwortzeitpunkt) : undefined} />
                <RueckmeldungenDetails
                  record={top.record}
                  terminabstimmungenList={data.terminabstimmungen}
                  onOpenTerminabstimmungen={(r) => detailTerminabstimmungen(r, true)}
                  terminvorschlaegeList={data.terminvorschlaege}
                  onOpenTerminvorschlaege={(r) => detailTerminvorschlaege(r, true)}
                  teilnehmerList={data.teilnehmer}
                  onOpenTeilnehmer={(r) => detailTeilnehmer(r, true)}
                />
              </>
            );
          }
          if (top.type === 'alternativeTerminvorschlaege') {
            return (
              <>
                <RecordHeader title={appLabel('alternative_terminvorschlaege')} subtitle={top.record.fields.start ? formatDate(top.record.fields.start) : undefined} />
                <AlternativeTerminvorschlaegeDetails
                  record={top.record}
                  terminabstimmungenList={data.terminabstimmungen}
                  onOpenTerminabstimmungen={(r) => detailTerminabstimmungen(r, true)}
                  teilnehmerList={data.teilnehmer}
                  onOpenTeilnehmer={(r) => detailTeilnehmer(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        canEdit={(top) => {
          if (top.type === 'terminabstimmungen') return perms.canWrite('terminabstimmungen');
          if (top.type === 'terminvorschlaege') return perms.canWrite('terminvorschlaege');
          if (top.type === 'teilnehmer') return perms.canWrite('teilnehmer');
          if (top.type === 'rueckmeldungen') return perms.canWrite('rueckmeldungen');
          if (top.type === 'alternativeTerminvorschlaege') return perms.canWrite('alternative_terminvorschlaege');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'terminabstimmungen') setTerminabstimmungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'terminvorschlaege') setTerminvorschlaegeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'teilnehmer') setTeilnehmerDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'rueckmeldungen') setRueckmeldungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'alternativeTerminvorschlaege') setAlternativeTerminvorschlaegeDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    terminabstimmungen: {
      openCreate: (defaults?: TerminabstimmungenDialogDefaults) => (perms.canWrite('terminabstimmungen') ? setTerminabstimmungenDialog({ defaults }) : refuse()),
      openEdit: (record: Terminabstimmungen) => (perms.canWrite('terminabstimmungen') ? setTerminabstimmungenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Terminabstimmungen) => detailTerminabstimmungen(record, false),
      canWrite: perms.canWrite('terminabstimmungen'),
    },
    terminvorschlaege: {
      openCreate: (defaults?: TerminvorschlaegeDialogDefaults) => (perms.canWrite('terminvorschlaege') ? setTerminvorschlaegeDialog({ defaults }) : refuse()),
      openEdit: (record: Terminvorschlaege) => (perms.canWrite('terminvorschlaege') ? setTerminvorschlaegeDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Terminvorschlaege) => detailTerminvorschlaege(record, false),
      canWrite: perms.canWrite('terminvorschlaege'),
    },
    teilnehmer: {
      openCreate: (defaults?: TeilnehmerDialogDefaults) => (perms.canWrite('teilnehmer') ? setTeilnehmerDialog({ defaults }) : refuse()),
      openEdit: (record: Teilnehmer) => (perms.canWrite('teilnehmer') ? setTeilnehmerDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Teilnehmer) => detailTeilnehmer(record, false),
      canWrite: perms.canWrite('teilnehmer'),
    },
    rueckmeldungen: {
      openCreate: (defaults?: RueckmeldungenDialogDefaults) => (perms.canWrite('rueckmeldungen') ? setRueckmeldungenDialog({ defaults }) : refuse()),
      openEdit: (record: Rueckmeldungen) => (perms.canWrite('rueckmeldungen') ? setRueckmeldungenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Rueckmeldungen) => detailRueckmeldungen(record, false),
      canWrite: perms.canWrite('rueckmeldungen'),
    },
    alternativeTerminvorschlaege: {
      openCreate: (defaults?: AlternativeTerminvorschlaegeDialogDefaults) => (perms.canWrite('alternative_terminvorschlaege') ? setAlternativeTerminvorschlaegeDialog({ defaults }) : refuse()),
      openEdit: (record: AlternativeTerminvorschlaege) => (perms.canWrite('alternative_terminvorschlaege') ? setAlternativeTerminvorschlaegeDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: AlternativeTerminvorschlaege) => detailAlternativeTerminvorschlaege(record, false),
      canWrite: perms.canWrite('alternative_terminvorschlaege'),
    },
    enriched: { terminabstimmungen: data.terminabstimmungen, terminvorschlaege: enrichedTerminvorschlaege, teilnehmer: enrichedTeilnehmer, rueckmeldungen: enrichedRueckmeldungen, alternativeTerminvorschlaege: enrichedAlternativeTerminvorschlaege },
  };
}
