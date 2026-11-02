/**
 * Abstimmung versenden — 3-Schritt-Wizard.
 * Steps: 1) Entwurf auswählen → 2) Terminvorschläge & Teilnehmer prüfen → 3) Prüfen & versenden
 * (Status auf „versendet“ setzen, Teilnehmer als eingeladen markieren).
 * Reads: terminabstimmungen, teilnehmer, terminvorschlaege (Zähler). Writes: terminabstimmungen, teilnehmer (updates, via useAbstimmungVersendenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, isBefore, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, useRecordCount, refFilter } from '@/lib/journey';
import { useAbstimmungVersendenFlow } from '@/lib/journey/flows/AbstimmungVersenden';
import { tx } from '@/i18n';

export default function AbstimmungVersendenPage() {
  const [step, setStep] = useState(1);
  const flow = useAbstimmungVersendenFlow({
    steps: { terminabstimmungen: 1, teilnehmer: 2 },
    items: {
      terminabstimmungen: r => ({
        id: r.id,
        title: fieldText(r, 'titel'),
        subtitle: tx`Antwortfrist: ${fieldDate(r, 'antwortfrist') ?? '—'}`,
        status: fieldLookup(r, 'status') ?? undefined,
      }),
      teilnehmer: r => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
        subtitle: fieldText(r, 'email'),
        status: fieldLookup(r, 'rolle') ?? undefined,
      }),
    },
  });

  const abstimmung = flow.targets.terminabstimmungen?.record;
  const abstimmungId = abstimmung?.id;
  const vorschlaege = useRecordCount(flow.port, 'terminvorschlaege', {
    filter: abstimmungId ? refFilter('terminabstimmung', abstimmungId) : undefined,
    where: r => fieldRefIs(r, abstimmungId),
    enabled: Boolean(abstimmungId),
  });

  const checkStep2 = (): boolean | string => {
    if (!abstimmung) return tx('Wähle zuerst eine Abstimmung aus.');
    const frist = fieldDate(abstimmung, 'antwortfrist');
    if (frist && isBefore(parseISO(frist), new Date())) {
      return tx('Die Antwortfrist darf nicht in der Vergangenheit liegen.');
    }
    if (vorschlaege.count === 0) return tx('Die Abstimmung hat noch keinen Terminvorschlag.');
    return flow.validateStep(2);
  };

  return (
    <IntentWizardShell
      title={tx('Abstimmung versenden')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine Abstimmung freigeben, damit Teilnehmer antworten können.'),
        needs: [tx('Eine Abstimmung im Entwurf'), tx('Mindestens einen Terminvorschlag'), tx('Einen Teilnehmer')],
      }}
    >
      <WizardStep label={tx('Entwurf')} description={tx('Welche Abstimmung soll versendet werden?')}>
        <EntitySelectStep
          {...flow.picks.terminabstimmungen.select}
          {...flow.pick('terminabstimmungen')}
          searchPlaceholder={tx('Titel suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Prüfen')}
        description={tx('Wähle den Teilnehmer, der die Einladung erhält.')}
        needs={['terminabstimmungen']}
      >
        <div className="space-y-4">
          {abstimmung && (
            <div className="rounded-2xl border bg-secondary/40 p-4 text-sm overflow-hidden">
              <p className="font-medium truncate">{fieldText(abstimmung, 'titel')}</p>
              <p className="text-muted-foreground">
                {tx`Antwortfrist: ${fieldDate(abstimmung, 'antwortfrist') ?? '—'}`}
              </p>
              <p className="text-muted-foreground">
                {vorschlaege.count === null
                  ? tx('Terminvorschläge werden geprüft …')
                  : tx`${vorschlaege.count} Terminvorschläge vorhanden`}
              </p>
            </div>
          )}
          <EntitySelectStep
            {...flow.picks.teilnehmer.select}
            {...flow.pick('teilnehmer')}
            avatar="initials"
            searchPlaceholder={tx('Name oder E-Mail …')}
          />
          <StepNav
            onBack={() => setStep(1)}
            onNext={checkStep2}
            nextStepLabel={tx('Versand prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Versenden')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'status-neu', label: tx('Neuer Status der Abstimmung'), value: tx('Versendet') },
              { key: 'einladung-neu', label: tx('Einladungsstatus'), value: tx('Versendet') },
              { key: 'einladung-am', label: tx('Einladung versendet am'), value: format(new Date(), 'dd.MM.yyyy HH:mm') },
            ]}
            whatHappensNext={tx('Die Abstimmung wird freigegeben und der Teilnehmer gilt als eingeladen.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          whatHappensNext={tx('Teilnehmer können jetzt ihre Antworten abgeben.')}
          next={[
            { label: tx('Termin festlegen'), href: '#/intents/termin-festlegen' },
            { label: tx('Neue Terminabstimmung'), href: '#/intents/terminabstimmung-anlegen' },
            { label: tx('Abstimmung absagen'), href: '#/intents/abstimmung-absagen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}

function fieldRefIs(r: { fields: Record<string, unknown> }, id: string | undefined): boolean {
  if (!id) return false;
  const v = r.fields.terminabstimmung;
  return typeof v === 'string' && v.includes(id);
}
