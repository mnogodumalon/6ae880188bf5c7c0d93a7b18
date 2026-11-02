import type { EnrichedAlternativeTerminvorschlaege, EnrichedRueckmeldungen, EnrichedTeilnehmer, EnrichedTerminvorschlaege } from '@/types/enriched';
import type { AlternativeTerminvorschlaege, Rueckmeldungen, Teilnehmer, Terminabstimmungen, Terminvorschlaege } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface TerminvorschlaegeMaps {
  terminabstimmungenMap: Map<string, Terminabstimmungen>;
}

export function enrichTerminvorschlaege(
  terminvorschlaege: Terminvorschlaege[],
  maps: TerminvorschlaegeMaps
): EnrichedTerminvorschlaege[] {
  return terminvorschlaege.map(r => ({
    ...r,
    terminabstimmungName: resolveDisplay(r.fields.terminabstimmung, maps.terminabstimmungenMap, 'abstimmungsnummer'),
  }));
}

interface TeilnehmerMaps {
  terminabstimmungenMap: Map<string, Terminabstimmungen>;
}

export function enrichTeilnehmer(
  teilnehmer: Teilnehmer[],
  maps: TeilnehmerMaps
): EnrichedTeilnehmer[] {
  return teilnehmer.map(r => ({
    ...r,
    terminabstimmungName: resolveDisplay(r.fields.terminabstimmung, maps.terminabstimmungenMap, 'abstimmungsnummer'),
  }));
}

interface RueckmeldungenMaps {
  terminabstimmungenMap: Map<string, Terminabstimmungen>;
  terminvorschlaegeMap: Map<string, Terminvorschlaege>;
  teilnehmerMap: Map<string, Teilnehmer>;
}

export function enrichRueckmeldungen(
  rueckmeldungen: Rueckmeldungen[],
  maps: RueckmeldungenMaps
): EnrichedRueckmeldungen[] {
  return rueckmeldungen.map(r => ({
    ...r,
    terminabstimmungName: resolveDisplay(r.fields.terminabstimmung, maps.terminabstimmungenMap, 'abstimmungsnummer'),
    terminvorschlagName: resolveDisplay(r.fields.terminvorschlag, maps.terminvorschlaegeMap, 'ort_abweichend'),
    teilnehmerName: resolveDisplay(r.fields.teilnehmer, maps.teilnehmerMap, 'vorname', 'nachname'),
  }));
}

interface AlternativeTerminvorschlaegeMaps {
  terminabstimmungenMap: Map<string, Terminabstimmungen>;
  teilnehmerMap: Map<string, Teilnehmer>;
}

export function enrichAlternativeTerminvorschlaege(
  alternativeTerminvorschlaege: AlternativeTerminvorschlaege[],
  maps: AlternativeTerminvorschlaegeMaps
): EnrichedAlternativeTerminvorschlaege[] {
  return alternativeTerminvorschlaege.map(r => ({
    ...r,
    terminabstimmungName: resolveDisplay(r.fields.terminabstimmung, maps.terminabstimmungenMap, 'abstimmungsnummer'),
    vorgeschlagen_vonName: resolveDisplay(r.fields.vorgeschlagen_von, maps.teilnehmerMap, 'vorname', 'nachname'),
  }));
}
