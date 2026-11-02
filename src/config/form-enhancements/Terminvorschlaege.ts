// Auto-generated. Per-entity form-enhancements config for "Terminvorschläge".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["terminabstimmung", {"row": ["start", "ende"]}, {"row": ["reihenfolge", "eignung"], "cols": "1fr 2fr"}, "final_gewaehlt", {"row": ["anzahl_ja", "anzahl_wenn_noetig"], "cols": "1fr 1fr"}, {"row": ["anzahl_nein", "anzahl_ohne_antwort"], "cols": "1fr 1fr"}, "anzahl_pflichtteilnehmer_ja", "ort_abweichend", "meeting_link_abweichend"],
  defaults: {
    'start': { kind: 'today', withTime: true },
    'reihenfolge': { kind: 'literal', value: 1 },
    'anzahl_ja': { kind: 'literal', value: 0 },
    'anzahl_wenn_noetig': { kind: 'literal', value: 0 },
    'anzahl_nein': { kind: 'literal', value: 0 },
    'anzahl_ohne_antwort': { kind: 'literal', value: 0 },
    'anzahl_pflichtteilnehmer_ja': { kind: 'literal', value: 0 },
    'final_gewaehlt': { kind: 'literal', value: false },
  },
  computed: {
    '_terminvorschlag_dauer_stunden': { kind: 'dateDiff', from: 'start', to: 'ende', unit: 'hours' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
