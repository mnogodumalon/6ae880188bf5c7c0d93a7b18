import type { Terminvorschlaege, Terminabstimmungen, Rueckmeldungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface TerminvorschlaegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Terminvorschlaege;
  /** N:1-Ziel „Terminabstimmungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  terminabstimmungenList: Terminabstimmungen[];
  /** Klick auf die Terminabstimmungen-Relation → overlay.push auf dessen Detail. */
  onOpenTerminabstimmungen?: (record: Terminabstimmungen) => void;
  /** 1:N „Rückmeldungen" (terminvorschlag): VOLLE Liste — der Block filtert auf diesen Record. */
  rueckmeldungenList: Rueckmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Rueckmeldungen-Detail (nie der Edit-Dialog). */
  onOpenRueckmeldungen: (record: Rueckmeldungen) => void;
  /** Kontextuelles „+": öffnet den Rueckmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddRueckmeldungen?: () => void;
}

export function TerminvorschlaegeDetails({
  record,
  terminabstimmungenList,
  onOpenTerminabstimmungen,
  rueckmeldungenList,
  onOpenRueckmeldungen,
  onAddRueckmeldungen,
}: TerminvorschlaegeDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const terminabstimmungTarget = terminabstimmungenList.find(r => r.record_id === extractRecordId(record.fields.terminabstimmung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('terminvorschlaege', 'start')} value={record.fields.start} format="datetime" />
        <RecordField label={fieldLabel('terminvorschlaege', 'ende')} value={record.fields.ende} format="datetime" />
        <RecordField label={fieldLabel('terminvorschlaege', 'ort_abweichend')} value={record.fields.ort_abweichend} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'meeting_link_abweichend')} value={record.fields.meeting_link_abweichend} format="url" />
        <RecordField label={fieldLabel('terminvorschlaege', 'reihenfolge')} value={record.fields.reihenfolge} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'anzahl_ja')} value={record.fields.anzahl_ja} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'anzahl_wenn_noetig')} value={record.fields.anzahl_wenn_noetig} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'anzahl_nein')} value={record.fields.anzahl_nein} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'anzahl_ohne_antwort')} value={record.fields.anzahl_ohne_antwort} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'anzahl_pflichtteilnehmer_ja')} value={record.fields.anzahl_pflichtteilnehmer_ja} format="text" />
        <RecordField label={fieldLabel('terminvorschlaege', 'eignung')} value={record.fields.eignung} format="pill" />
        <RecordField label={fieldLabel('terminvorschlaege', 'final_gewaehlt')} value={record.fields.final_gewaehlt} format="bool" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('terminvorschlaege', 'terminabstimmung')}
          name={terminabstimmungTarget?.fields.abstimmungsnummer ?? '—'}
          meta={[terminabstimmungTarget?.fields.organisator_email].filter(Boolean).join(' · ') || undefined}
          onClick={terminabstimmungTarget && onOpenTerminabstimmungen ? () => onOpenTerminabstimmungen!(terminabstimmungTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('rueckmeldungen')}
        items={rueckmeldungenList.filter(r => extractRecordId(r.fields.terminvorschlag) === record.record_id)}
        map={r => ({ name: appLabel('rueckmeldungen'), meta: r.fields.antwortzeitpunkt })}
        onOpen={onOpenRueckmeldungen}
        onAdd={onAddRueckmeldungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TERMINVORSCHLAEGE} recordId={record.record_id} readOnly={!perms.canWrite('terminvorschlaege')} />
    </>
  );
}
