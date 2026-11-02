import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Terminabstimmungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    abstimmungsnummer?: string;
    titel?: string;
    beschreibung?: string;
    organisator_vorname?: string;
    organisator_nachname?: string;
    organisator_email?: string;
    standarddauer_minuten?: number;
    ort?: string;
    meeting_link?: string;
    zeitzone?: LookupValue;
    antwortfrist?: string; // Format: YYYY-MM-DD oder ISO String
    entscheidungsregel?: LookupValue;
    status?: LookupValue;
    entscheidungskommentar?: string;
    festgelegt_am?: string; // Format: YYYY-MM-DD oder ISO String
    abgesagt_am?: string; // Format: YYYY-MM-DD oder ISO String
    kalender_ausgabe?: LookupValue;
    kalender_einladungen_senden?: boolean;
    google_kalender_id?: string;
    outlook_kalender_id?: string;
    ics_sequenz?: number;
  };
}

export interface Terminvorschlaege {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    terminabstimmung?: RecordUrl; // applookup -> URL zu 'Terminabstimmungen' Record
    start?: string; // Format: YYYY-MM-DD oder ISO String
    ende?: string; // Format: YYYY-MM-DD oder ISO String
    ort_abweichend?: string;
    meeting_link_abweichend?: string;
    reihenfolge?: number;
    anzahl_ja?: number;
    anzahl_wenn_noetig?: number;
    anzahl_nein?: number;
    anzahl_ohne_antwort?: number;
    anzahl_pflichtteilnehmer_ja?: number;
    eignung?: LookupValue;
    final_gewaehlt?: boolean;
  };
}

export interface Teilnehmer {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    terminabstimmung?: RecordUrl; // applookup -> URL zu 'Terminabstimmungen' Record
    vorname?: string;
    nachname?: string;
    email?: string;
    organisation?: string;
    rolle?: LookupValue;
    zugriffstoken?: string;
    abstimmungslink?: string;
    einladungsstatus?: LookupValue;
    einladung_versendet_am?: string; // Format: YYYY-MM-DD oder ISO String
    erinnerung_versendet_am?: string; // Format: YYYY-MM-DD oder ISO String
    geantwortet_am?: string; // Format: YYYY-MM-DD oder ISO String
    allgemeiner_kommentar?: string;
    teilnahme_abgesagt?: boolean;
  };
}

export interface Rueckmeldungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    terminabstimmung?: RecordUrl; // applookup -> URL zu 'Terminabstimmungen' Record
    terminvorschlag?: RecordUrl; // applookup -> URL zu 'Terminvorschlaege' Record
    teilnehmer?: RecordUrl; // applookup -> URL zu 'Teilnehmer' Record
    verfuegbarkeit?: LookupValue;
    kommentar?: string;
    antwortzeitpunkt?: string; // Format: YYYY-MM-DD oder ISO String
    letzte_aenderung?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface AlternativeTerminvorschlaege {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    terminabstimmung?: RecordUrl; // applookup -> URL zu 'Terminabstimmungen' Record
    vorgeschlagen_von?: RecordUrl; // applookup -> URL zu 'Teilnehmer' Record
    start?: string; // Format: YYYY-MM-DD oder ISO String
    ende?: string; // Format: YYYY-MM-DD oder ISO String
    kommentar?: string;
    status?: LookupValue;
  };
}

export const APP_IDS = {
  TERMINABSTIMMUNGEN: '6ae87ffb8c381148eb9f089b',
  TERMINVORSCHLAEGE: '6ae88001cd6ea6927a9488eb',
  TEILNEHMER: '6ae88001948b1f7a5b685fad',
  RUECKMELDUNGEN: '6ae88002d0d145fa64cd5833',
  ALTERNATIVE_TERMINVORSCHLAEGE: '6ae880029a28a0002b5c83d8',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'terminabstimmungen': {
    zeitzone: [{ key: "europe_berlin", get label() { return lookupLabel('terminabstimmungen', 'zeitzone', "europe_berlin") ?? "Europe/Berlin"; } }, { key: "europe_london", get label() { return lookupLabel('terminabstimmungen', 'zeitzone', "europe_london") ?? "Europe/London"; } }, { key: "europe_zurich", get label() { return lookupLabel('terminabstimmungen', 'zeitzone', "europe_zurich") ?? "Europe/Zurich"; } }, { key: "europe_vienna", get label() { return lookupLabel('terminabstimmungen', 'zeitzone', "europe_vienna") ?? "Europe/Vienna"; } }, { key: "utc", get label() { return lookupLabel('terminabstimmungen', 'zeitzone', "utc") ?? "UTC"; } }],
    entscheidungsregel: [{ key: "organisator_entscheidet", get label() { return lookupLabel('terminabstimmungen', 'entscheidungsregel', "organisator_entscheidet") ?? "Organisator entscheidet"; } }, { key: "alle_pflichtteilnehmer", get label() { return lookupLabel('terminabstimmungen', 'entscheidungsregel', "alle_pflichtteilnehmer") ?? "Alle Pflichtteilnehmer müssen verfügbar sein"; } }, { key: "mehrheit_entscheidet", get label() { return lookupLabel('terminabstimmungen', 'entscheidungsregel', "mehrheit_entscheidet") ?? "Mehrheit entscheidet"; } }],
    status: [{ key: "entwurf", get label() { return lookupLabel('terminabstimmungen', 'status', "entwurf") ?? "Entwurf"; } }, { key: "versendet", get label() { return lookupLabel('terminabstimmungen', 'status', "versendet") ?? "Versendet"; } }, { key: "in_abstimmung", get label() { return lookupLabel('terminabstimmungen', 'status', "in_abstimmung") ?? "In Abstimmung"; } }, { key: "abgelaufen", get label() { return lookupLabel('terminabstimmungen', 'status', "abgelaufen") ?? "Abgelaufen"; } }, { key: "festgelegt", get label() { return lookupLabel('terminabstimmungen', 'status', "festgelegt") ?? "Festgelegt"; } }, { key: "abgesagt", get label() { return lookupLabel('terminabstimmungen', 'status', "abgesagt") ?? "Abgesagt"; } }, { key: "archiviert", get label() { return lookupLabel('terminabstimmungen', 'status', "archiviert") ?? "Archiviert"; } }],
    kalender_ausgabe: [{ key: "nur_ics", get label() { return lookupLabel('terminabstimmungen', 'kalender_ausgabe', "nur_ics") ?? "Nur .ics-Datei"; } }, { key: "google", get label() { return lookupLabel('terminabstimmungen', 'kalender_ausgabe', "google") ?? "Google Calendar"; } }, { key: "outlook", get label() { return lookupLabel('terminabstimmungen', 'kalender_ausgabe', "outlook") ?? "Outlook / Microsoft 365"; } }, { key: "beides", get label() { return lookupLabel('terminabstimmungen', 'kalender_ausgabe', "beides") ?? "Beides (Google und Outlook)"; } }],
  },
  'terminvorschlaege': {
    eignung: [{ key: "sehr_gut", get label() { return lookupLabel('terminvorschlaege', 'eignung', "sehr_gut") ?? "Sehr gut"; } }, { key: "gut", get label() { return lookupLabel('terminvorschlaege', 'eignung', "gut") ?? "Gut"; } }, { key: "eingeschraenkt", get label() { return lookupLabel('terminvorschlaege', 'eignung', "eingeschraenkt") ?? "Eingeschränkt"; } }, { key: "ungeeignet", get label() { return lookupLabel('terminvorschlaege', 'eignung', "ungeeignet") ?? "Ungeeignet"; } }],
  },
  'teilnehmer': {
    rolle: [{ key: "pflichtteilnehmer", get label() { return lookupLabel('teilnehmer', 'rolle', "pflichtteilnehmer") ?? "Pflichtteilnehmer"; } }, { key: "optionaler_teilnehmer", get label() { return lookupLabel('teilnehmer', 'rolle', "optionaler_teilnehmer") ?? "Optionaler Teilnehmer"; } }, { key: "entscheider", get label() { return lookupLabel('teilnehmer', 'rolle', "entscheider") ?? "Entscheider"; } }, { key: "organisator", get label() { return lookupLabel('teilnehmer', 'rolle', "organisator") ?? "Organisator"; } }],
    einladungsstatus: [{ key: "nicht_versendet", get label() { return lookupLabel('teilnehmer', 'einladungsstatus', "nicht_versendet") ?? "Nicht versendet"; } }, { key: "versendet", get label() { return lookupLabel('teilnehmer', 'einladungsstatus', "versendet") ?? "Versendet"; } }, { key: "erinnert", get label() { return lookupLabel('teilnehmer', 'einladungsstatus', "erinnert") ?? "Erinnert"; } }, { key: "geoeffnet", get label() { return lookupLabel('teilnehmer', 'einladungsstatus', "geoeffnet") ?? "Geöffnet"; } }, { key: "geantwortet", get label() { return lookupLabel('teilnehmer', 'einladungsstatus', "geantwortet") ?? "Geantwortet"; } }, { key: "abgesagt", get label() { return lookupLabel('teilnehmer', 'einladungsstatus', "abgesagt") ?? "Abgesagt"; } }],
  },
  'rueckmeldungen': {
    verfuegbarkeit: [{ key: "ja", get label() { return lookupLabel('rueckmeldungen', 'verfuegbarkeit', "ja") ?? "Ja"; } }, { key: "wenn_noetig", get label() { return lookupLabel('rueckmeldungen', 'verfuegbarkeit', "wenn_noetig") ?? "Wenn nötig"; } }, { key: "nein", get label() { return lookupLabel('rueckmeldungen', 'verfuegbarkeit', "nein") ?? "Nein"; } }],
  },
  'alternative_terminvorschlaege': {
    status: [{ key: "neu", get label() { return lookupLabel('alternative_terminvorschlaege', 'status', "neu") ?? "Neu"; } }, { key: "uebernommen", get label() { return lookupLabel('alternative_terminvorschlaege', 'status', "uebernommen") ?? "Übernommen"; } }, { key: "abgelehnt", get label() { return lookupLabel('alternative_terminvorschlaege', 'status', "abgelehnt") ?? "Abgelehnt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'terminabstimmungen': {
    'abstimmungsnummer': 'string/text',
    'titel': 'string/text',
    'beschreibung': 'string/textarea',
    'organisator_vorname': 'string/text',
    'organisator_nachname': 'string/text',
    'organisator_email': 'string/email',
    'standarddauer_minuten': 'number',
    'ort': 'string/text',
    'meeting_link': 'string/url',
    'zeitzone': 'lookup/select',
    'antwortfrist': 'date/datetimeminute',
    'entscheidungsregel': 'lookup/radio',
    'status': 'lookup/select',
    'entscheidungskommentar': 'string/textarea',
    'festgelegt_am': 'date/datetimeminute',
    'abgesagt_am': 'date/datetimeminute',
    'kalender_ausgabe': 'lookup/select',
    'kalender_einladungen_senden': 'bool',
    'google_kalender_id': 'string/text',
    'outlook_kalender_id': 'string/text',
    'ics_sequenz': 'number',
  },
  'terminvorschlaege': {
    'terminabstimmung': 'applookup/select',
    'start': 'date/datetimeminute',
    'ende': 'date/datetimeminute',
    'ort_abweichend': 'string/text',
    'meeting_link_abweichend': 'string/url',
    'reihenfolge': 'number',
    'anzahl_ja': 'number',
    'anzahl_wenn_noetig': 'number',
    'anzahl_nein': 'number',
    'anzahl_ohne_antwort': 'number',
    'anzahl_pflichtteilnehmer_ja': 'number',
    'eignung': 'lookup/select',
    'final_gewaehlt': 'bool',
  },
  'teilnehmer': {
    'terminabstimmung': 'applookup/select',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'organisation': 'string/text',
    'rolle': 'lookup/select',
    'zugriffstoken': 'string/text',
    'abstimmungslink': 'string/url',
    'einladungsstatus': 'lookup/select',
    'einladung_versendet_am': 'date/datetimeminute',
    'erinnerung_versendet_am': 'date/datetimeminute',
    'geantwortet_am': 'date/datetimeminute',
    'allgemeiner_kommentar': 'string/textarea',
    'teilnahme_abgesagt': 'bool',
  },
  'rueckmeldungen': {
    'terminabstimmung': 'applookup/select',
    'terminvorschlag': 'applookup/select',
    'teilnehmer': 'applookup/select',
    'verfuegbarkeit': 'lookup/radio',
    'kommentar': 'string/textarea',
    'antwortzeitpunkt': 'date/datetimeminute',
    'letzte_aenderung': 'date/datetimeminute',
  },
  'alternative_terminvorschlaege': {
    'terminabstimmung': 'applookup/select',
    'vorgeschlagen_von': 'applookup/select',
    'start': 'date/datetimeminute',
    'ende': 'date/datetimeminute',
    'kommentar': 'string/textarea',
    'status': 'lookup/select',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
  'terminabstimmungen': [
    { field: 'terminabstimmung', entity: 'terminvorschlaege' },
    { field: 'terminabstimmung', entity: 'teilnehmer' },
    { field: 'terminabstimmung', entity: 'rueckmeldungen' },
    { field: 'terminabstimmung', entity: 'alternative_terminvorschlaege' },
  ],
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateTerminabstimmungen = StripLookup<Terminabstimmungen['fields']>;
export type CreateTerminvorschlaege = StripLookup<Terminvorschlaege['fields']>;
export type CreateTeilnehmer = StripLookup<Teilnehmer['fields']>;
export type CreateRueckmeldungen = StripLookup<Rueckmeldungen['fields']>;
export type CreateAlternativeTerminvorschlaege = StripLookup<AlternativeTerminvorschlaege['fields']>;