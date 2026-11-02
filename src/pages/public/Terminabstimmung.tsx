import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import { tx, dateFnsLocale } from '@/i18n';
import {
  loadPublicPagesConfig, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useJourneySubmit, fieldText, fieldDate, fieldRef, fieldLookup, nowIso,
  type JourneyRecord, type PlanStep, type SummaryItem,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep, type SelectItem } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';

const SLUG = 'terminabstimmung';

interface Answer { v: string | null; k: string }

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(s: string | null): string {
  const d = parseDate(s);
  return d ? format(d, 'dd.MM.yyyy, HH:mm', { locale: dateFnsLocale() }) : '—';
}

function formatSlot(start: string | null, ende: string | null): string {
  const s = parseDate(start);
  const e = parseDate(ende);
  if (!s) return '—';
  const day = format(s, 'EEEE, dd.MM.yyyy', { locale: dateFnsLocale() });
  const from = format(s, 'HH:mm');
  if (!e) return `${day}, ${from}`;
  if (format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd')) {
    return `${day}, ${from}–${format(e, 'HH:mm')} ${tx('Uhr')}`;
  }
  return `${day}, ${from} ${tx('Uhr')} – ${format(e, 'dd.MM.yyyy, HH:mm', { locale: dateFnsLocale() })} ${tx('Uhr')}`;
}

export default function Terminabstimmung() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [abstimmungen, setAbstimmungen] = useState<JourneyRecord[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<JourneyRecord[]>([]);
  const [vorschlaege, setVorschlaege] = useState<JourneyRecord[]>([]);
  const [fruehere, setFruehere] = useState<JourneyRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [abstimmungId, setAbstimmungId] = useState<string | null>(null);
  const [teilnehmerId, setTeilnehmerId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const port = useMemo(() => (cfg && page ? createPublicPort(cfg, page) : null), [cfg, page]);

  useEffect(() => {
    if (!port) return;
    let cancelled = false;
    Promise.all([
      port.list('terminabstimmungen'),
      port.list('teilnehmer'),
      port.list('terminvorschlaege'),
      port.list('rueckmeldungen'),
    ])
      .then(([a, t, v, r]) => {
        if (cancelled) return;
        setAbstimmungen(a);
        setTeilnehmer(t);
        setVorschlaege(v);
        setFruehere(r);
        setDataLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setDataError(tx('Die Daten konnten gerade nicht geladen werden. Bitte versuche es später noch einmal.'));
        setDataLoading(false);
      });
    return () => { cancelled = true; };
  }, [port]);

  const abstimmung = useMemo(
    () => abstimmungen.find(a => a.id === abstimmungId) ?? null,
    [abstimmungen, abstimmungId],
  );
  const person = useMemo(
    () => teilnehmer.find(t => t.id === teilnehmerId) ?? null,
    [teilnehmer, teilnehmerId],
  );

  const options = useMemo(
    () => vorschlaege
      .filter(v => fieldRef(v, 'terminabstimmung') === abstimmungId)
      .sort((a, b) =>
        (Number(a.fields.reihenfolge) || 0) - (Number(b.fields.reihenfolge) || 0)
        || (fieldDate(a, 'start') ?? '').localeCompare(fieldDate(b, 'start') ?? '')),
    [vorschlaege, abstimmungId],
  );

  const teilnehmerItems: SelectItem[] = useMemo(
    () => teilnehmer
      .filter(t => fieldRef(t, 'terminabstimmung') === abstimmungId)
      .map(t => ({
        id: t.id,
        title: `${fieldText(t, 'vorname')} ${fieldText(t, 'nachname')}`.trim(),
        subtitle: fieldText(t, 'organisation') || undefined,
      })),
    [teilnehmer, abstimmungId],
  );

  const abstimmungItems: SelectItem[] = useMemo(
    () => abstimmungen.map(a => {
      const nr = fieldText(a, 'abstimmungsnummer');
      const frist = fieldDate(a, 'antwortfrist');
      return {
        id: a.id,
        title: fieldText(a, 'titel'),
        subtitle: [nr, frist ? `${tx('Antwort bis')} ${formatDateTime(frist)}` : ''].filter(Boolean).join(' · '),
      };
    }),
    [abstimmungen],
  );

  // Earlier answers of the picked person (info only — never edited)
  const earlier = useMemo(() => {
    const map: Record<string, string> = {};
    const stamp: Record<string, string> = {};
    for (const r of fruehere) {
      if (fieldRef(r, 'teilnehmer') !== teilnehmerId) continue;
      const vid = fieldRef(r, 'terminvorschlag');
      const l = fieldLookup(r, 'verfuegbarkeit');
      if (!vid || !l) continue;
      const t = fieldDate(r, 'antwortzeitpunkt') ?? '';
      if (stamp[vid] === undefined || t >= stamp[vid]) {
        stamp[vid] = t;
        map[vid] = l.label;
      }
    }
    return map;
  }, [fruehere, teilnehmerId]);

  const choiceOptions = useMemo(() => [
    { key: 'ja', label: tx('Ja') },
    { key: 'wenn_noetig', label: tx('Wenn nötig') },
    { key: 'nein', label: tx('Nein') },
  ], []);
  const labelOfChoice = (k: string | null) => choiceOptions.find(o => o.key === k)?.label ?? '—';

  const plan: PlanStep[] = useMemo(() => {
    if (!abstimmungId || !teilnehmerId) return [];
    return options.map((o, i) => ({
      key: `antwort_${o.id}`,
      entity: 'rueckmeldungen' as const,
      label: formatSlot(fieldDate(o, 'start'), fieldDate(o, 'ende')),
      primary: i === 0,
      verb: 'create' as const,
      values: () => {
        const a = answers[o.id];
        const now = nowIso();
        const v: Record<string, unknown> = {
          terminabstimmung: abstimmungId,
          terminvorschlag: o.id,
          teilnehmer: teilnehmerId,
          verfuegbarkeit: a?.v ?? '',
          antwortzeitpunkt: now,
          letzte_aenderung: now,
        };
        if (a?.k.trim()) v.kommentar = a.k.trim();
        return v;
      },
    }));
  }, [options, answers, abstimmungId, teilnehmerId]);

  const submit = useJourneySubmit(
    port ?? createFallbackPort(),
    plan,
    { draftKey: 'terminabstimmung' },
  );

  if (loading || !cfg || !page || unavailable) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  const setAnswer = (id: string, patch: Partial<Answer>) =>
    setAnswers(prev => ({ ...prev, [id]: { v: prev[id]?.v ?? null, k: prev[id]?.k ?? '', ...patch } }));

  const pickAbstimmung = (id: string) => {
    if (id !== abstimmungId) {
      setAbstimmungId(id);
      setTeilnehmerId(null);
      setAnswers({});
    }
  };

  const restart = () => {
    submit.reset();
    setAbstimmungId(null);
    setTeilnehmerId(null);
    setAnswers({});
    setStep(1);
  };

  const summaryItems: SummaryItem[] = [
    { key: 'abstimmung', label: tx('Abstimmung'), value: abstimmung ? fieldText(abstimmung, 'titel') : '—', step: 1 },
    { key: 'name', label: tx('Dein Name'), value: person ? `${fieldText(person, 'vorname')} ${fieldText(person, 'nachname')}` : '—', step: 2 },
    ...options.map(o => {
      const a = answers[o.id];
      return {
        key: `o_${o.id}`,
        label: formatSlot(fieldDate(o, 'start'), fieldDate(o, 'ende')),
        value: `${labelOfChoice(a?.v ?? null)}${a?.k.trim() ? ` – „${a.k.trim()}“` : ''}`,
        step: 3,
      };
    }),
  ];

  const steps = [
    { label: tx('Abstimmung'), heading: tx('Welche Terminabstimmung?'), description: tx('Wähle die Abstimmung, an der du teilnimmst.') },
    { label: tx('Name'), heading: tx('Wer bist du?'), description: tx('Wähle deinen Namen aus der Teilnehmerliste.') },
    { label: tx('Termine'), heading: tx('Wann passt es dir?'), description: tx('Beantworte jeden Terminvorschlag.') },
    { label: tx('Überblick'), heading: tx('Alles richtig?'), description: tx('Prüfe deine Antworten und sende sie ab.') },
  ];

  return (
    <PublicShell title={page.title} description={page.description}>
      {dataError ? (
        <p className="text-sm text-destructive">{dataError}</p>
      ) : (
        <IntentWizardShell
          steps={steps}
          currentStep={step}
          onStepChange={setStep}
          back={false}
          loading={dataLoading}
        >
          {step === 1 && !submit.result && (
            <>
              <EntitySelectStep
                items={abstimmungItems}
                selectedId={abstimmungId}
                onSelect={id => { pickAbstimmung(id); setStep(2); }}
                avatar="none"
                searchPlaceholder={tx('Nach Titel oder Nummer suchen')}
                emptyText={tx('Zurzeit ist keine Terminabstimmung offen.')}
                columns={1}
              />
              {abstimmung && (
                <div className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm space-y-1">
                  <p className="font-medium">{fieldText(abstimmung, 'titel')}</p>
                  {fieldText(abstimmung, 'beschreibung') && (
                    <p className="whitespace-pre-line text-muted-foreground">{fieldText(abstimmung, 'beschreibung')}</p>
                  )}
                  {fieldText(abstimmung, 'ort') && <p>{tx('Ort')}: {fieldText(abstimmung, 'ort')}</p>}
                  <p>{tx('Antwort bis')}: {formatDateTime(fieldDate(abstimmung, 'antwortfrist'))}</p>
                </div>
              )}
              <StepNav hideBack nextDisabled={!abstimmungId} nextStepLabel={tx('Name wählen')} onNext={() => { setStep(2); }} />
            </>
          )}

          {step === 2 && !submit.result && (
            <>
              {abstimmung && (
                <div className="mb-4 rounded-xl border bg-muted/40 p-4 text-sm space-y-1">
                  <p className="font-medium">{fieldText(abstimmung, 'titel')}</p>
                  <p>{tx('Antwort bis')}: {formatDateTime(fieldDate(abstimmung, 'antwortfrist'))}</p>
                </div>
              )}
              <EntitySelectStep
                items={teilnehmerItems}
                selectedId={teilnehmerId}
                onSelect={id => { setTeilnehmerId(id); setStep(3); }}
                avatar="initials"
                searchPlaceholder={tx('Nach Vor- oder Nachname suchen')}
                emptyText={tx('Für diese Abstimmung sind noch keine Teilnehmer eingetragen.')}
                columns={1}
              />
              <StepNav
                onBack={() => setStep(1)}
                nextDisabled={!teilnehmerId}
                nextStepLabel={tx('Termine beantworten')}
                onNext={() => { setStep(3); }}
              />
            </>
          )}

          {step === 3 && !submit.result && (
            <>
              {options.length === 0 ? (
                <p className="rounded-xl border bg-muted/40 p-4 text-sm">
                  {tx('Für diese Abstimmung gibt es noch keine Terminvorschläge.')}
                </p>
              ) : (
                <div className="space-y-4">
                  {options.map(o => {
                    const a = answers[o.id];
                    const ort = fieldText(o, 'ort_abweichend') || (abstimmung ? fieldText(abstimmung, 'ort') : '');
                    const prev = earlier[o.id];
                    return (
                      <div key={o.id} className="rounded-2xl border p-4 space-y-3">
                        <div>
                          <p className="font-medium">{formatSlot(fieldDate(o, 'start'), fieldDate(o, 'ende'))}</p>
                          {ort && <p className="text-sm text-muted-foreground">{ort}</p>}
                          {prev && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {tx('Deine frühere Antwort')}: {prev}. {tx('Mit dem Absenden gibst du eine neue Antwort ab.')}
                            </p>
                          )}
                        </div>
                        <ChoiceGroup
                          id={`antwort-${o.id}`}
                          value={a?.v ?? null}
                          onChange={k => setAnswer(o.id, { v: k })}
                          options={choiceOptions}
                          required
                        />
                        <textarea
                          className="w-full rounded-lg border bg-background p-2 text-sm"
                          rows={2}
                          placeholder={tx('Kommentar (optional)')}
                          aria-label={tx('Kommentar (optional)')}
                          value={a?.k ?? ''}
                          onChange={e => setAnswer(o.id, { k: e.target.value })}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <StepNav
                onBack={() => setStep(2)}
                nextDisabled={options.length === 0}
                nextStepLabel={tx('Überblick')}
                onNext={() => {
                  const open = options.filter(o => !answers[o.id]?.v).length;
                  if (open > 0) return tx`Bitte beantworte noch ${open} Terminvorschläge mit Ja, Wenn nötig oder Nein.`;
                  setStep(4);
                }}
              />
            </>
          )}

          {step === 4 && !submit.done && (
            <SummaryStep
              forms={[]}
              submit={submit}
              items={summaryItems}
              confirmLabel={tx('Antworten absenden')}
              whatHappensNext={tx('Deine Antworten werden an die Organisation übermittelt.')}
            />
          )}

          {submit.result && (
            <SuccessStep
              result={submit.result}
              title={tx('Danke für deine Rückmeldung!')}
              facts={summaryItems.map(i => ({ label: i.label, value: i.value }))}
              whatHappensNext={tx('Du hast alle Terminvorschläge beantwortet. Du kannst diese Seite jetzt schließen.')}
              actions={{ copy: false, print: false }}
              next={[{ label: tx('Weitere Antwort abgeben'), onClick: restart }]}
            />
          )}
        </IntentWizardShell>
      )}
    </PublicShell>
  );
}

// Hooks must run before the early return; until the config is loaded the
// submit hook gets an inert port that is never used.
function createFallbackPort() {
  return FALLBACK;
}
const FALLBACK = {
  door: 'public' as const,
  list: async () => [],
  count: async () => null,
  get: async () => null,
  create: async () => { throw new Error(tx('not ready')); },
  ref: (_appId: string, recordId: string) => recordId,
};
