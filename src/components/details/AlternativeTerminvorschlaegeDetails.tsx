import type { AlternativeTerminvorschlaege, Terminabstimmungen, Teilnehmer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface AlternativeTerminvorschlaegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: AlternativeTerminvorschlaege;
  /** N:1-Ziel „Terminabstimmungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  terminabstimmungenList: Terminabstimmungen[];
  /** Klick auf die Terminabstimmungen-Relation → overlay.push auf dessen Detail. */
  onOpenTerminabstimmungen?: (record: Terminabstimmungen) => void;
  /** N:1-Ziel „Teilnehmer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teilnehmerList: Teilnehmer[];
  /** Klick auf die Teilnehmer-Relation → overlay.push auf dessen Detail. */
  onOpenTeilnehmer?: (record: Teilnehmer) => void;
}

export function AlternativeTerminvorschlaegeDetails({
  record,
  terminabstimmungenList,
  onOpenTerminabstimmungen,
  teilnehmerList,
  onOpenTeilnehmer,
}: AlternativeTerminvorschlaegeDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const terminabstimmungTarget = terminabstimmungenList.find(r => r.record_id === extractRecordId(record.fields.terminabstimmung));
  const vorgeschlagen_vonTarget = teilnehmerList.find(r => r.record_id === extractRecordId(record.fields.vorgeschlagen_von));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('alternative_terminvorschlaege', 'start')} value={record.fields.start} format="datetime" />
        <RecordField label={fieldLabel('alternative_terminvorschlaege', 'ende')} value={record.fields.ende} format="datetime" />
        <RecordField label={fieldLabel('alternative_terminvorschlaege', 'kommentar')} value={record.fields.kommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('alternative_terminvorschlaege', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('alternative_terminvorschlaege', 'terminabstimmung')}
          name={terminabstimmungTarget?.fields.abstimmungsnummer ?? '—'}
          meta={[terminabstimmungTarget?.fields.organisator_email].filter(Boolean).join(' · ') || undefined}
          onClick={terminabstimmungTarget && onOpenTerminabstimmungen ? () => onOpenTerminabstimmungen!(terminabstimmungTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('alternative_terminvorschlaege', 'vorgeschlagen_von')}
          name={vorgeschlagen_vonTarget?.fields.vorname ?? '—'}
          meta={[vorgeschlagen_vonTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={vorgeschlagen_vonTarget && onOpenTeilnehmer ? () => onOpenTeilnehmer!(vorgeschlagen_vonTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.ALTERNATIVE_TERMINVORSCHLAEGE} recordId={record.record_id} readOnly={!perms.canWrite('alternative_terminvorschlaege')} />
    </>
  );
}
