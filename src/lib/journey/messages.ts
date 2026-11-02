/**
 * Required-field messages — WRITTEN BY THE BUILD AGENT, never by a heuristic.
 *
 * The layer knows two things about an empty required field: that it is
 * required and what its label is. Out of that it can only say „„Anreise" ist
 * ein Pflichtfeld". What the person should do instead („Bitte einen Gast
 * auswählen.") is meaning, and meaning is the agent's: the Phase-2 orchestrator
 * writes one short instruction per required field — what is needed, not why — to
 * `.intents-staging/messages.json`, the integration step validates it against
 * the app metadata and renders it into the block below. Scaffold updates keep
 * the block. Do not edit outside the markers.
 *
 * Every door reads this and nothing else: `useStepForm` (flows and public
 * pages), the generated {Entity}Dialog and the public form's server-error line.
 * A field without a sentence falls back to the label sentence — never to a
 * bare „Dieses Feld ist erforderlich".
 *
 * Required fields per entity (from the base view):
 *   - terminabstimmungen: abstimmungsnummer (Abstimmungsnummer), titel (Titel), organisator_vorname (Organisator Vorname), organisator_nachname (Organisator Nachname), organisator_email (Organisator E-Mail-Adresse), standarddauer_minuten (Standarddauer in Minuten), zeitzone (Zeitzone), antwortfrist (Antwortfrist), entscheidungsregel (Entscheidungsregel), status (Status)
 *   - terminvorschlaege: terminabstimmung (Terminabstimmung), start (Startdatum und Startzeit), ende (Enddatum und Endzeit), reihenfolge (Reihenfolge)
 *   - teilnehmer: terminabstimmung (Terminabstimmung), vorname (Vorname), nachname (Nachname), email (E-Mail-Adresse), rolle (Rolle), zugriffstoken (Persönlicher Zugriffstoken), einladungsstatus (Einladungsstatus)
 *   - rueckmeldungen: terminabstimmung (Terminabstimmung), terminvorschlag (Terminvorschlag), teilnehmer (Teilnehmer), verfuegbarkeit (Verfügbarkeit), antwortzeitpunkt (Antwortzeitpunkt), letzte_aenderung (Letzte Änderung)
 *   - alternative_terminvorschlaege: terminabstimmung (Terminabstimmung), vorgeschlagen_von (Vorgeschlagen von), start (Startdatum und Startzeit), ende (Enddatum und Endzeit), status (Status)
 */
import { t, tx } from '@/i18n';
import { labelOf, type EntityKey } from './rules';

/** The writable fields of each entity — the keys a message may address (generated). */
export interface MessageFields {
  "terminabstimmungen": "abstimmungsnummer" | "titel" | "beschreibung" | "organisator_vorname" | "organisator_nachname" | "organisator_email" | "standarddauer_minuten" | "ort" | "meeting_link" | "zeitzone" | "antwortfrist" | "entscheidungsregel" | "status" | "entscheidungskommentar" | "festgelegt_am" | "abgesagt_am" | "kalender_ausgabe" | "kalender_einladungen_senden" | "google_kalender_id" | "outlook_kalender_id" | "ics_sequenz";
  "terminvorschlaege": "terminabstimmung" | "start" | "ende" | "ort_abweichend" | "meeting_link_abweichend" | "reihenfolge" | "anzahl_ja" | "anzahl_wenn_noetig" | "anzahl_nein" | "anzahl_ohne_antwort" | "anzahl_pflichtteilnehmer_ja" | "eignung" | "final_gewaehlt";
  "teilnehmer": "terminabstimmung" | "vorname" | "nachname" | "email" | "organisation" | "rolle" | "zugriffstoken" | "abstimmungslink" | "einladungsstatus" | "einladung_versendet_am" | "erinnerung_versendet_am" | "geantwortet_am" | "allgemeiner_kommentar" | "teilnahme_abgesagt";
  "rueckmeldungen": "terminabstimmung" | "terminvorschlag" | "teilnehmer" | "verfuegbarkeit" | "kommentar" | "antwortzeitpunkt" | "letzte_aenderung";
  "alternative_terminvorschlaege": "terminabstimmung" | "vorgeschlagen_von" | "start" | "ende" | "kommentar" | "status";
}
export type MessageFieldKey<E extends EntityKey> = E extends keyof MessageFields ? MessageFields[E] : never;

export const REQUIRED_MESSAGES: { [E in EntityKey]?: Partial<Record<MessageFieldKey<E>, string>> } = {
  // <custom:messages>
  // </custom:messages>
};

/** The sentence shown when `key` of `entity` is required and empty — the
 *  agent's own text (translated at runtime like every page string), else the
 *  label sentence. Call it while rendering, not at module scope. */
export function requiredMessage(entity: EntityKey, key: string): string {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  if (own && own.trim()) return tx(own);
  return t('v_required', { label: labelOf(entity, key) });
}

/** True when the agent wrote a sentence for the field. */
export function hasOwnMessage(entity: EntityKey, key: string): boolean {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  return Boolean(own && own.trim());
}
