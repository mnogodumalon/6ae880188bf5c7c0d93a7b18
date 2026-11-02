/**
 * Terminabstimmung anlegen — 4-Schritt-Wizard.
 * Steps: 1) Grunddaten → 2) Terminvorschläge → 3) Teilnehmer → 4) Prüfen & als Entwurf anlegen.
 * Reads: — (alles über den Flow-Hook). Writes: terminabstimmungen, terminvorschlaege (mehrere), teilnehmer (mehrere).
 * Composes: IntentWizardShell, Bound, ListEntries, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Bound } from '@/components/blocks/Bound';
import { ListEntries } from '@/components/blocks/ListEntries';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useTerminabstimmungAnlegenFlow } from '@/lib/journey/flows/TerminabstimmungAnlegen';
import { tx } from '@/i18n';

export default function TerminabstimmungAnlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useTerminabstimmungAnlegenFlow({
    steps: {
      titel: 1, beschreibung: 1, organisator_vorname: 1, organisator_nachname: 1, organisator_email: 1,
      standarddauer_minuten: 1, ort: 1, meeting_link: 1, zeitzone: 1, antwortfrist: 1, entscheidungsregel: 1,
      start: 2, ende: 2, ort_abweichend: 2, meeting_link_abweichend: 2, reihenfolge: 2,
      anzahl_ja: 2, anzahl_nein: 2, anzahl_pflichtteilnehmer_ja: 2,
      vorname: 3, nachname: 3, email: 3, organisation: 3, rolle: 3,
    },
    initial: { anzahl_ja: 0, anzahl_nein: 0, anzahl_pflichtteilnehmer_ja: 0 },
  });

  const vorschlagForm = flow.forms.terminvorschlaege;
  const teilnehmerForm = flow.forms.teilnehmer;

  // Check before the write: Ende must lie after Start (ISO strings compare chronologically).
  const checkTermine = (): string | undefined => {
    const pairs: Array<[unknown, unknown]> = [
      [vorschlagForm.get('start'), vorschlagForm.get('ende')],
      ...flow.lists.terminvorschlaege.entries.map((e): [unknown, unknown] => {
        const v = (e as unknown as { values?: Record<string, unknown> }).values ?? {};
        return [v.start, v.ende];
      }),
    ];
    for (const [s, e] of pairs) {
      if (typeof s === 'string' && typeof e === 'string' && s && e && e <= s) {
        return tx('Das Ende muss nach dem Start liegen.');
      }
    }
    return undefined;
  };

  // Check before the write: one E-Mail address per Abstimmung.
  const checkEmails = (): string | undefined => {
    const seen = new Set<string>();
    const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const mails = flow.lists.teilnehmer.entries.map(e =>
      norm((e as unknown as { values?: Record<string, unknown> }).values?.email));
    const editorMail = norm(teilnehmerForm.get('email'));
    if (editorMail) mails.push(editorMail);
    for (const m of mails) {
      if (!m) continue;
      if (seen.has(m)) return tx('Diese E-Mail-Adresse ist in dieser Abstimmung schon angelegt.');
      seen.add(m);
    }
    return undefined;
  };

  return (
    <IntentWizardShell
      title={tx('Terminabstimmung anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Abstimmung mit Terminvorschlägen und Teilnehmern in einem Zug anlegen.'),
        needs: [tx('Titel und Organisator'), tx('Mögliche Termine'), tx('Namen und E-Mail-Adressen der Teilnehmer')],
      }}
    >
      <WizardStep label={tx('Grunddaten')} description={tx('Worum geht es, wer organisiert und bis wann sollen Antworten da sein?')}>
        <div className="space-y-4">
          <Bound form={flow.forms.terminabstimmungen} name="titel" />
          <Bound form={flow.forms.terminabstimmungen} name="beschreibung" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Bound form={flow.forms.terminabstimmungen} name="organisator_vorname" />
            <Bound form={flow.forms.terminabstimmungen} name="organisator_nachname" />
          </div>
          <Bound form={flow.forms.terminabstimmungen} name="organisator_email" />
          <Bound form={flow.forms.terminabstimmungen} name="standarddauer_minuten" />
          <Bound form={flow.forms.terminabstimmungen} name="ort" />
          <Bound form={flow.forms.terminabstimmungen} name="meeting_link" />
          <Bound form={flow.forms.terminabstimmungen} name="zeitzone" />
          <Bound form={flow.forms.terminabstimmungen} name="antwortfrist" />
          <Bound form={flow.forms.terminabstimmungen} name="entscheidungsregel" />
          <StepNav hideBack onNext={() => flow.validateStep(1)} nextStepLabel={tx('Terminvorschläge')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Terminvorschläge')} description={tx('Mögliche Termine erfassen und jeweils mit „Hinzufügen“ übernehmen.')}>
        <div className="space-y-4">
          <ListEntries list={flow.lists.terminvorschlaege}>
            <Bound form={vorschlagForm} name="start" />
            <Bound form={vorschlagForm} name="ende" />
            <Bound form={vorschlagForm} name="ort_abweichend" />
            <Bound form={vorschlagForm} name="meeting_link_abweichend" />
            <Bound form={vorschlagForm} name="reihenfolge" />
            <Bound form={vorschlagForm} name="anzahl_ja" />
            <Bound form={vorschlagForm} name="anzahl_nein" />
            <Bound form={vorschlagForm} name="anzahl_pflichtteilnehmer_ja" />
          </ListEntries>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => checkTermine() ?? flow.validateStep(2)}
            nextStepLabel={tx('Teilnehmer')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Teilnehmer')} description={tx('Wer soll abstimmen? Jede Person mit „Hinzufügen“ übernehmen.')}>
        <div className="space-y-4">
          <ListEntries list={flow.lists.teilnehmer}>
            <Bound form={teilnehmerForm} name="vorname" />
            <Bound form={teilnehmerForm} name="nachname" />
            <Bound form={teilnehmerForm} name="email" />
            <Bound form={teilnehmerForm} name="organisation" />
            <Bound form={teilnehmerForm} name="rolle" />
          </ListEntries>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => checkEmails() ?? flow.validateStep(3)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Entwurf') }]}
            whatHappensNext={tx('Die Abstimmung wird als Entwurf gespeichert. Versendet wird sie erst im nächsten Schritt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Abstimmung versenden'), href: '#/intents/abstimmung-versenden' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Nummer und persönliche Zugriffslinks vergibt das System. Zum Verschicken nutze „Abstimmung versenden“.')}
        />
      )}
    </IntentWizardShell>
  );
}
