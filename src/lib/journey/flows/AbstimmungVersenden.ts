/**
 * useAbstimmungVersendenFlow — the plumbing of the flow « Abstimmung versenden », generated from the plan.
 *
 * Changes `terminabstimmungen`: the record to change is picked (`flow.pick('terminabstimmungen')`), the form is prefilled with its values; ; sets `status` itself.
Changes `teilnehmer`: the record to change is picked (`flow.pick('teilnehmer')`), the form is prefilled with its values; ; sets `einladungsstatus`, `einladung_versendet_am` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 3)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useAbstimmungVersendenFlow({
 *     steps: { terminabstimmungen: 1, teilnehmer: 2 },
 *     items: { terminabstimmungen: r => ({ id: r.id, title: fieldText(r, 'titel') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.terminabstimmungen.select} {...flow.pick('terminabstimmungen')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.teilnehmer.select} {...flow.pick('teilnehmer')} />
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
export type AbstimmungVersendenFieldKey = 'teilnehmer' | 'terminabstimmungen';

export interface AbstimmungVersendenForms {
  terminabstimmungen: StepForm<'terminabstimmungen'>;
  teilnehmer: StepForm<'teilnehmer'>;
}

// Alias so the option generics stay readable.
type Key = AbstimmungVersendenFieldKey;

export interface AbstimmungVersendenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    terminabstimmungen?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    teilnehmer?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"teilnehmer": 2, "terminabstimmungen": 1};
export const ABSTIMMUNGVERSENDEN_REVIEW_STEP = 3;

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

export function useAbstimmungVersendenFlow(options: AbstimmungVersendenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [terminabstimmungenTargetId, setTerminabstimmungenTargetId] = useState<string | null>(null);
  const [teilnehmerTargetId, setTeilnehmerTargetId] = useState<string | null>(null);
  const terminabstimmungen = useStepForm('terminabstimmungen', {
    fields: [],
    steps: only(steps, []) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, []),
    messages: only(options.messages as Record<string, string> | undefined, []),
  });
  const teilnehmer = useStepForm('teilnehmer', {
    fields: [],
    steps: only(steps, []) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, []),
    messages: only(options.messages as Record<string, string> | undefined, []),
  });
  const forms: AbstimmungVersendenForms = { terminabstimmungen, teilnehmer };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [terminabstimmungen, teilnehmer];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    terminabstimmungen: useRecordSearch(servicePort, 'terminabstimmungen', withPickPolicy('terminabstimmungen', {
      searchFields: ["titel"] as never,
      filter: "r.v_status == 'entwurf'",
      where: (r: JourneyRecord) => (fieldLookup(r, "status")?.key ?? null) === "entwurf",
      toItem: options.items?.terminabstimmungen as never,
    })),
    teilnehmer: useRecordSearch(servicePort, 'teilnehmer', withPickPolicy('teilnehmer', {
      searchFields: ["vorname", "nachname", "email"] as never,
      toItem: options.items?.teilnehmer as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:abstimmung-versenden:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:abstimmung-versenden:write:${entity}.${field}`,
  });
  const picks = {
    terminabstimmungen: { ...searches.terminabstimmungen, select: { ...searches.terminabstimmungen.select, create: false as boolean, hint: hintFor('terminabstimmungen', 'terminabstimmungen', {"conditions": [{"field": "status", "op": "eq", "value": "entwurf"}], "mode": "all"} as PickWhere | null) } },
    teilnehmer: { ...searches.teilnehmer, select: { ...searches.teilnehmer.select, create: false as boolean, hint: hintFor('teilnehmer', 'teilnehmer', null as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'terminabstimmungen', entity: 'terminabstimmungen', form: terminabstimmungen,
      updates: () => terminabstimmungenTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => terminabstimmungenTargetId
        ? { key: 'target:terminabstimmungen', label: entityLabel('terminabstimmungen'), value: picks.terminabstimmungen.labelOf(terminabstimmungenTargetId) ?? terminabstimmungenTargetId, step: steps.terminabstimmungen }
        : undefined,
      values: (): FormValues => ({
        status: policyFixedValue('terminabstimmungen', 'status') ?? "versendet",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('terminabstimmungen', 'status', policyFixedValue('terminabstimmungen', 'status') ?? "versendet")],
    },
    {
      key: 'teilnehmer', entity: 'teilnehmer', form: teilnehmer, primary: true,
      updates: () => teilnehmerTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => teilnehmerTargetId
        ? { key: 'target:teilnehmer', label: entityLabel('teilnehmer'), value: picks.teilnehmer.labelOf(teilnehmerTargetId) ?? teilnehmerTargetId, step: steps.teilnehmer }
        : undefined,
      values: (): FormValues => ({
        einladungsstatus: policyFixedValue('teilnehmer', 'einladungsstatus') ?? "versendet",
        einladung_versendet_am: policyFixedValue('teilnehmer', 'einladung_versendet_am') ?? nowIso(),
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('teilnehmer', 'einladungsstatus', policyFixedValue('teilnehmer', 'einladungsstatus') ?? "versendet")],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'abstimmung-versenden' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    terminabstimmungen: {
      selectedId: terminabstimmungenTargetId,
      onSelect: (id: string) => {
        setTerminabstimmungenTargetId(id);
        const rec = picks.terminabstimmungen.recordOf(id);
        if (rec) terminabstimmungen.reset({ });
      },
      get record(): JourneyRecord | undefined { return terminabstimmungenTargetId ? picks.terminabstimmungen.recordOf(terminabstimmungenTargetId) : undefined; },
    },
    teilnehmer: {
      selectedId: teilnehmerTargetId,
      onSelect: (id: string) => {
        setTeilnehmerTargetId(id);
        const rec = picks.teilnehmer.recordOf(id);
        if (rec) teilnehmer.reset({ });
      },
      get record(): JourneyRecord | undefined { return teilnehmerTargetId ? picks.teilnehmer.recordOf(teilnehmerTargetId) : undefined; },
    },
  };
  // Opened for one record — `#/intents/abstimmung-versenden?record=<id>`, the dashboard's
  // flowActionFor(): that record is the one to change. Loaded, taken into the
  // pick and selected — when this flow may change it at all (the pick's rule).
  const [linkedId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record'));
  useEffect(() => {
    if (!linkedId) return;
    let on = true;
    void servicePort.get('terminabstimmungen', linkedId).then(rec => {
      if (!on || !rec || !((r: JourneyRecord) => (fieldLookup(r, "status")?.key ?? null) === "entwurf")(rec)) return;
      picks.terminabstimmungen.adopt(rec);
      targets.terminabstimmungen.onSelect(rec.id);
    }).catch(() => undefined);
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [linkedId]);
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: AbstimmungVersendenFieldKey) => {
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
  const pickMany = (field: AbstimmungVersendenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setTerminabstimmungenTargetId(null); setTeilnehmerTargetId(null); };

  return {
    slug: 'abstimmung-versenden' as const,
    draftKey: 'abstimmung-versenden' as const,
    entity: 'teilnehmer' as const,
    form: teilnehmer,
    forms, formList, picks, submit, steps, targets,    reviewStep: ABSTIMMUNGVERSENDEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type AbstimmungVersendenFlow = ReturnType<typeof useAbstimmungVersendenFlow>;
