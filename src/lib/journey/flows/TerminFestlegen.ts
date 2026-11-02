/**
 * useTerminFestlegenFlow — the plumbing of the flow « Termin verbindlich festlegen », generated from the plan.
 *
 * Changes `terminvorschlaege`: the record to change is picked (`flow.pick('terminvorschlaege')`), the form is prefilled with its values; .
Changes `terminabstimmungen`: the record to change is picked (`flow.pick('terminabstimmungen')`), the form is prefilled with its values; asks `entscheidungskommentar`; sets `status`, `festgelegt_am` itself.
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
 *   const flow = useTerminFestlegenFlow({
 *     steps: { terminvorschlaege: 1, terminabstimmungen: 2, entscheidungskommentar: 3 },
 *     items: { terminvorschlaege: r => ({ id: r.id, title: fieldText(r, 'ort_abweichend') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.terminvorschlaege.select} {...flow.pick('terminvorschlaege')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.terminabstimmungen.select} {...flow.pick('terminabstimmungen')} />
 *     <Bound form={flow.forms.terminabstimmungen} name="entscheidungskommentar" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useEffect, useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type TerminFestlegenFieldKey = 'entscheidungskommentar' | 'terminabstimmungen' | 'terminvorschlaege';

export interface TerminFestlegenForms {
  terminvorschlaege: StepForm<'terminvorschlaege'>;
  terminabstimmungen: StepForm<'terminabstimmungen'>;
}

// Alias so the option generics stay readable.
type Key = TerminFestlegenFieldKey;

export interface TerminFestlegenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    terminvorschlaege?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    terminabstimmungen?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"entscheidungskommentar": 3, "terminabstimmungen": 2, "terminvorschlaege": 1};
export const TERMINFESTLEGEN_REVIEW_STEP = 4;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
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

export function useTerminFestlegenFlow(options: TerminFestlegenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [terminvorschlaegeTargetId, setTerminvorschlaegeTargetId] = useState<string | null>(null);
  const [terminabstimmungenTargetId, setTerminabstimmungenTargetId] = useState<string | null>(null);
  const terminvorschlaege = useStepForm('terminvorschlaege', {
    fields: [],
    steps: only(steps, []) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, []),
    messages: only(options.messages as Record<string, string> | undefined, []),
  });
  const terminabstimmungen = useStepForm('terminabstimmungen', {
    fields: ["entscheidungskommentar"],
    steps: only(steps, ["entscheidungskommentar"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["entscheidungskommentar"]),
    messages: only(options.messages as Record<string, string> | undefined, ["entscheidungskommentar"]),
  });
  const forms: TerminFestlegenForms = { terminvorschlaege, terminabstimmungen };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [terminvorschlaege, terminabstimmungen];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    terminvorschlaege: useRecordSearch(servicePort, 'terminvorschlaege', withPickPolicy('terminvorschlaege', {
      searchFields: ["ort_abweichend"] as never,
      toItem: options.items?.terminvorschlaege as never,
    })),
    terminabstimmungen: useRecordSearch(servicePort, 'terminabstimmungen', withPickPolicy('terminabstimmungen', {
      searchFields: ["abstimmungsnummer"] as never,
      toItem: options.items?.terminabstimmungen as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:termin-festlegen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:termin-festlegen:write:${entity}.${field}`,
  });
  const picks = {
    terminvorschlaege: { ...searches.terminvorschlaege, select: { ...searches.terminvorschlaege.select, create: false as boolean, hint: hintFor('terminvorschlaege', 'terminvorschlaege', null as PickWhere | null) } },
    terminabstimmungen: { ...searches.terminabstimmungen, select: { ...searches.terminabstimmungen.select, create: false as boolean, hint: hintFor('terminabstimmungen', 'terminabstimmungen', null as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'terminvorschlaege', entity: 'terminvorschlaege', form: terminvorschlaege,
      updates: () => terminvorschlaegeTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => terminvorschlaegeTargetId
        ? { key: 'target:terminvorschlaege', label: entityLabel('terminvorschlaege'), value: picks.terminvorschlaege.labelOf(terminvorschlaegeTargetId) ?? terminvorschlaegeTargetId, step: steps.terminvorschlaege }
        : undefined,    },
    {
      key: 'terminabstimmungen', entity: 'terminabstimmungen', form: terminabstimmungen, primary: true,
      updates: () => terminabstimmungenTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => terminabstimmungenTargetId
        ? { key: 'target:terminabstimmungen', label: entityLabel('terminabstimmungen'), value: picks.terminabstimmungen.labelOf(terminabstimmungenTargetId) ?? terminabstimmungenTargetId, step: steps.terminabstimmungen }
        : undefined,
      values: (): FormValues => ({
        status: policyFixedValue('terminabstimmungen', 'status') ?? "festgelegt",
        festgelegt_am: policyFixedValue('terminabstimmungen', 'festgelegt_am') ?? nowIso(),
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('terminabstimmungen', 'status', policyFixedValue('terminabstimmungen', 'status') ?? "festgelegt")],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'termin-festlegen' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    terminvorschlaege: {
      selectedId: terminvorschlaegeTargetId,
      onSelect: (id: string) => {
        setTerminvorschlaegeTargetId(id);
        const rec = picks.terminvorschlaege.recordOf(id);
        if (rec) terminvorschlaege.reset({ });
      },
      get record(): JourneyRecord | undefined { return terminvorschlaegeTargetId ? picks.terminvorschlaege.recordOf(terminvorschlaegeTargetId) : undefined; },
    },
    terminabstimmungen: {
      selectedId: terminabstimmungenTargetId,
      onSelect: (id: string) => {
        setTerminabstimmungenTargetId(id);
        const rec = picks.terminabstimmungen.recordOf(id);
        if (rec) terminabstimmungen.reset({ entscheidungskommentar: fieldText(rec, "entscheidungskommentar"), });
      },
      get record(): JourneyRecord | undefined { return terminabstimmungenTargetId ? picks.terminabstimmungen.recordOf(terminabstimmungenTargetId) : undefined; },
    },
  };
  // Opened for one record — `#/intents/termin-festlegen?record=<id>`, the dashboard's
  // flowActionFor(): that record is the one to change. Loaded, taken into the
  // pick and selected — when this flow may change it at all (the pick's rule).
  const [linkedId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record'));
  useEffect(() => {
    if (!linkedId) return;
    let on = true;
    void servicePort.get('terminvorschlaege', linkedId).then(rec => {
      if (!on || !rec) return;
      picks.terminvorschlaege.adopt(rec);
      targets.terminvorschlaege.onSelect(rec.id);
    }).catch(() => undefined);
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [linkedId]);
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: TerminFestlegenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
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
  const pickMany = (field: TerminFestlegenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setTerminvorschlaegeTargetId(null); setTerminabstimmungenTargetId(null); };

  return {
    slug: 'termin-festlegen' as const,
    draftKey: 'termin-festlegen' as const,
    entity: 'terminabstimmungen' as const,
    form: terminabstimmungen,
    forms, formList, picks, submit, steps, targets,    reviewStep: TERMINFESTLEGEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type TerminFestlegenFlow = ReturnType<typeof useTerminFestlegenFlow>;
