/**
 * TerminabstimmungenDialog — pre-generated create/edit dialog for Terminabstimmungen.
 *
 * Props: open, onClose, onSubmit(fields) => Promise<void>, defaultValues?,
 * recordId? (pass when EDITING — enables the attachments section),
 * enablePhotoScan?, enablePhotoLocation?.
 *
 * defaultValues is SHAPE-TOLERANT and its prop type is the EXPORTED
 * TerminabstimmungenDialogDefaults — NOT the entity field type: lookup fields accept
 * the bare KEY string (or LookupValue), applookup fields the bare record id
 * (or record URL); the dialog normalizes. Type prefill STATE with the export:
 *  ❌ useState<Partial<Terminabstimmungen['fields']>>({ … })   // LookupValue fields reject string prefills (TS2322)
 *  ✓ useState<TerminabstimmungenDialogDefaults | undefined>(undefined)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Terminabstimmungen, LookupValue } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Terminabstimmungen';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { requiredMessage } from '@/lib/journey/messages';
import { t, appLabel, fieldLabel, lookupLabel, localeTag, CURRENCY } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

/** Widened prefill type for TerminabstimmungenDialog.defaultValues — see file header. */
export type TerminabstimmungenDialogDefaults = Omit<Terminabstimmungen['fields'], 'zeitzone' | 'entscheidungsregel' | 'status' | 'kalender_ausgabe'> & {
    zeitzone?: LookupValue | string;
    entscheidungsregel?: LookupValue | string;
    status?: LookupValue | string;
    kalender_ausgabe?: LookupValue | string;
  };

interface TerminabstimmungenDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Terminabstimmungen['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: TerminabstimmungenDialogDefaults;
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

// defaultValues are SHAPE-TOLERANT: the dialog resolves bare lookup keys via
// its own options and bare record ids via the field's target app — consumers
// never carry the LookupValue/record-URL shape in their head.
const NORMALIZE_LOOKUPS: Record<string, readonly { key: string; label: string }[]> = {
  zeitzone: LOOKUP_OPTIONS['terminabstimmungen']?.['zeitzone'] ?? [],
  entscheidungsregel: LOOKUP_OPTIONS['terminabstimmungen']?.['entscheidungsregel'] ?? [],
  status: LOOKUP_OPTIONS['terminabstimmungen']?.['status'] ?? [],
  kalender_ausgabe: LOOKUP_OPTIONS['terminabstimmungen']?.['kalender_ausgabe'] ?? [],
};
function normalizeDefaults(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [k, opts] of Object.entries(NORMALIZE_LOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = opts.find(o => o.key === v) ?? { key: v, label: v };
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' ? opts.find(o => o.key === x) ?? { key: x, label: x } : x));
  }
  return out;
}

export function TerminabstimmungenDialog({ open, onClose, onSubmit, defaultValues, recordId, enablePhotoScan = true, enablePhotoLocation = true }: TerminabstimmungenDialogProps) {
  const [fields, setFields] = useState<Partial<Terminabstimmungen['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = useMemo<Record<string, unknown> | undefined>(
    () => (defaultValues ? normalizeDefaults(defaultValues as Record<string, unknown>) : undefined),
    [defaultValues],
  );
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  // Fields the plan assigns to a tool (empty without a plan).
  const SYSTEM_ASSIGNED: string[] = ["abstimmungsnummer"];
  const [showErrors, setShowErrors] = useState(false);
  const REQUIRED_FIELDS = ['titel', 'organisator_vorname', 'organisator_nachname', 'organisator_email', 'standarddauer_minuten', 'zeitzone', 'antwortfrist', 'entscheidungsregel', 'status'] as const;
  const missingRequired = REQUIRED_FIELDS.filter(k => {
    const v = (fields as Record<string, unknown>)[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
    },
  }), []);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Terminabstimmungen['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'terminabstimmungen');
      await onSubmit(clean as Terminabstimmungen['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : t('submit_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "abstimmungsnummer": string | null, // Abstimmungsnummer\n  "titel": string | null, // Titel\n  "beschreibung": string | null, // Beschreibung / Agenda\n  "organisator_vorname": string | null, // Organisator Vorname\n  "organisator_nachname": string | null, // Organisator Nachname\n  "organisator_email": string | null, // Organisator E-Mail-Adresse\n  "standarddauer_minuten": number | null, // Standarddauer in Minuten\n  "ort": string | null, // Ort\n  "meeting_link": string | null, // Online-Meeting-Link\n  "zeitzone": LookupValue | null, // Zeitzone (select one key: "europe_berlin" | "europe_london" | "europe_zurich" | "europe_vienna" | "utc") mapping: europe_berlin=Europe/Berlin, europe_london=Europe/London, europe_zurich=Europe/Zurich, europe_vienna=Europe/Vienna, utc=UTC\n  "antwortfrist": string | null, // YYYY-MM-DDTHH:MM\n  "entscheidungsregel": LookupValue | null, // Entscheidungsregel (select one key: "organisator_entscheidet" | "alle_pflichtteilnehmer" | "mehrheit_entscheidet") mapping: organisator_entscheidet=Organisator entscheidet, alle_pflichtteilnehmer=Alle Pflichtteilnehmer müssen verfügbar sein, mehrheit_entscheidet=Mehrheit entscheidet\n  "status": LookupValue | null, // Status (select one key: "entwurf" | "versendet" | "in_abstimmung" | "abgelaufen" | "festgelegt" | "abgesagt" | "archiviert") mapping: entwurf=Entwurf, versendet=Versendet, in_abstimmung=In Abstimmung, abgelaufen=Abgelaufen, festgelegt=Festgelegt, abgesagt=Abgesagt, archiviert=Archiviert\n  "entscheidungskommentar": string | null, // Entscheidungskommentar\n  "festgelegt_am": string | null, // YYYY-MM-DDTHH:MM\n  "abgesagt_am": string | null, // YYYY-MM-DDTHH:MM\n  "kalender_ausgabe": LookupValue | null, // Kalenderausgabe nach Festlegung (select one key: "nur_ics" | "google" | "outlook" | "beides") mapping: nur_ics=Nur .ics-Datei, google=Google Calendar, outlook=Outlook / Microsoft 365, beides=Beides (Google und Outlook)\n  "kalender_einladungen_senden": boolean | null, // Einladungen direkt über den Kalender versenden\n  "google_kalender_id": string | null, // Externe Google-Kalender-ID\n  "outlook_kalender_id": string | null, // Externe Outlook-Kalender-ID\n  "ics_sequenz": number | null, // ICS-Sequenznummer\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        for (const [k, v] of Object.entries(raw)) {
          if (v != null) merged[k] = v;
        }
        return merged as Partial<Terminabstimmungen['fields']>;
      });
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error(`${t('scan_error')}:`, err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues
    ? t('edit_entity', { entity: appLabel('terminabstimmungen') })
    : t('new_entity', { entity: appLabel('terminabstimmungen') });

  const fieldBlocks: Record<string, React.ReactNode> = {
    'abstimmungsnummer': (
      <div key="abstimmungsnummer" className="space-y-1.5">
        <Label htmlFor="abstimmungsnummer">{fieldLabel('terminabstimmungen', 'abstimmungsnummer')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="abstimmungsnummer"
          placeholder="z. B. TA-2026-001"
          value={fields.abstimmungsnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, abstimmungsnummer: e.target.value }))}
          required
        />
        {showErrors && !fields.abstimmungsnummer && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'abstimmungsnummer')}</p>
        )}
      </div>
    ),
    'titel': (
      <div key="titel" className="space-y-1.5">
        <Label htmlFor="titel">{fieldLabel('terminabstimmungen', 'titel')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="titel"
          placeholder="z. B. Projekt-Kickoff"
          value={fields.titel ?? ''}
          onChange={e => setFields(f => ({ ...f, titel: e.target.value }))}
          required
        />
        {showErrors && !fields.titel && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'titel')}</p>
        )}
      </div>
    ),
    'beschreibung': (
      <div key="beschreibung" className="space-y-1.5">
        <Label htmlFor="beschreibung">{fieldLabel('terminabstimmungen', 'beschreibung')}</Label>
        <Textarea
          id="beschreibung"
          placeholder="Agenda und Hinweise zum Termin"
          value={fields.beschreibung ?? ''}
          onChange={e => setFields(f => ({ ...f, beschreibung: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'organisator_vorname': (
      <div key="organisator_vorname" className="space-y-1.5">
        <Label htmlFor="organisator_vorname">{fieldLabel('terminabstimmungen', 'organisator_vorname')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="organisator_vorname"
          placeholder="z. B. Anna"
          value={fields.organisator_vorname ?? ''}
          onChange={e => setFields(f => ({ ...f, organisator_vorname: e.target.value }))}
          required
        />
        {showErrors && !fields.organisator_vorname && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'organisator_vorname')}</p>
        )}
      </div>
    ),
    'organisator_nachname': (
      <div key="organisator_nachname" className="space-y-1.5">
        <Label htmlFor="organisator_nachname">{fieldLabel('terminabstimmungen', 'organisator_nachname')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="organisator_nachname"
          placeholder="z. B. Müller"
          value={fields.organisator_nachname ?? ''}
          onChange={e => setFields(f => ({ ...f, organisator_nachname: e.target.value }))}
          required
        />
        {showErrors && !fields.organisator_nachname && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'organisator_nachname')}</p>
        )}
      </div>
    ),
    'organisator_email': (
      <div key="organisator_email" className="space-y-1.5">
        <Label htmlFor="organisator_email">{fieldLabel('terminabstimmungen', 'organisator_email')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="organisator_email"
          type="email"
          inputMode="email"
          placeholder="z. B. anna.mueller@firma.de"
          value={fields.organisator_email ?? ''}
          onChange={e => setFields(f => ({ ...f, organisator_email: e.target.value }))}
          required
        />
        {showErrors && !fields.organisator_email && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'organisator_email')}</p>
        )}
      </div>
    ),
    'standarddauer_minuten': (
      <div key="standarddauer_minuten" className="space-y-1.5">
        <Label htmlFor="standarddauer_minuten">{fieldLabel('terminabstimmungen', 'standarddauer_minuten')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="standarddauer_minuten"
          type="number"
          inputMode="decimal"
          step="any"
          {...numberInputProps(formEnhancements, 'standarddauer_minuten')}
          placeholder="z. B. 60"
          value={fields.standarddauer_minuten !== undefined ? fields.standarddauer_minuten : (computedValues['standarddauer_minuten'] ?? '')}
          onChange={e => setFields(f => ({ ...f, standarddauer_minuten: clampNumberValue(formEnhancements, 'standarddauer_minuten', e.target.value) }))}
        />
        {showErrors && !fields.standarddauer_minuten && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'standarddauer_minuten')}</p>
        )}
      </div>
    ),
    'ort': (
      <div key="ort" className="space-y-1.5">
        <Label htmlFor="ort">{fieldLabel('terminabstimmungen', 'ort')}</Label>
        <Input
          id="ort"
          placeholder="z. B. Besprechungsraum 2"
          value={fields.ort ?? ''}
          onChange={e => setFields(f => ({ ...f, ort: e.target.value }))}
        />
      </div>
    ),
    'meeting_link': (
      <div key="meeting_link" className="space-y-1.5">
        <Label htmlFor="meeting_link">{fieldLabel('terminabstimmungen', 'meeting_link')}</Label>
        <Input
          id="meeting_link"
          type="url"
          inputMode="url"
          placeholder="z. B. https://meet.example.com/abc"
          value={fields.meeting_link ?? ''}
          onChange={e => setFields(f => ({ ...f, meeting_link: e.target.value }))}
        />
      </div>
    ),
    'zeitzone': (
      <div key="zeitzone" className="space-y-1.5">
        <Label htmlFor="zeitzone">{fieldLabel('terminabstimmungen', 'zeitzone')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zeitzone) === 'europe_berlin'}
            onClick={() => setFields(f => ({ ...f, zeitzone: (lookupKey(f.zeitzone) === 'europe_berlin' ? undefined : 'europe_berlin') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zeitzone) === 'europe_berlin'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'zeitzone', 'europe_berlin') ?? 'Europe/Berlin'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zeitzone) === 'europe_london'}
            onClick={() => setFields(f => ({ ...f, zeitzone: (lookupKey(f.zeitzone) === 'europe_london' ? undefined : 'europe_london') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zeitzone) === 'europe_london'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'zeitzone', 'europe_london') ?? 'Europe/London'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zeitzone) === 'europe_zurich'}
            onClick={() => setFields(f => ({ ...f, zeitzone: (lookupKey(f.zeitzone) === 'europe_zurich' ? undefined : 'europe_zurich') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zeitzone) === 'europe_zurich'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'zeitzone', 'europe_zurich') ?? 'Europe/Zurich'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zeitzone) === 'europe_vienna'}
            onClick={() => setFields(f => ({ ...f, zeitzone: (lookupKey(f.zeitzone) === 'europe_vienna' ? undefined : 'europe_vienna') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zeitzone) === 'europe_vienna'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'zeitzone', 'europe_vienna') ?? 'Europe/Vienna'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zeitzone) === 'utc'}
            onClick={() => setFields(f => ({ ...f, zeitzone: (lookupKey(f.zeitzone) === 'utc' ? undefined : 'utc') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zeitzone) === 'utc'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'zeitzone', 'utc') ?? 'UTC'}
          </button>
        </div>
        {showErrors && !fields.zeitzone && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'zeitzone')}</p>
        )}
      </div>
    ),
    'antwortfrist': (
      <div key="antwortfrist" className="space-y-1.5">
        <Label htmlFor="antwortfrist">{fieldLabel('terminabstimmungen', 'antwortfrist')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <DatePicker
          id="antwortfrist"
          placeholder="Bis wann antworten?"
          mode="datetime"
          value={fields.antwortfrist ?? null}
          onChange={v => setFields(f => ({ ...f, antwortfrist: v ?? undefined }))}
          required
        />
        {showErrors && !fields.antwortfrist && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'antwortfrist')}</p>
        )}
      </div>
    ),
    'entscheidungsregel': (
      <div key="entscheidungsregel" className="space-y-1.5">
        <Label htmlFor="entscheidungsregel">{fieldLabel('terminabstimmungen', 'entscheidungsregel')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.entscheidungsregel) === 'organisator_entscheidet'}
            onClick={() => setFields(f => ({ ...f, entscheidungsregel: (lookupKey(f.entscheidungsregel) === 'organisator_entscheidet' ? undefined : 'organisator_entscheidet') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.entscheidungsregel) === 'organisator_entscheidet'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'entscheidungsregel', 'organisator_entscheidet') ?? 'Organisator entscheidet'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.entscheidungsregel) === 'alle_pflichtteilnehmer'}
            onClick={() => setFields(f => ({ ...f, entscheidungsregel: (lookupKey(f.entscheidungsregel) === 'alle_pflichtteilnehmer' ? undefined : 'alle_pflichtteilnehmer') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.entscheidungsregel) === 'alle_pflichtteilnehmer'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'entscheidungsregel', 'alle_pflichtteilnehmer') ?? 'Alle Pflichtteilnehmer müssen verfügbar sein'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.entscheidungsregel) === 'mehrheit_entscheidet'}
            onClick={() => setFields(f => ({ ...f, entscheidungsregel: (lookupKey(f.entscheidungsregel) === 'mehrheit_entscheidet' ? undefined : 'mehrheit_entscheidet') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.entscheidungsregel) === 'mehrheit_entscheidet'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'entscheidungsregel', 'mehrheit_entscheidet') ?? 'Mehrheit entscheidet'}
          </button>
        </div>
        {showErrors && !fields.entscheidungsregel && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'entscheidungsregel')}</p>
        )}
      </div>
    ),
    'status': (
      <div key="status" className="space-y-1.5">
        <Label htmlFor="status">{fieldLabel('terminabstimmungen', 'status')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Select
          value={lookupKey(fields.status) ?? ''}
          onValueChange={v => setFields(f => ({ ...f, status: v === 'none' ? undefined : v as any }))}
        >
          <SelectTrigger id="status" className="max-sm:h-11"><SelectValue placeholder="z. B. Entwurf, Versendet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="entwurf">{lookupLabel('terminabstimmungen', 'status', 'entwurf') ?? 'Entwurf'}</SelectItem>
            <SelectItem value="versendet">{lookupLabel('terminabstimmungen', 'status', 'versendet') ?? 'Versendet'}</SelectItem>
            <SelectItem value="in_abstimmung">{lookupLabel('terminabstimmungen', 'status', 'in_abstimmung') ?? 'In Abstimmung'}</SelectItem>
            <SelectItem value="abgelaufen">{lookupLabel('terminabstimmungen', 'status', 'abgelaufen') ?? 'Abgelaufen'}</SelectItem>
            <SelectItem value="festgelegt">{lookupLabel('terminabstimmungen', 'status', 'festgelegt') ?? 'Festgelegt'}</SelectItem>
            <SelectItem value="abgesagt">{lookupLabel('terminabstimmungen', 'status', 'abgesagt') ?? 'Abgesagt'}</SelectItem>
            <SelectItem value="archiviert">{lookupLabel('terminabstimmungen', 'status', 'archiviert') ?? 'Archiviert'}</SelectItem>
          </SelectContent>
        </Select>
        {showErrors && !fields.status && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('terminabstimmungen', 'status')}</p>
        )}
      </div>
    ),
    'entscheidungskommentar': (
      <div key="entscheidungskommentar" className="space-y-1.5">
        <Label htmlFor="entscheidungskommentar">{fieldLabel('terminabstimmungen', 'entscheidungskommentar')}</Label>
        <Textarea
          id="entscheidungskommentar"
          placeholder="Begründung der Entscheidung"
          value={fields.entscheidungskommentar ?? ''}
          onChange={e => setFields(f => ({ ...f, entscheidungskommentar: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'festgelegt_am': (
      <div key="festgelegt_am" className="space-y-1.5">
        <Label htmlFor="festgelegt_am">{fieldLabel('terminabstimmungen', 'festgelegt_am')}</Label>
        <DatePicker
          id="festgelegt_am"
          placeholder="Wann wurde festgelegt?"
          mode="datetime"
          value={fields.festgelegt_am ?? null}
          onChange={v => setFields(f => ({ ...f, festgelegt_am: v ?? undefined }))}
        />
      </div>
    ),
    'abgesagt_am': (
      <div key="abgesagt_am" className="space-y-1.5">
        <Label htmlFor="abgesagt_am">{fieldLabel('terminabstimmungen', 'abgesagt_am')}</Label>
        <DatePicker
          id="abgesagt_am"
          placeholder="Wann wurde abgesagt?"
          mode="datetime"
          value={fields.abgesagt_am ?? null}
          onChange={v => setFields(f => ({ ...f, abgesagt_am: v ?? undefined }))}
        />
      </div>
    ),
    'kalender_ausgabe': (
      <div key="kalender_ausgabe" className="space-y-1.5">
        <Label htmlFor="kalender_ausgabe">{fieldLabel('terminabstimmungen', 'kalender_ausgabe')}</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.kalender_ausgabe) === 'nur_ics'}
            onClick={() => setFields(f => ({ ...f, kalender_ausgabe: (lookupKey(f.kalender_ausgabe) === 'nur_ics' ? undefined : 'nur_ics') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.kalender_ausgabe) === 'nur_ics'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'kalender_ausgabe', 'nur_ics') ?? 'Nur .ics-Datei'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.kalender_ausgabe) === 'google'}
            onClick={() => setFields(f => ({ ...f, kalender_ausgabe: (lookupKey(f.kalender_ausgabe) === 'google' ? undefined : 'google') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.kalender_ausgabe) === 'google'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'kalender_ausgabe', 'google') ?? 'Google Calendar'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.kalender_ausgabe) === 'outlook'}
            onClick={() => setFields(f => ({ ...f, kalender_ausgabe: (lookupKey(f.kalender_ausgabe) === 'outlook' ? undefined : 'outlook') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.kalender_ausgabe) === 'outlook'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'kalender_ausgabe', 'outlook') ?? 'Outlook / Microsoft 365'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.kalender_ausgabe) === 'beides'}
            onClick={() => setFields(f => ({ ...f, kalender_ausgabe: (lookupKey(f.kalender_ausgabe) === 'beides' ? undefined : 'beides') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.kalender_ausgabe) === 'beides'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('terminabstimmungen', 'kalender_ausgabe', 'beides') ?? 'Beides (Google und Outlook)'}
          </button>
        </div>
      </div>
    ),
    'kalender_einladungen_senden': (
      <div key="kalender_einladungen_senden" className="space-y-1.5">
        <Label htmlFor="kalender_einladungen_senden">{fieldLabel('terminabstimmungen', 'kalender_einladungen_senden')}</Label>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="kalender_einladungen_senden"
            checked={!!fields.kalender_einladungen_senden}
            onCheckedChange={(v) => setFields(f => ({ ...f, kalender_einladungen_senden: !!v }))}
          />
          <Label htmlFor="kalender_einladungen_senden" className="font-normal">{fieldLabel('terminabstimmungen', 'kalender_einladungen_senden')}</Label>
        </div>
      </div>
    ),
    'google_kalender_id': (
      <div key="google_kalender_id" className="space-y-1.5">
        <Label htmlFor="google_kalender_id">{fieldLabel('terminabstimmungen', 'google_kalender_id')}</Label>
        <Input
          id="google_kalender_id"
          placeholder="z. B. abc123@group.calendar"
          value={fields.google_kalender_id ?? ''}
          onChange={e => setFields(f => ({ ...f, google_kalender_id: e.target.value }))}
        />
      </div>
    ),
    'outlook_kalender_id': (
      <div key="outlook_kalender_id" className="space-y-1.5">
        <Label htmlFor="outlook_kalender_id">{fieldLabel('terminabstimmungen', 'outlook_kalender_id')}</Label>
        <Input
          id="outlook_kalender_id"
          placeholder="z. B. AAMkAGI2..."
          value={fields.outlook_kalender_id ?? ''}
          onChange={e => setFields(f => ({ ...f, outlook_kalender_id: e.target.value }))}
        />
      </div>
    ),
    'ics_sequenz': (
      <div key="ics_sequenz" className="space-y-1.5">
        <Label htmlFor="ics_sequenz">{fieldLabel('terminabstimmungen', 'ics_sequenz')}</Label>
        <Input
          id="ics_sequenz"
          type="number"
          inputMode="decimal"
          step="any"
          {...numberInputProps(formEnhancements, 'ics_sequenz')}
          placeholder="z. B. 0"
          value={fields.ics_sequenz !== undefined ? fields.ics_sequenz : (computedValues['ics_sequenz'] ?? '')}
          onChange={e => setFields(f => ({ ...f, ics_sequenz: clampNumberValue(formEnhancements, 'ics_sequenz', e.target.value) }))}
        />
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"abstimmungsnummer": "Abstimmungsnummer", "titel": "Titel", "beschreibung": "Beschreibung / Agenda", "organisator_vorname": "Organisator Vorname", "organisator_nachname": "Organisator Nachname", "organisator_email": "Organisator E-Mail-Adresse", "standarddauer_minuten": "Standarddauer in Minuten", "ort": "Ort", "meeting_link": "Online-Meeting-Link", "zeitzone": "Zeitzone", "antwortfrist": "Antwortfrist", "entscheidungsregel": "Entscheidungsregel", "status": "Status", "entscheidungskommentar": "Entscheidungskommentar", "festgelegt_am": "Festgelegt am", "abgesagt_am": "Abgesagt am", "kalender_ausgabe": "Kalenderausgabe nach Festlegung", "kalender_einladungen_senden": "Einladungen direkt über den Kalender versenden", "google_kalender_id": "Externe Google-Kalender-ID", "outlook_kalender_id": "Externe Outlook-Kalender-ID", "ics_sequenz": "ICS-Sequenznummer"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 max-sm:[&>button]:size-10 max-sm:[&>button]:grid max-sm:[&>button]:place-items-center max-sm:[&>button]:rounded-full max-sm:[&>button]:border max-sm:[&>button]:border-input max-sm:[&>button]:bg-background max-sm:[&>button]:opacity-100 max-sm:[&>button>svg]:size-5">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-sm:py-2.5 max-sm:px-4 text-xs font-semibold transition-all mr-7 max-sm:mr-12 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">{t('smart_fill')}</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('scan_header_sub')}</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  {t('useinfo_label')}
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? t('useinfo_loading') : `(${t('useinfo_more')})`}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">{t('profile_preamble')}</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">{t('useinfo_error')}</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_analyzing')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_analyzing_sub')}</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('scan_success')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_success_sub')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_upload')}</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />{t('scan_camera_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />{t('scan_file_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />{t('scan_doc_btn')}
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder={t('scan_text_placeholder')}
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title={t('paste')}
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />{t('scan_text_analyze')}
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0 max-sm:[&_input]:h-11">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                // A field the plan gives to a TOOL. On CREATE it is not shown
                // at all — the value does not exist yet and typing one only
                // gets overwritten. On EDIT it stays a normal input with a
                // note: when a tool could not compose its value (a missing
                // ingredient), this is the only place to repair the record.
                if (SYSTEM_ASSIGNED.includes(k) && !recordId) {
                  return (
                    <div key={k} className="space-y-1.5 min-w-0">
                      <Label>{fieldLabel('terminabstimmungen', k)}</Label>
                      <p className="text-sm text-muted-foreground">{t('assigned_by_system')}</p>
                    </div>
                  );
                }
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {SYSTEM_ASSIGNED.includes(k) && (
                      <p className="text-xs text-muted-foreground">{t('assigned_by_system')}</p>
                    )}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {showErrors && missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                {t('missing_required')}
              </p>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.TERMINABSTIMMUNGEN} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2 max-sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="max-sm:h-12 max-sm:flex-1 max-sm:text-base">{t('cancel')}</Button>
            <Button
              type="submit"
              className="max-sm:h-12 max-sm:flex-1 max-sm:text-base"
              disabled={saving || !isDirty || (showErrors && missingRequired.length > 0)}
            >
              {saving ? t('saving') : defaultValues ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}