// Auto-generated. Per-entity form-enhancements config for "Rückmeldungen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["terminabstimmung", "terminvorschlag", "teilnehmer", "verfuegbarkeit", {"row": ["antwortzeitpunkt", "letzte_aenderung"], "cols": "1fr 1fr"}, "kommentar"],
  defaults: {
    'antwortzeitpunkt': { kind: 'today', withTime: true },
    'letzte_aenderung': { kind: 'today', withTime: true },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
