import type { Teilnehmer, Terminabstimmungen, Rueckmeldungen, AlternativeTerminvorschlaege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface TeilnehmerDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Teilnehmer;
  /** N:1-Ziel „Terminabstimmungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  terminabstimmungenList: Terminabstimmungen[];
  /** Klick auf die Terminabstimmungen-Relation → overlay.push auf dessen Detail. */
  onOpenTerminabstimmungen?: (record: Terminabstimmungen) => void;
  /** 1:N „Rückmeldungen" (teilnehmer): VOLLE Liste — der Block filtert auf diesen Record. */
  rueckmeldungenList: Rueckmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Rueckmeldungen-Detail (nie der Edit-Dialog). */
  onOpenRueckmeldungen: (record: Rueckmeldungen) => void;
  /** Kontextuelles „+": öffnet den Rueckmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddRueckmeldungen?: () => void;
  /** 1:N „Alternative Terminvorschläge" (vorgeschlagen_von): VOLLE Liste — der Block filtert auf diesen Record. */
  alternativeTerminvorschlaegeList: AlternativeTerminvorschlaege[];
  /** Zeilen-Klick → overlay.push auf das AlternativeTerminvorschlaege-Detail (nie der Edit-Dialog). */
  onOpenAlternativeTerminvorschlaege: (record: AlternativeTerminvorschlaege) => void;
  /** Kontextuelles „+": öffnet den AlternativeTerminvorschlaege-Dialog mit diesem Record vorgesetzt. */
  onAddAlternativeTerminvorschlaege?: () => void;
}

export function TeilnehmerDetails({
  record,
  terminabstimmungenList,
  onOpenTerminabstimmungen,
  rueckmeldungenList,
  onOpenRueckmeldungen,
  onAddRueckmeldungen,
  alternativeTerminvorschlaegeList,
  onOpenAlternativeTerminvorschlaege,
  onAddAlternativeTerminvorschlaege,
}: TeilnehmerDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const terminabstimmungTarget = terminabstimmungenList.find(r => r.record_id === extractRecordId(record.fields.terminabstimmung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('teilnehmer', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('teilnehmer', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('teilnehmer', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('teilnehmer', 'organisation')} value={record.fields.organisation} format="text" />
        <RecordField label={fieldLabel('teilnehmer', 'rolle')} value={record.fields.rolle} format="pill" />
        <RecordField label={fieldLabel('teilnehmer', 'zugriffstoken')} value={record.fields.zugriffstoken} format="text" />
        <RecordField label={fieldLabel('teilnehmer', 'abstimmungslink')} value={record.fields.abstimmungslink} format="url" />
        <RecordField label={fieldLabel('teilnehmer', 'einladungsstatus')} value={record.fields.einladungsstatus} format="pill" />
        <RecordField label={fieldLabel('teilnehmer', 'einladung_versendet_am')} value={record.fields.einladung_versendet_am} format="datetime" />
        <RecordField label={fieldLabel('teilnehmer', 'erinnerung_versendet_am')} value={record.fields.erinnerung_versendet_am} format="datetime" />
        <RecordField label={fieldLabel('teilnehmer', 'geantwortet_am')} value={record.fields.geantwortet_am} format="datetime" />
        <RecordField label={fieldLabel('teilnehmer', 'allgemeiner_kommentar')} value={record.fields.allgemeiner_kommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('teilnehmer', 'teilnahme_abgesagt')} value={record.fields.teilnahme_abgesagt} format="bool" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('teilnehmer', 'terminabstimmung')}
          name={terminabstimmungTarget?.fields.abstimmungsnummer ?? '—'}
          meta={[terminabstimmungTarget?.fields.organisator_email].filter(Boolean).join(' · ') || undefined}
          onClick={terminabstimmungTarget && onOpenTerminabstimmungen ? () => onOpenTerminabstimmungen!(terminabstimmungTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('rueckmeldungen')}
        items={rueckmeldungenList.filter(r => extractRecordId(r.fields.teilnehmer) === record.record_id)}
        map={r => ({ name: appLabel('rueckmeldungen'), meta: r.fields.antwortzeitpunkt })}
        onOpen={onOpenRueckmeldungen}
        onAdd={onAddRueckmeldungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('alternative_terminvorschlaege')}
        items={alternativeTerminvorschlaegeList.filter(r => extractRecordId(r.fields.vorgeschlagen_von) === record.record_id)}
        map={r => ({ name: appLabel('alternative_terminvorschlaege'), meta: r.fields.start })}
        onOpen={onOpenAlternativeTerminvorschlaege}
        onAdd={onAddAlternativeTerminvorschlaege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TEILNEHMER} recordId={record.record_id} readOnly={!perms.canWrite('teilnehmer')} />
    </>
  );
}
