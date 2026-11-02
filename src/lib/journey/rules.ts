/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { policyLabel } from './policy';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'terminabstimmungen' | 'terminvorschlaege' | 'teilnehmer' | 'rueckmeldungen' | 'alternative_terminvorschlaege';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "terminabstimmungen": "abstimmungsnummer" | "titel" | "beschreibung" | "organisator_vorname" | "organisator_nachname" | "organisator_email" | "ort" | "meeting_link" | "entscheidungskommentar" | "google_kalender_id" | "outlook_kalender_id";
  "terminvorschlaege": "ort_abweichend" | "meeting_link_abweichend";
  "teilnehmer": "vorname" | "nachname" | "email" | "organisation" | "zugriffstoken" | "abstimmungslink" | "allgemeiner_kommentar";
  "rueckmeldungen": "kommentar";
  "alternative_terminvorschlaege": "kommentar";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

/** The applookup fields of each entity (generated). A pick stored through
 *  `form.set` on one of these must carry its display name — at compile time
 *  (`StepForm.set`), because the review would otherwise show the id. */
export interface RecordFields {
  "terminabstimmungen": never;
  "terminvorschlaege": "terminabstimmung";
  "teilnehmer": "terminabstimmung";
  "rueckmeldungen": "terminabstimmung" | "terminvorschlag" | "teilnehmer";
  "alternative_terminvorschlaege": "terminabstimmung" | "vorgeschlagen_von";
}
export type RecordFieldKey<E extends EntityKey> = E extends keyof RecordFields ? RecordFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it as a value. `file` is false: a file is UPLOADED
   *  (`form.file(key)` → FileField; the chosen file travels in the create as a data URL). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "terminabstimmungen": {
    "key": "terminabstimmungen",
    "appId": "6ae87ffb8c381148eb9f089b",
    "label": "Terminabstimmungen",
    "pascal": "Terminabstimmungen",
    "single": "TerminabstimmungenEntry"
  },
  "terminvorschlaege": {
    "key": "terminvorschlaege",
    "appId": "6ae88001cd6ea6927a9488eb",
    "label": "Terminvorschläge",
    "pascal": "Terminvorschlaege",
    "single": "TerminvorschlaegeEntry"
  },
  "teilnehmer": {
    "key": "teilnehmer",
    "appId": "6ae88001948b1f7a5b685fad",
    "label": "Teilnehmer",
    "pascal": "Teilnehmer",
    "single": "TeilnehmerEntry"
  },
  "rueckmeldungen": {
    "key": "rueckmeldungen",
    "appId": "6ae88002d0d145fa64cd5833",
    "label": "Rückmeldungen",
    "pascal": "Rueckmeldungen",
    "single": "RueckmeldungenEntry"
  },
  "alternative_terminvorschlaege": {
    "key": "alternative_terminvorschlaege",
    "appId": "6ae880029a28a0002b5c83d8",
    "label": "Alternative Terminvorschläge",
    "pascal": "AlternativeTerminvorschlaege",
    "single": "AlternativeTerminvorschlaegeEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "terminabstimmungen": {
    "abstimmungsnummer": {
      "key": "abstimmungsnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Abstimmungsnummer",
      "writable": true,
      "maxLength": 4000
    },
    "titel": {
      "key": "titel",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Titel",
      "writable": true,
      "maxLength": 4000
    },
    "beschreibung": {
      "key": "beschreibung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Beschreibung / Agenda",
      "writable": true
    },
    "organisator_vorname": {
      "key": "organisator_vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Organisator Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "organisator_nachname": {
      "key": "organisator_nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Organisator Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "organisator_email": {
      "key": "organisator_email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "Organisator E-Mail-Adresse",
      "writable": true,
      "autoComplete": "email"
    },
    "standarddauer_minuten": {
      "key": "standarddauer_minuten",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Standarddauer in Minuten",
      "writable": true
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "meeting_link": {
      "key": "meeting_link",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Online-Meeting-Link",
      "writable": true,
      "autoComplete": "url"
    },
    "zeitzone": {
      "key": "zeitzone",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Zeitzone",
      "writable": true,
      "options": [
        "europe_berlin",
        "europe_london",
        "europe_zurich",
        "europe_vienna",
        "utc"
      ]
    },
    "antwortfrist": {
      "key": "antwortfrist",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Antwortfrist",
      "writable": true
    },
    "entscheidungsregel": {
      "key": "entscheidungsregel",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Entscheidungsregel",
      "writable": true,
      "options": [
        "organisator_entscheidet",
        "alle_pflichtteilnehmer",
        "mehrheit_entscheidet"
      ]
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "entwurf",
        "versendet",
        "in_abstimmung",
        "abgelaufen",
        "festgelegt",
        "abgesagt",
        "archiviert"
      ]
    },
    "entscheidungskommentar": {
      "key": "entscheidungskommentar",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Entscheidungskommentar",
      "writable": true
    },
    "festgelegt_am": {
      "key": "festgelegt_am",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": false,
      "label": "Festgelegt am",
      "writable": true
    },
    "abgesagt_am": {
      "key": "abgesagt_am",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": false,
      "label": "Abgesagt am",
      "writable": true
    },
    "kalender_ausgabe": {
      "key": "kalender_ausgabe",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": false,
      "label": "Kalenderausgabe nach Festlegung",
      "writable": true,
      "options": [
        "nur_ics",
        "google",
        "outlook",
        "beides"
      ]
    },
    "kalender_einladungen_senden": {
      "key": "kalender_einladungen_senden",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Einladungen direkt über den Kalender versenden",
      "writable": true
    },
    "google_kalender_id": {
      "key": "google_kalender_id",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Externe Google-Kalender-ID",
      "writable": true,
      "maxLength": 4000
    },
    "outlook_kalender_id": {
      "key": "outlook_kalender_id",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Externe Outlook-Kalender-ID",
      "writable": true,
      "maxLength": 4000
    },
    "ics_sequenz": {
      "key": "ics_sequenz",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "ICS-Sequenznummer",
      "writable": true
    }
  },
  "terminvorschlaege": {
    "terminabstimmung": {
      "key": "terminabstimmung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Terminabstimmung",
      "writable": true,
      "targetAppId": "6ae87ffb8c381148eb9f089b",
      "targetEntity": "terminabstimmungen"
    },
    "start": {
      "key": "start",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Startdatum und Startzeit",
      "writable": true
    },
    "ende": {
      "key": "ende",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Enddatum und Endzeit",
      "writable": true
    },
    "ort_abweichend": {
      "key": "ort_abweichend",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort abweichend",
      "writable": true,
      "maxLength": 4000
    },
    "meeting_link_abweichend": {
      "key": "meeting_link_abweichend",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Meeting-Link abweichend",
      "writable": true,
      "autoComplete": "url"
    },
    "reihenfolge": {
      "key": "reihenfolge",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Reihenfolge",
      "writable": true
    },
    "anzahl_ja": {
      "key": "anzahl_ja",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Anzahl Ja",
      "writable": true
    },
    "anzahl_wenn_noetig": {
      "key": "anzahl_wenn_noetig",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Anzahl Wenn nötig",
      "writable": true
    },
    "anzahl_nein": {
      "key": "anzahl_nein",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Anzahl Nein",
      "writable": true
    },
    "anzahl_ohne_antwort": {
      "key": "anzahl_ohne_antwort",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Anzahl ohne Antwort",
      "writable": true
    },
    "anzahl_pflichtteilnehmer_ja": {
      "key": "anzahl_pflichtteilnehmer_ja",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Anzahl Pflichtteilnehmer Ja",
      "writable": true
    },
    "eignung": {
      "key": "eignung",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": false,
      "label": "Eignung",
      "writable": true,
      "options": [
        "sehr_gut",
        "gut",
        "eingeschraenkt",
        "ungeeignet"
      ]
    },
    "final_gewaehlt": {
      "key": "final_gewaehlt",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Final gewählt",
      "writable": true
    }
  },
  "teilnehmer": {
    "terminabstimmung": {
      "key": "terminabstimmung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Terminabstimmung",
      "writable": true,
      "targetAppId": "6ae87ffb8c381148eb9f089b",
      "targetEntity": "terminabstimmungen"
    },
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "E-Mail-Adresse",
      "writable": true,
      "autoComplete": "email"
    },
    "organisation": {
      "key": "organisation",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Organisation",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "organization"
    },
    "rolle": {
      "key": "rolle",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Rolle",
      "writable": true,
      "options": [
        "pflichtteilnehmer",
        "optionaler_teilnehmer",
        "entscheider",
        "organisator"
      ]
    },
    "zugriffstoken": {
      "key": "zugriffstoken",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Persönlicher Zugriffstoken",
      "writable": true,
      "maxLength": 4000
    },
    "abstimmungslink": {
      "key": "abstimmungslink",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Persönlicher Abstimmungslink",
      "writable": true,
      "autoComplete": "url"
    },
    "einladungsstatus": {
      "key": "einladungsstatus",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Einladungsstatus",
      "writable": true,
      "options": [
        "nicht_versendet",
        "versendet",
        "erinnert",
        "geoeffnet",
        "geantwortet",
        "abgesagt"
      ]
    },
    "einladung_versendet_am": {
      "key": "einladung_versendet_am",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": false,
      "label": "Einladung versendet am",
      "writable": true
    },
    "erinnerung_versendet_am": {
      "key": "erinnerung_versendet_am",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": false,
      "label": "Erinnerung versendet am",
      "writable": true
    },
    "geantwortet_am": {
      "key": "geantwortet_am",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": false,
      "label": "Geantwortet am",
      "writable": true
    },
    "allgemeiner_kommentar": {
      "key": "allgemeiner_kommentar",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Allgemeiner Kommentar",
      "writable": true
    },
    "teilnahme_abgesagt": {
      "key": "teilnahme_abgesagt",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Teilnahme vollständig abgesagt",
      "writable": true
    }
  },
  "rueckmeldungen": {
    "terminabstimmung": {
      "key": "terminabstimmung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Terminabstimmung",
      "writable": true,
      "targetAppId": "6ae87ffb8c381148eb9f089b",
      "targetEntity": "terminabstimmungen"
    },
    "terminvorschlag": {
      "key": "terminvorschlag",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Terminvorschlag",
      "writable": true,
      "targetAppId": "6ae88001cd6ea6927a9488eb",
      "targetEntity": "terminvorschlaege"
    },
    "teilnehmer": {
      "key": "teilnehmer",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Teilnehmer",
      "writable": true,
      "targetAppId": "6ae88001948b1f7a5b685fad",
      "targetEntity": "teilnehmer"
    },
    "verfuegbarkeit": {
      "key": "verfuegbarkeit",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Verfügbarkeit",
      "writable": true,
      "options": [
        "ja",
        "wenn_noetig",
        "nein"
      ]
    },
    "kommentar": {
      "key": "kommentar",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Kommentar",
      "writable": true
    },
    "antwortzeitpunkt": {
      "key": "antwortzeitpunkt",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Antwortzeitpunkt",
      "writable": true
    },
    "letzte_aenderung": {
      "key": "letzte_aenderung",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Letzte Änderung",
      "writable": true
    }
  },
  "alternative_terminvorschlaege": {
    "terminabstimmung": {
      "key": "terminabstimmung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Terminabstimmung",
      "writable": true,
      "targetAppId": "6ae87ffb8c381148eb9f089b",
      "targetEntity": "terminabstimmungen"
    },
    "vorgeschlagen_von": {
      "key": "vorgeschlagen_von",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Vorgeschlagen von",
      "writable": true,
      "targetAppId": "6ae88001948b1f7a5b685fad",
      "targetEntity": "teilnehmer"
    },
    "start": {
      "key": "start",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Startdatum und Startzeit",
      "writable": true
    },
    "ende": {
      "key": "ende",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Enddatum und Endzeit",
      "writable": true
    },
    "kommentar": {
      "key": "kommentar",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Kommentar",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "neu",
        "uebernommen",
        "abgelehnt"
      ]
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "terminabstimmungen": [
    {
      "kind": "choice",
      "field": "zeitzone",
      "count": 5
    },
    {
      "kind": "choice",
      "field": "entscheidungsregel",
      "count": 3
    },
    {
      "kind": "choice",
      "field": "kalender_ausgabe",
      "count": 4
    }
  ],
  "terminvorschlaege": [
    {
      "kind": "range",
      "from": "start",
      "to": "ende"
    },
    {
      "kind": "choice",
      "field": "eignung",
      "count": 4
    },
    {
      "kind": "record",
      "field": "terminabstimmung",
      "targetEntity": "terminabstimmungen"
    }
  ],
  "teilnehmer": [
    {
      "kind": "choice",
      "field": "rolle",
      "count": 4
    },
    {
      "kind": "choice",
      "field": "einladungsstatus",
      "count": 6
    },
    {
      "kind": "record",
      "field": "terminabstimmung",
      "targetEntity": "terminabstimmungen"
    }
  ],
  "rueckmeldungen": [
    {
      "kind": "choice",
      "field": "verfuegbarkeit",
      "count": 3
    },
    {
      "kind": "record",
      "field": "terminabstimmung",
      "targetEntity": "terminabstimmungen"
    },
    {
      "kind": "record",
      "field": "terminvorschlag",
      "targetEntity": "terminvorschlaege"
    },
    {
      "kind": "record",
      "field": "teilnehmer",
      "targetEntity": "teilnehmer"
    }
  ],
  "alternative_terminvorschlaege": [
    {
      "kind": "range",
      "from": "start",
      "to": "ende"
    },
    {
      "kind": "choice",
      "field": "status",
      "count": 3
    },
    {
      "kind": "record",
      "field": "terminabstimmung",
      "targetEntity": "terminabstimmungen"
    },
    {
      "kind": "record",
      "field": "vorgeschlagen_von",
      "targetEntity": "teilnehmer"
    }
  ]
};

/** The fields a record of this entity is recognised by (a person: first and
 *  last name; else its title-like text field) — the same choice the dashboard's
 *  enrichment makes for `<key>Name`. `useRecordSearch` resolves an applookup to
 *  this name (`ctx.ref('gast')` in `toItem`). */
export const DISPLAY_FIELDS: Record<EntityKey, string[]> = {
  "terminabstimmungen": [
    "abstimmungsnummer"
  ],
  "terminvorschlaege": [
    "ort_abweichend"
  ],
  "teilnehmer": [
    "vorname",
    "nachname"
  ],
  "rueckmeldungen": [
    "kommentar"
  ],
  "alternative_terminvorschlaege": [
    "kommentar"
  ]
};

/** The display name of a record: its display fields joined, else the first
 *  non-empty text value, else ''. */
/** A display-field value as text: strings as they are, a lookup `{ key, label }`
 *  (either door hydrates lookups to objects) by its label — an entity whose
 *  only title-like field is a lookup/select otherwise had no name at all. */
function displayPart(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object' && 'label' in v) {
    const l = (v as { label?: unknown }).label;
    return l === null || l === undefined ? '' : String(l).trim();
  }
  return '';
}

export function displayNameOf(entity: EntityKey, fields: Record<string, unknown>): string {
  const parts = (DISPLAY_FIELDS[entity] ?? [])
    .map(k => displayPart(fields[k]))
    .filter(v => v !== '');
  if (parts.length > 0) return parts.join(' ');
  for (const [k, rule] of Object.entries(FIELD_RULES[entity] ?? {})) {
    if (rule.kind !== 'text' && rule.kind !== 'email') continue;
    const v = fields[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — the owner's policy label first (a
 *  public page's "Felder anpassen"), runtime bundle second, generated label last. */
export function labelOf(entity: EntityKey, key: string): string {
  const own = policyLabel(entity, key);
  if (own) return own;
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
