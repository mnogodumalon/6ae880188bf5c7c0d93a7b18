import type { Rueckmeldungen, Terminabstimmungen, Terminvorschlaege, Teilnehmer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface RueckmeldungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Rueckmeldungen;
  /** N:1-Ziel „Terminabstimmungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  terminabstimmungenList: Terminabstimmungen[];
  /** Klick auf die Terminabstimmungen-Relation → overlay.push auf dessen Detail. */
  onOpenTerminabstimmungen?: (record: Terminabstimmungen) => void;
  /** N:1-Ziel „Terminvorschlaege": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  terminvorschlaegeList: Terminvorschlaege[];
  /** Klick auf die Terminvorschlaege-Relation → overlay.push auf dessen Detail. */
  onOpenTerminvorschlaege?: (record: Terminvorschlaege) => void;
  /** N:1-Ziel „Teilnehmer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teilnehmerList: Teilnehmer[];
  /** Klick auf die Teilnehmer-Relation → overlay.push auf dessen Detail. */
  onOpenTeilnehmer?: (record: Teilnehmer) => void;
}

export function RueckmeldungenDetails({
  record,
  terminabstimmungenList,
  onOpenTerminabstimmungen,
  terminvorschlaegeList,
  onOpenTerminvorschlaege,
  teilnehmerList,
  onOpenTeilnehmer,
}: RueckmeldungenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const terminabstimmungTarget = terminabstimmungenList.find(r => r.record_id === extractRecordId(record.fields.terminabstimmung));
  const terminvorschlagTarget = terminvorschlaegeList.find(r => r.record_id === extractRecordId(record.fields.terminvorschlag));
  const teilnehmerTarget = teilnehmerList.find(r => r.record_id === extractRecordId(record.fields.teilnehmer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('rueckmeldungen', 'verfuegbarkeit')} value={record.fields.verfuegbarkeit} format="pill" />
        <RecordField label={fieldLabel('rueckmeldungen', 'kommentar')} value={record.fields.kommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('rueckmeldungen', 'antwortzeitpunkt')} value={record.fields.antwortzeitpunkt} format="datetime" />
        <RecordField label={fieldLabel('rueckmeldungen', 'letzte_aenderung')} value={record.fields.letzte_aenderung} format="datetime" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('rueckmeldungen', 'terminabstimmung')}
          name={terminabstimmungTarget?.fields.abstimmungsnummer ?? '—'}
          meta={[terminabstimmungTarget?.fields.organisator_email].filter(Boolean).join(' · ') || undefined}
          onClick={terminabstimmungTarget && onOpenTerminabstimmungen ? () => onOpenTerminabstimmungen!(terminabstimmungTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('rueckmeldungen', 'terminvorschlag')}
          name={terminvorschlagTarget?.fields.ort_abweichend ?? '—'}
          meta={undefined}
          onClick={terminvorschlagTarget && onOpenTerminvorschlaege ? () => onOpenTerminvorschlaege!(terminvorschlagTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('rueckmeldungen', 'teilnehmer')}
          name={teilnehmerTarget?.fields.vorname ?? '—'}
          meta={[teilnehmerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={teilnehmerTarget && onOpenTeilnehmer ? () => onOpenTeilnehmer!(teilnehmerTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.RUECKMELDUNGEN} recordId={record.record_id} readOnly={!perms.canWrite('rueckmeldungen')} />
    </>
  );
}
