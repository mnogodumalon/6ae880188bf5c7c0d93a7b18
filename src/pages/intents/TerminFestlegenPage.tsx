/**
 * Termin festlegen — 4-Schritt-Wizard.
 * Steps: 1) Terminabstimmung wählen → 2) Terminvorschlag wählen → 3) Absagen & fehlende Rückmeldungen ansehen
 *        → 4) Entscheidungskommentar eintragen, prüfen & festlegen.
 * Reads: terminabstimmungen, terminvorschlaege, rueckmeldungen, teilnehmer. Writes: terminabstimmungen (status, festgelegt_am, entscheidungskommentar), terminvorschlaege (Auswahl).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep, StatusBadge.
 */
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup, fieldNumber, fieldRef, fieldText, refFilter } from '@/lib/journey';
import type { JourneyRecord } from '@/lib/journey';
import { useTerminFestlegenFlow } from '@/lib/journey/flows/TerminFestlegen';
import { tx } from '@/i18n';

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm');
  } catch {
    return iso;
  }
}

function personName(t: JourneyRecord): string {
  return `${fieldText(t, 'vorname')} ${fieldText(t, 'nachname')}`.trim();
}

interface Overview {
  loading: boolean;
  error: string | null;
  nein: string[];
  ohne: string[];
  otherFinal: boolean;
}

export default function TerminFestlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useTerminFestlegenFlow({
    steps: { terminabstimmungen: 1, terminvorschlaege: 2 },
    items: {
      terminabstimmungen: r => ({
        id: r.id,
        title: fieldText(r, 'titel') || fieldText(r, 'abstimmungsnummer'),
        subtitle: fieldText(r, 'abstimmungsnummer'),
        status: fieldLookup(r, 'status') ?? undefined,
      }),
      terminvorschlaege: (r, ctx) => ({
        id: r.id,
        title: `${fmtDateTime(fieldDate(r, 'start'))} – ${fmtDateTime(fieldDate(r, 'ende'))}`,
        subtitle: ctx.ref('terminabstimmung'),
        status: fieldLookup(r, 'eignung') ?? undefined,
        stats: [
          { label: tx('Ja'), value: fieldNumber(r, 'anzahl_ja') ?? 0 },
          { label: tx('Nein'), value: fieldNumber(r, 'anzahl_nein') ?? 0 },
          { label: tx('Offen'), value: fieldNumber(r, 'anzahl_ohne_antwort') ?? 0 },
        ],
      }),
    },
  });

  const vorschlagPick = flow.pick('terminvorschlaege');
  const vorschlagId = (vorschlagPick.selectedId as string | null) ?? null;
  const vorschlag = vorschlagId ? flow.picks.terminvorschlaege.recordOf(vorschlagId) : undefined;
  const abstimmungId = vorschlag ? fieldRef(vorschlag, 'terminabstimmung') : null;

  const [ov, setOv] = useState<Overview>({ loading: false, error: null, nein: [], ohne: [], otherFinal: false });
  const port = flow.port;

  useEffect(() => {
    if (!vorschlagId || !abstimmungId) {
      setOv({ loading: false, error: null, nein: [], ohne: [], otherFinal: false });
      return;
    }
    let cancelled = false;
    setOv(o => ({ ...o, loading: true, error: null }));
    (async () => {
      try {
        const [antworten, teilnehmer, vorschlaege] = await Promise.all([
          port.list('rueckmeldungen', { filter: refFilter('terminvorschlag', vorschlagId) }),
          port.list('teilnehmer', { filter: refFilter('terminabstimmung', abstimmungId) }),
          port.list('terminvorschlaege', { filter: refFilter('terminabstimmung', abstimmungId) }),
        ]);
        if (cancelled) return;
        const mine = antworten.filter(a => fieldRef(a, 'terminvorschlag') === vorschlagId);
        const byTeilnehmer = new Map<string, JourneyRecord>();
        for (const t of teilnehmer) byTeilnehmer.set(t.id, t);
        const answered = new Set<string>();
        const nein: string[] = [];
        for (const a of mine) {
          const tid = fieldRef(a, 'teilnehmer');
          if (!tid) continue;
          answered.add(tid);
          if (fieldLookup(a, 'verfuegbarkeit')?.key === 'nein') {
            const t = byTeilnehmer.get(tid);
            nein.push(t ? personName(t) : tid);
          }
        }
        const ohne = teilnehmer.filter(t => !answered.has(t.id)).map(personName);
        const otherFinal = vorschlaege.some(
          v => v.id !== vorschlagId && fieldRef(v, 'terminabstimmung') === abstimmungId && v.fields.final_gewaehlt === true,
        );
        setOv({ loading: false, error: null, nein, ohne, otherFinal });
      } catch (e) {
        if (!cancelled) setOv({ loading: false, error: e instanceof Error ? e.message : String(e), nein: [], ohne: [], otherFinal: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, vorschlagId, abstimmungId]);

  const checkStep3 = (): boolean | string => {
    if (ov.loading) return tx('Die Rückmeldungen werden noch geladen.');
    if (ov.otherFinal) return tx('Es kann nur einen finalen Termin geben.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Termin festlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Wähle den finalen Termin und schließe die Abstimmung ab.'),
        needs: [tx('Die Terminabstimmung'), tx('Den Terminvorschlag, der gelten soll')],
      }}
    >
      <WizardStep label={tx('Abstimmung')} description={tx('Für welche Terminabstimmung legst du den Termin fest?')}>
        <EntitySelectStep {...flow.picks.terminabstimmungen.select} {...flow.pick('terminabstimmungen')} searchPlaceholder={tx('Titel oder Nummer …')} />
      </WizardStep>

      <WizardStep label={tx('Termin')} description={tx('Welcher Vorschlag wird der verbindliche Termin?')}>
        <EntitySelectStep {...flow.picks.terminvorschlaege.select} {...vorschlagPick} avatar="none" />
      </WizardStep>

      <WizardStep label={tx('Rückmeldungen')} description={tx('Diese Teilnehmer haben für den Termin abgesagt oder noch nicht geantwortet.')}>
        {!vorschlagId ? (
          <StepNav onBack={() => setStep(2)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl eines Terminvorschlags.')}
          </StepNav>
        ) : (
          <div className="space-y-4">
            {vorschlag && (
              <div className="rounded-2xl bg-secondary p-4 text-sm">
                <p className="font-medium">
                  {fmtDateTime(fieldDate(vorschlag, 'start'))} – {fmtDateTime(fieldDate(vorschlag, 'ende'))}
                </p>
                <p className="text-muted-foreground">
                  {tx`${fieldNumber(vorschlag, 'anzahl_ja') ?? 0} Ja · ${fieldNumber(vorschlag, 'anzahl_nein') ?? 0} Nein · ${fieldNumber(vorschlag, 'anzahl_ohne_antwort') ?? 0} ohne Antwort`}
                </p>
              </div>
            )}
            {ov.loading && <p className="text-sm text-muted-foreground">{tx('Rückmeldungen werden geladen …')}</p>}
            {ov.error && <p className="text-sm text-destructive">{ov.error}</p>}
            {!ov.loading && !ov.error && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
                  <h3 className="mb-2 text-sm font-semibold">{tx`Antwort „Nein“ (${ov.nein.length})`}</h3>
                  {ov.nein.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tx('Niemand hat abgesagt.')}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {ov.nein.map((n, i) => (
                        <li key={`${n}-${i}`} className="truncate">{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
                  <h3 className="mb-2 text-sm font-semibold">{tx`Ohne Rückmeldung (${ov.ohne.length})`}</h3>
                  {ov.ohne.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tx('Alle haben geantwortet.')}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {ov.ohne.map((n, i) => (
                        <li key={`${n}-${i}`} className="truncate">{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            <StepNav onBack={() => setStep(2)} onNext={checkStep3} nextStepLabel={tx('Prüfen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Festlegen')} description={tx('Optional einen Kommentar zur Entscheidung eintragen und bestätigen.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Neuer Status'), value: tx('Festgelegt') }]}
            whatHappensNext={tx('Die Abstimmung gilt als festgelegt, der gewählte Termin wird final und die übrigen Vorschläge werden abgewählt.')}
          >
            <Bound form={flow.forms.terminabstimmungen} name="entscheidungskommentar" rows={3} />
          </SummaryStep>
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Termin festgelegt')}
          next={[
            { label: tx('Abstimmung absagen'), href: '#/intents/abstimmung-absagen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
