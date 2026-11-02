// Auto-generated. Per-entity form-enhancements config for "Teilnehmer".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["terminabstimmung", {"row": ["vorname", "nachname"]}, "email", "organisation", "rolle", "einladungsstatus", "zugriffstoken", "abstimmungslink", {"row": ["einladung_versendet_am", "erinnerung_versendet_am"], "cols": "1fr 1fr"}, "geantwortet_am", "teilnahme_abgesagt", "allgemeiner_kommentar"],
  defaults: {
    'einladungsstatus': { kind: 'lookup', key: 'nicht_versendet', label: 'Nicht versendet' },
    'rolle': { kind: 'lookup', key: 'pflichtteilnehmer', label: 'Pflichtteilnehmer' },
    'teilnahme_abgesagt': { kind: 'literal', value: false },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
