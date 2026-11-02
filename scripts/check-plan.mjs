// check-plan — the build against the orchestrator's plan (docs/orchestrator/SPEC.md §6.1).
//
// Runs in the integration band like every gate; without `.plan.json` it is a
// no-op (builds without a plan stay byte-identical). With a plan it holds
// every flow page and the public surface against the Schreibliste:
//
//   ERROR  a flow writes an entity its plan line does not list
//   ERROR  a flow binds a field another flow or a tool owns
//   ERROR  a flow asks the user for a field the plan sets automatically
//          (fixed / derived) — the layer sets it, the user never types it
//   ERROR  a public page declares an endpoint (entity, op) the plan lacks
//   WARN   a planned flow or page was not built (the report marks it failed;
//          there is no file to repair, so it is not an ERROR here)
//   WARN   a flow or page was built that the plan did not ask for
//
// ERROR lines name the page file so the repair agent and the quarantine can
// act on exactly that file.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PLAN = '.plan.json';
const SURFACE = '_public/surface.json';
const APP = 'src/App.tsx';
const INTENTS_DIR = 'src/pages/intents';
const PUBLIC_DIR = 'src/pages/public';

if (!existsSync(PLAN)) {
  console.log('check-plan: OK (no plan)');
  process.exit(0);
}

let plan;
try {
  plan = JSON.parse(readFileSync(PLAN, 'utf8'));
} catch (e) {
  console.error(`ERROR: ${PLAN}: not valid JSON — ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const ownership = plan.ownership || {};
const flows = Array.isArray(plan.flows) ? plan.flows : [];
const pages = Array.isArray(plan.public_pages) ? plan.public_pages : [];

// ── Where does a flow slug live? App.tsx: <Route path="intents/<slug>" … <Intent<Component> …
const appSrc = existsSync(APP) ? readFileSync(APP, 'utf8') : '';
function fileForSlug(slug) {
  const re = new RegExp(`<Route\\s+path=["']intents/${slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}["'][^>]*?<Intent([A-Za-z][A-Za-z0-9]*)\\b`, 's');
  const m = re.exec(appSrc);
  if (!m) return null;
  const file = `${INTENTS_DIR}/${m[1]}.tsx`;
  return existsSync(file) ? file : null;
}

// ── What a flow page binds and writes
function pageBindings(src) {
  const forms = new Map();                    // var → entity
  for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*useStepForm\(\s*['"]([\w-]+)['"]/g)) forms.set(m[1], m[2]);
  const bound = [];                           // {entity, key}
  for (const m of src.matchAll(/\b(\w+)\.(?:field|number|date|choice|checkbox|record|records)\(\s*['"](\w+)['"]/g)) {
    const entity = forms.get(m[1]);
    if (entity) bound.push({ entity, key: m[2] });
  }
  for (const m of src.matchAll(/<(?:Field|Bound)\b([^>]*?)\/?>/gs)) {
    const fm = /\bform=\{(\w+)\}/.exec(m[1]);
    const nm = /\bname=["'](\w+)["']/.exec(m[1]);
    if (fm && nm && forms.get(fm[1])) bound.push({ entity: forms.get(fm[1]), key: nm[1] });
  }
  // plan steps of useJourneySubmit: every `entity: 'x'` inside the call's array
  const written = new Set(forms.values());
  const js = /useJourneySubmit\s*\(/.exec(src);
  if (js) {
    const start = src.indexOf('[', js.index);
    if (start > 0) {
      let depth = 0, end = -1;
      for (let k = start; k < src.length && k < start + 20000; k++) {
        if (src[k] === '[') depth++;
        else if (src[k] === ']' && --depth === 0) { end = k; break; }
      }
      const body = end > 0 ? src.slice(start, end + 1) : src.slice(start);
      for (const m of body.matchAll(/\bentity:\s*['"]([\w-]+)['"]/g)) written.add(m[1]);
    }
  }
  return { bound, written };
}

const builtSlugs = new Set();
for (const m of appSrc.matchAll(/<Route\s+path=["']intents\/([\w-]+)["']/g)) builtSlugs.add(m[1]);

for (const flow of flows) {
  const file = fileForSlug(flow.slug);
  if (!file) {
    warnings.push(`plan flow '${flow.slug}' was not built (no route/page) — the report marks it failed`);
    continue;
  }
  const src = readFileSync(file, 'utf8');
  // A page on its generated flow hook: the plumbing IS the plan (the hook is
  // rendered from this very Schreibliste), so the bindings/required checks
  // below have nothing to compare. What CAN go wrong is the page importing
  // another flow's hook, or the hook file not existing — checked here; the raw
  // plumbing next to a hook is check-intents 3b's error.
  const hookImport = /from\s*['"]@\/lib\/journey\/flows\/(\w+)['"]/.exec(src);
  if (hookImport) {
    const expected = flow.slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    if (hookImport[1] !== expected) {
      errors.push(`${file}: flow '${flow.slug}' imports the hook of '${hookImport[1]}' — its own is @/lib/journey/flows/${expected} (use${expected}Flow)`);
    } else if (!existsSync(`src/lib/journey/flows/${expected}.ts`)) {
      errors.push(`${file}: flow '${flow.slug}' imports @/lib/journey/flows/${expected}, which the generator did not emit (is the flow in the plan?)`);
    }
    if (!/\buseStepForm\s*\(|useJourneySubmit\s*\(/.test(src)) continue;   // pure composition — nothing to hold against the plan
  }
  const { bound, written } = pageBindings(src);
  const planned = new Map();                  // entity → {field → source}
  for (const w of flow.writes || []) planned.set(w.entity, { ...(planned.get(w.entity) || {}), ...(w.fields || {}) });
  for (const entity of written) {
    if (!planned.has(entity)) {
      errors.push(`${file}: flow '${flow.slug}' writes entity '${entity}' — not in the plan's Schreibliste (${[...planned.keys()].join(', ') || 'nothing'}); either the plan or the page is wrong, the plan wins`);
    }
  }
  const seen = new Set();
  for (const { entity, key } of bound) {
    const id = `${entity}.${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const owner = (ownership[entity] || {})[key];
    if (owner && owner !== `intent:${flow.slug}`) {
      errors.push(`${file}: flow '${flow.slug}' binds '${id}' which ${owner.replace(':', ' ')} owns — remove the input; that write is not this flow's`);
      continue;
    }
    const source = (planned.get(entity) || {})[key];
    if (source && !/^(user|picked)$/.test(source)) {
      errors.push(`${file}: flow '${flow.slug}' asks the user for '${id}' but the plan sets it automatically (${source}) — set it in the plan step's values, do not bind it`);
    }
  }
  // An ingredient of a computed value must not be declared optional. The app's
  // base view says "optional" for such a field (nothing there knows a tool
  // will compose an identifier from it), so the page copies that and the value
  // silently never gets built — live 22.09.2026: `projektstart_jahr: false`,
  // project created with a number and no identifier.
  for (const id of flow.required || []) {
    const key = id.split('.')[1];
    const re = new RegExp(`required\\s*:\\s*\\{[^}]*\\b${key}\\s*:\\s*false`, 's');
    if (re.test(src)) {
      errors.push(`${file}: flow '${flow.slug}' declares '${id}' optional, but the plan builds a value from it — mark it required and validate it before the step advances`);
    }
  }
}
for (const slug of builtSlugs) {
  if (!flows.some(f => f.slug === slug)) warnings.push(`flow '${slug}' was built but is not in the plan`);
}

// ── Public surface against the plan
if (pages.length && existsSync(SURFACE)) {
  let surface = { pages: [] };
  try { surface = JSON.parse(readFileSync(SURFACE, 'utf8')); } catch { /* check-public reports broken JSON */ }
  const byslug = new Map((surface.pages || []).map(p => [p.slug, p]));
  for (const page of pages) {
    const sp = byslug.get(page.slug);
    if (!sp) { warnings.push(`plan public page '${page.slug}' is not in the surface — the report marks it failed`); continue; }
    const file = sp.component ? `${PUBLIC_DIR}/${sp.component}.tsx` : SURFACE;
    const allowed = new Set([...(page.lists || []).map(l => `${l.entity}:list`), ...(page.creates || []).map(c => `${c.entity}:create`)]);
    for (const ep of sp.endpoints || []) {
      const key = `${ep.entity}:${ep.op}`;
      // An availability read is Klar's own (intents_integration.add_availability_endpoints,
      // from the occupancy decision): dates, resource, status of what is taken — never
      // who. It is not a plan decision; rejecting it made the repair agent strip the
      // calendar off a booking page (Pension Gästehaus 23.10.2026).
      if (ep.op === 'list' && ep.purpose === 'availability') continue;
      if (!allowed.has(key)) {
        errors.push(`${file}: public page '${page.slug}' declares ${ep.op} on '${ep.entity}' — the plan allows only: ${[...allowed].join(', ') || 'nothing'}`);
      }
    }
    for (const c of page.creates || []) {
      const ep = (sp.endpoints || []).find(e => e.op === 'create' && e.entity === c.entity);
      if (!ep) continue;
      const have = new Set((ep.fields || []).map(f => (typeof f === 'string' ? f : f.key)));
      for (const k of have) {
        if (!(k in (c.fields || {}))) errors.push(`${file}: public page '${page.slug}' asks visitors for '${c.entity}.${k}' — not a visitor field in the plan (${Object.keys(c.fields || {}).join(', ')})`);
      }
    }
  }
  for (const sp of surface.pages || []) {
    if (!pages.some(p => p.slug === sp.slug)) warnings.push(`public page '${sp.slug}' was built but is not in the plan`);
  }
} else if (pages.length) {
  warnings.push(`plan lists ${pages.length} public page(s) but ${SURFACE} does not exist`);
}

for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log(`check-plan: OK (${flows.length} flows, ${pages.length} public pages held against the plan)`);
