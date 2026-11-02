/**
 * Abstimmung absagen — 3-Schritt-Wizard.
 * Steps: 1) Terminabstimmung wählen → 2) Begründung eintragen → 3) Absage bestätigen.
 * Reads: terminabstimmungen. Writes: terminabstimmungen (update: status, abgesagt_am, entscheidungskommentar).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, fieldDate, formatFieldValue } from '@/lib/journey';
import { useAbstimmungAbsagenFlow } from '@/lib/journey/flows/AbstimmungAbsagen';
import { optionsOf } from '@/lib/journey';
import { tx } from '@/i18n';

export default function AbstimmungAbsagenPage() {
  const [step, setStep] = useState(1);
  const flow = useAbstimmungAbsagenFlow({
    steps: { terminabstimmungen: 1, entscheidungskommentar: 2 },
    items: {
      terminabstimmungen: r => {
        const nummer = fieldText(r, 'abstimmungsnummer');
        const titel = fieldText(r, 'titel');
        return {
          id: r.id,
          title: nummer ? `${nummer} — ${titel}` : titel,
          subtitle: `${fieldText(r, 'organisator_vorname')} ${fieldText(r, 'organisator_nachname')}`.trim(),
          status: fieldLookup(r, 'status') ?? undefined,
        };
      },
    },
  });

  const abgesagtLabel = optionsOf('terminabstimmungen', 'status').find(o => o.key === 'abgesagt')?.label ?? '';
  const result = flow.submit.result;
  const facts = result
    ? [
        { label: tx('Status'), value: fieldLookup(result.primary, 'status')?.label ?? abgesagtLabel },
        {
          label: tx('Abgesagt am'),
          value: formatFieldValue('terminabstimmungen', 'abgesagt_am', fieldDate(result.primary, 'abgesagt_am')),
        },
      ]
    : [];

  return (
    <IntentWizardShell
      title={tx('Abstimmung absagen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Sage eine Terminabstimmung ab und halte den Grund fest.'),
        needs: [tx('Die betroffene Terminabstimmung'), tx('Eine kurze Begründung')],
      }}
    >
      <WizardStep label={tx('Terminabstimmung')} description={tx('Welche Abstimmung möchtest du absagen?')}>
        <EntitySelectStep
          {...flow.picks.terminabstimmungen.select}
          {...flow.pick('terminabstimmungen')}
          searchPlaceholder={tx('Nummer oder Titel suchen …')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Begründung')}
        description={tx('Schreibe auf, warum die Abstimmung abgesagt wird.')}
        needs={['terminabstimmungen']}
      >
        <div className="space-y-4">
          <Bound
            form={flow.forms.terminabstimmungen}
            name="entscheidungskommentar"
            rows={5}
            hint={tx('Der Kommentar wird an der Abstimmung gespeichert.')}
          />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Bestätigen')} description={tx('Prüfe die Angaben, dann sagst du die Abstimmung ab.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status_neu', label: tx('Neuer Status'), value: abgesagtLabel }]}
            confirmLabel={tx('Abstimmung absagen')}
            whatHappensNext={tx('Der Status wechselt auf „abgesagt“, der Zeitpunkt der Absage wird automatisch gespeichert.')}
          />
        )}
      </WizardStep>
      {result && (
        <SuccessStep
          result={result}
          forms={flow.formList}
          submit={flow.submit}
          facts={facts}
          actions={{ copy: false, print: false }}
          whatHappensNext={tx('Die Abstimmung ist abgesagt. Lege bei Bedarf eine neue an.')}
          next={[
            { label: tx('Terminabstimmung anlegen'), href: '#/intents/terminabstimmung-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
