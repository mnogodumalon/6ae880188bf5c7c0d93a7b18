import type { Terminabstimmungen, Terminvorschlaege, Teilnehmer, Rueckmeldungen, AlternativeTerminvorschlaege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface TerminabstimmungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Terminabstimmungen;
  /** 1:N „Terminvorschläge" (terminabstimmung): VOLLE Liste — der Block filtert auf diesen Record. */
  terminvorschlaegeList: Terminvorschlaege[];
  /** Zeilen-Klick → overlay.push auf das Terminvorschlaege-Detail (nie der Edit-Dialog). */
  onOpenTerminvorschlaege: (record: Terminvorschlaege) => void;
  /** Kontextuelles „+": öffnet den Terminvorschlaege-Dialog mit diesem Record vorgesetzt. */
  onAddTerminvorschlaege?: () => void;
  /** 1:N „Teilnehmer" (terminabstimmung): VOLLE Liste — der Block filtert auf diesen Record. */
  teilnehmerList: Teilnehmer[];
  /** Zeilen-Klick → overlay.push auf das Teilnehmer-Detail (nie der Edit-Dialog). */
  onOpenTeilnehmer: (record: Teilnehmer) => void;
  /** Kontextuelles „+": öffnet den Teilnehmer-Dialog mit diesem Record vorgesetzt. */
  onAddTeilnehmer?: () => void;
  /** 1:N „Rückmeldungen" (terminabstimmung): VOLLE Liste — der Block filtert auf diesen Record. */
  rueckmeldungenList: Rueckmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Rueckmeldungen-Detail (nie der Edit-Dialog). */
  onOpenRueckmeldungen: (record: Rueckmeldungen) => void;
  /** Kontextuelles „+": öffnet den Rueckmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddRueckmeldungen?: () => void;
  /** 1:N „Alternative Terminvorschläge" (terminabstimmung): VOLLE Liste — der Block filtert auf diesen Record. */
  alternativeTerminvorschlaegeList: AlternativeTerminvorschlaege[];
  /** Zeilen-Klick → overlay.push auf das AlternativeTerminvorschlaege-Detail (nie der Edit-Dialog). */
  onOpenAlternativeTerminvorschlaege: (record: AlternativeTerminvorschlaege) => void;
  /** Kontextuelles „+": öffnet den AlternativeTerminvorschlaege-Dialog mit diesem Record vorgesetzt. */
  onAddAlternativeTerminvorschlaege?: () => void;
}

export function TerminabstimmungenDetails({
  record,
  terminvorschlaegeList,
  onOpenTerminvorschlaege,
  onAddTerminvorschlaege,
  teilnehmerList,
  onOpenTeilnehmer,
  onAddTeilnehmer,
  rueckmeldungenList,
  onOpenRueckmeldungen,
  onAddRueckmeldungen,
  alternativeTerminvorschlaegeList,
  onOpenAlternativeTerminvorschlaege,
  onAddAlternativeTerminvorschlaege,
}: TerminabstimmungenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('terminabstimmungen', 'abstimmungsnummer')} value={record.fields.abstimmungsnummer} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('terminabstimmungen', 'organisator_vorname')} value={record.fields.organisator_vorname} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'organisator_nachname')} value={record.fields.organisator_nachname} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'organisator_email')} value={record.fields.organisator_email} format="email" />
        <RecordField label={fieldLabel('terminabstimmungen', 'standarddauer_minuten')} value={record.fields.standarddauer_minuten} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'meeting_link')} value={record.fields.meeting_link} format="url" />
        <RecordField label={fieldLabel('terminabstimmungen', 'zeitzone')} value={record.fields.zeitzone} format="pill" />
        <RecordField label={fieldLabel('terminabstimmungen', 'antwortfrist')} value={record.fields.antwortfrist} format="datetime" />
        <RecordField label={fieldLabel('terminabstimmungen', 'entscheidungsregel')} value={record.fields.entscheidungsregel} format="pill" />
        <RecordField label={fieldLabel('terminabstimmungen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('terminabstimmungen', 'entscheidungskommentar')} value={record.fields.entscheidungskommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('terminabstimmungen', 'festgelegt_am')} value={record.fields.festgelegt_am} format="datetime" />
        <RecordField label={fieldLabel('terminabstimmungen', 'abgesagt_am')} value={record.fields.abgesagt_am} format="datetime" />
        <RecordField label={fieldLabel('terminabstimmungen', 'kalender_ausgabe')} value={record.fields.kalender_ausgabe} format="pill" />
        <RecordField label={fieldLabel('terminabstimmungen', 'kalender_einladungen_senden')} value={record.fields.kalender_einladungen_senden} format="bool" />
        <RecordField label={fieldLabel('terminabstimmungen', 'google_kalender_id')} value={record.fields.google_kalender_id} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'outlook_kalender_id')} value={record.fields.outlook_kalender_id} format="text" />
        <RecordField label={fieldLabel('terminabstimmungen', 'ics_sequenz')} value={record.fields.ics_sequenz} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('terminvorschlaege')}
        items={terminvorschlaegeList.filter(r => extractRecordId(r.fields.terminabstimmung) === record.record_id)}
        map={r => ({ name: r.fields.ort_abweichend ?? appLabel('terminvorschlaege'), meta: r.fields.start })}
        onOpen={onOpenTerminvorschlaege}
        onAdd={onAddTerminvorschlaege}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('teilnehmer')}
        items={teilnehmerList.filter(r => extractRecordId(r.fields.terminabstimmung) === record.record_id)}
        map={r => ({ name: r.fields.vorname ?? appLabel('teilnehmer'), meta: r.fields.einladung_versendet_am })}
        onOpen={onOpenTeilnehmer}
        onAdd={onAddTeilnehmer}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('rueckmeldungen')}
        items={rueckmeldungenList.filter(r => extractRecordId(r.fields.terminabstimmung) === record.record_id)}
        map={r => ({ name: appLabel('rueckmeldungen'), meta: r.fields.antwortzeitpunkt })}
        onOpen={onOpenRueckmeldungen}
        onAdd={onAddRueckmeldungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('alternative_terminvorschlaege')}
        items={alternativeTerminvorschlaegeList.filter(r => extractRecordId(r.fields.terminabstimmung) === record.record_id)}
        map={r => ({ name: appLabel('alternative_terminvorschlaege'), meta: r.fields.start })}
        onOpen={onOpenAlternativeTerminvorschlaege}
        onAdd={onAddAlternativeTerminvorschlaege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TERMINABSTIMMUNGEN} recordId={record.record_id} readOnly={!perms.canWrite('terminabstimmungen')} />
    </>
  );
}
