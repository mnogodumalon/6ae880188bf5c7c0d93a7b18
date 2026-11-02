/**
 * useTerminabstimmungAnlegenFlow — the plumbing of the flow « Terminabstimmung anlegen », generated from the plan.
 *
 * Writes `terminabstimmungen`: asks `titel`, `beschreibung`, `organisator_vorname`, `organisator_nachname`, `organisator_email`, `standarddauer_minuten`, `ort`, `meeting_link`, `zeitzone`, `antwortfrist`, `entscheidungsregel`; sets `status` itself.
Writes `terminvorschlaege` SEVERAL times — one record per entry of `flow.lists.terminvorschlaege`; the form is the editor of one entry: asks `start`, `ende`, `ort_abweichend`, `meeting_link_abweichend`, `reihenfolge`, `anzahl_ja`, `anzahl_nein`, `anzahl_pflichtteilnehmer_ja`; links `terminabstimmung` ← the created `terminabstimmungen`.
Writes `teilnehmer` SEVERAL times — one record per entry of `flow.lists.teilnehmer`; the form is the editor of one entry: asks `vorname`, `nachname`, `email`, `organisation`, `rolle`; sets `einladungsstatus`, `teilnahme_abgesagt` itself; links `terminabstimmung` ← the created `terminabstimmungen`.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 4)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   Lists (several records of one entity per run): `flow.lists.<key>` holds the
 *   entries — `add()` validates the editor form and takes its values as one more
 *   record, `remove(id)`, `edit(id)` (back into the editor), `entries`, `count`.
 *   Render the editor's fields INSIDE <ListEntries list={flow.lists.<key>}> (the
 *   block adds „Hinzufügen“ and the entry list); „Weiter“ on that step takes a
 *   filled editor as one more entry and needs at least one entry.
 *
 *   const flow = useTerminabstimmungAnlegenFlow({
 *     steps: { titel: 1, beschreibung: 1, organisator_vorname: 1, organisator_nachname: 1, organisator_email: 1, standarddauer_minuten: 1, ort: 1, meeting_link: 1, zeitzone: 1, antwortfrist: 1, entscheidungsregel: 1, start: 2, ende: 2, ort_abweichend: 2, meeting_link_abweichend: 2, reihenfolge: 2, anzahl_ja: 2, anzahl_nein: 2, anzahl_pflichtteilnehmer_ja: 2, vorname: 3, nachname: 3, email: 3, organisation: 3, rolle: 3 },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <Bound form={flow.forms.terminabstimmungen} name="titel" />
 *     <Bound form={flow.forms.terminabstimmungen} name="beschreibung" />
 *     <Bound form={flow.forms.terminabstimmungen} name="organisator_vorname" />
 *     <Bound form={flow.forms.terminabstimmungen} name="organisator_nachname" />
 *     <Bound form={flow.forms.terminabstimmungen} name="organisator_email" />
 *     <Bound form={flow.forms.terminabstimmungen} name="standarddauer_minuten" />
 *     <Bound form={flow.forms.terminabstimmungen} name="ort" />
 *     <Bound form={flow.forms.terminabstimmungen} name="meeting_link" />
 *     <Bound form={flow.forms.terminabstimmungen} name="zeitzone" />
 *     <Bound form={flow.forms.terminabstimmungen} name="antwortfrist" />
 *     <Bound form={flow.forms.terminabstimmungen} name="entscheidungsregel" />
 *     <ListEntries list={flow.lists.terminvorschlaege}><Bound form={flow.forms.terminvorschlaege} name="start" /><Bound form={flow.forms.terminvorschlaege} name="ende" /><Bound form={flow.forms.terminvorschlaege} name="ort_abweichend" /><Bound form={flow.forms.terminvorschlaege} name="meeting_link_abweichend" /><Bound form={flow.forms.terminvorschlaege} name="reihenfolge" /><Bound form={flow.forms.terminvorschlaege} name="anzahl_ja" /><Bound form={flow.forms.terminvorschlaege} name="anzahl_nein" /><Bound form={flow.forms.terminvorschlaege} name="anzahl_pflichtteilnehmer_ja" /></ListEntries>
 *     <ListEntries list={flow.lists.teilnehmer}><Bound form={flow.forms.teilnehmer} name="vorname" /><Bound form={flow.forms.teilnehmer} name="nachname" /><Bound form={flow.forms.teilnehmer} name="email" /><Bound form={flow.forms.teilnehmer} name="organisation" /><Bound form={flow.forms.teilnehmer} name="rolle" /></ListEntries>
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type TerminabstimmungAnlegenFieldKey = 'antwortfrist' | 'anzahl_ja' | 'anzahl_nein' | 'anzahl_pflichtteilnehmer_ja' | 'beschreibung' | 'email' | 'ende' | 'entscheidungsregel' | 'meeting_link' | 'meeting_link_abweichend' | 'nachname' | 'organisation' | 'organisator_email' | 'organisator_nachname' | 'organisator_vorname' | 'ort' | 'ort_abweichend' | 'reihenfolge' | 'rolle' | 'standarddauer_minuten' | 'start' | 'titel' | 'vorname' | 'zeitzone';

export interface TerminabstimmungAnlegenForms {
  terminabstimmungen: StepForm<'terminabstimmungen'>;
  terminvorschlaege: StepForm<'terminvorschlaege'>;
  teilnehmer: StepForm<'teilnehmer'>;
}

// Alias so the option generics stay readable.
type Key = TerminabstimmungAnlegenFieldKey;

export interface TerminabstimmungAnlegenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
}

/** One entry of a list the flow creates several records from (`flow.lists.<key>`). */
export interface ListEntry { id: string; values: FormValues; labels: Record<string, string>; rows: SummaryItem[] }

const DEFAULT_STEPS: Record<string, number> = {"antwortfrist": 1, "anzahl_ja": 2, "anzahl_nein": 2, "anzahl_pflichtteilnehmer_ja": 2, "beschreibung": 1, "email": 3, "ende": 2, "entscheidungsregel": 1, "meeting_link": 1, "meeting_link_abweichend": 2, "nachname": 3, "organisation": 3, "organisator_email": 1, "organisator_nachname": 1, "organisator_vorname": 1, "ort": 1, "ort_abweichend": 2, "reihenfolge": 2, "rolle": 3, "standarddauer_minuten": 1, "start": 2, "titel": 1, "vorname": 3, "zeitzone": 1};
export const TERMINABSTIMMUNGANLEGEN_REVIEW_STEP = 4;

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useTerminabstimmungAnlegenFlow(options: TerminabstimmungAnlegenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const terminabstimmungen = useStepForm('terminabstimmungen', {
    fields: ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"],
    steps: only(steps, ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"]),
    messages: only(options.messages as Record<string, string> | undefined, ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"]),
  });
  const terminvorschlaege = useStepForm('terminvorschlaege', {
    fields: ["start", "ende", "ort_abweichend", "meeting_link_abweichend", "reihenfolge", "anzahl_ja", "anzahl_nein", "anzahl_pflichtteilnehmer_ja"],
    steps: only(steps, ["start", "ende", "ort_abweichend", "meeting_link_abweichend", "reihenfolge", "anzahl_ja", "anzahl_nein", "anzahl_pflichtteilnehmer_ja"]) as Record<string, number>,
    // the plan builds a value from these — required here, whatever the app's base view says
    required: { anzahl_ja: true, anzahl_nein: true, anzahl_pflichtteilnehmer_ja: true },
    initial: only(options.initial as FormValues | undefined, ["start", "ende", "ort_abweichend", "meeting_link_abweichend", "reihenfolge", "anzahl_ja", "anzahl_nein", "anzahl_pflichtteilnehmer_ja"]),
    messages: only(options.messages as Record<string, string> | undefined, ["start", "ende", "ort_abweichend", "meeting_link_abweichend", "reihenfolge", "anzahl_ja", "anzahl_nein", "anzahl_pflichtteilnehmer_ja"]),
  });
  const teilnehmer = useStepForm('teilnehmer', {
    fields: ["vorname", "nachname", "email", "organisation", "rolle"],
    steps: only(steps, ["vorname", "nachname", "email", "organisation", "rolle"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["vorname", "nachname", "email", "organisation", "rolle"]),
    messages: only(options.messages as Record<string, string> | undefined, ["vorname", "nachname", "email", "organisation", "rolle"]),
  });
  const [terminvorschlaegeEntries, setTerminvorschlaegeEntries] = useState<ListEntry[]>([]);
  const [teilnehmerEntries, setTeilnehmerEntries] = useState<ListEntry[]>([]);
  const forms: TerminabstimmungAnlegenForms = { terminabstimmungen, terminvorschlaege, teilnehmer };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [terminabstimmungen];
  const allForms: StepForm[] = [terminabstimmungen, terminvorschlaege, teilnehmer];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:terminabstimmung-anlegen:write:${entity}.${field}`,
  });
  const picks = {
  };

  // Lists — several records of one entity in one run („ein paar Termine“): the
  // editor form takes one entry at a time, `add()` validates it and puts it on
  // the list, the plan creates one record per entry (02.11.2026: the wish said
  // several, the flow made exactly one and nobody reported the difference)
  const lists = {
    terminvorschlaege: {
      entries: terminvorschlaegeEntries,
      count: terminvorschlaegeEntries.length,
      label: entityLabel('terminvorschlaege'),
      /** Validates the editor and takes its values as one more `terminvorschlaege`; false when a required field is empty. */
      add: (): boolean => {
        if (!terminvorschlaege.validate()) return false;
        const rows = terminvorschlaege.summary().filter(r => r.value !== '—');
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        setTerminvorschlaegeEntries(list => [...list, { id, values: terminvorschlaege.payload(), labels: { ...terminvorschlaege.labels }, rows }]);
        terminvorschlaege.reset();
        return true;
      },
      remove: (id: string) => setTerminvorschlaegeEntries(list => list.filter(e => e.id !== id)),
      /** Takes an entry back into the editor to change it. */
      edit: (id: string) => {
        const e = terminvorschlaegeEntries.find(x => x.id === id);
        if (!e) return;
        setTerminvorschlaegeEntries(list => list.filter(x => x.id !== id));
        terminvorschlaege.reset(e.values, e.labels);
      },
    },
    teilnehmer: {
      entries: teilnehmerEntries,
      count: teilnehmerEntries.length,
      label: entityLabel('teilnehmer'),
      /** Validates the editor and takes its values as one more `teilnehmer`; false when a required field is empty. */
      add: (): boolean => {
        if (!teilnehmer.validate()) return false;
        const rows = teilnehmer.summary().filter(r => r.value !== '—');
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        setTeilnehmerEntries(list => [...list, { id, values: teilnehmer.payload(), labels: { ...teilnehmer.labels }, rows }]);
        teilnehmer.reset();
        return true;
      },
      remove: (id: string) => setTeilnehmerEntries(list => list.filter(e => e.id !== id)),
      /** Takes an entry back into the editor to change it. */
      edit: (id: string) => {
        const e = teilnehmerEntries.find(x => x.id === id);
        if (!e) return;
        setTeilnehmerEntries(list => list.filter(x => x.id !== id));
        teilnehmer.reset(e.values, e.labels);
      },
    },
  };
  const plan: PlanStep[] = [
    {
      key: 'terminabstimmungen', entity: 'terminabstimmungen', form: terminabstimmungen, primary: true,
      values: (): FormValues => ({
        status: policyFixedValue('terminabstimmungen', 'status') ?? "entwurf",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('terminabstimmungen', 'status', policyFixedValue('terminabstimmungen', 'status') ?? "entwurf")],

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "laufende Nummer 1, 2, 3", "id": "abstimmungsnummer-format", "question": "Welches Format hat die Abstimmungsnummer?"}, {"assumed": "nur gespeichert", "id": "zugriffstoken-ohne-link", "question": "Wof\u00fcr dient der Zugriffstoken ohne pers\u00f6nlichen Link?"}],
    },
    ...terminvorschlaegeEntries.map((entry, i) => ({
      key: `terminvorschlaege:${entry.id}`, entity: 'terminvorschlaege', label: `${entityLabel('terminvorschlaege')} ${i + 1}`,
      needs: ['terminabstimmungen'],
      link: { terminabstimmung: 'terminabstimmungen' },
      values: (): FormValues => ({
        ...entry.values,
      }),
      // the review lists every entry („1. Termin: …“); „Ändern“ leads back to the list's step
      review: () => entry.rows.map(r => ({ ...r, key: `terminvorschlaege:${entry.id}:${r.key}`, label: `${i + 1}. ${r.label}`, step: steps[r.key] })),
    } as PlanStep)),
    ...teilnehmerEntries.map((entry, i) => ({
      key: `teilnehmer:${entry.id}`, entity: 'teilnehmer', label: `${entityLabel('teilnehmer')} ${i + 1}`,
      needs: ['terminabstimmungen'],
      link: { terminabstimmung: 'terminabstimmungen' },
      values: (): FormValues => ({
        ...entry.values,
        einladungsstatus: policyFixedValue('teilnehmer', 'einladungsstatus') ?? "nicht_versendet",
        teilnahme_abgesagt: policyFixedValue('teilnehmer', 'teilnahme_abgesagt') ?? false,
      }),
      // the review lists every entry („1. Termin: …“); „Ändern“ leads back to the list's step
      review: () => entry.rows.map(r => ({ ...r, key: `teilnehmer:${entry.id}:${r.key}`, label: `${i + 1}. ${r.label}`, step: steps[r.key] })),
    } as PlanStep)),
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'terminabstimmung-anlegen' });

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: TerminabstimmungAnlegenFieldKey) => {
    const owner = allForms.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: TerminabstimmungAnlegenFieldKey) => {
    const owner = allForms.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    // the list's step: a filled editor is taken as one more entry; at least one entry is needed
    && (steps['start'] !== n || (hasValues(terminvorschlaege) ? lists.terminvorschlaege.add() : terminvorschlaegeEntries.length > 0 || terminvorschlaege.validate()))    // the list's step: a filled editor is taken as one more entry; at least one entry is needed
    && (steps['vorname'] !== n || (hasValues(teilnehmer) ? lists.teilnehmer.add() : teilnehmerEntries.length > 0 || teilnehmer.validate()));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); terminvorschlaege.reset(); setTerminvorschlaegeEntries([]); teilnehmer.reset(); setTeilnehmerEntries([]); };

  return {
    slug: 'terminabstimmung-anlegen' as const,
    draftKey: 'terminabstimmung-anlegen' as const,
    entity: 'terminabstimmungen' as const,
    form: terminabstimmungen,
    forms, formList, picks, submit, steps, lists,    reviewStep: TERMINABSTIMMUNGANLEGEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type TerminabstimmungAnlegenFlow = ReturnType<typeof useTerminabstimmungAnlegenFlow>;
