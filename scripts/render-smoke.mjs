#!/usr/bin/env node
// Gate: render-smoke — the finished public page, executed once.
//
// tsc proves types, the check-* gates prove source patterns, the surface
// ingest proves the declaration. None of them ever LOOKS at the page. Three
// live pages passed all of that and broke for every visitor: a landing page
// threw React #31, a wizard showed a heading and no fields on step 2, a form
// rendered every label twice. This script is the fourth check: every page in
// _public/surface.json is rendered in jsdom with React, fed the data a
// visitor would get (a synthetic public-pages.json built from the surface
// and app_metadata.json, records from .smoke/records.json or generated from
// the field types), then walked step by step with example input:
//
//   * a render error (thrown, or logged by React)            → ERROR
//   * the page reports "unavailable" against its own config → ERROR
//   * a step with heading but no control, card or summary   → ERROR
//   * "Weiter" leaves the step where it is, without a message → ERROR
//   * the summary blocks because a required field was never asked → ERROR
//   * a step the example input cannot get past (custom rule)  → WARN, stop
//
// Nothing is written anywhere: fetch is mocked, create answers 201 with a
// fake id, so the run walks THROUGH the summary to the success page.
// Exit 1 on any ERROR (the page job then repairs or fails); exit 0 with a
// WARN when jsdom cannot be installed — a build never fails on infrastructure.
//
// Options: --page <slug> (repeatable), --keep (leave bundles in .smoke/),
//          --json <file> (machine-readable report).
// Env:     RENDER_SMOKE_ALIASES = JSON {importPath: absoluteFile} — extra
//          module aliases (the local test harness stubs @/components/ui/*).

import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const SURFACE = '_public/surface.json';
const PAGES_DIR = 'src/pages/public';
const SMOKE_DIR = '.smoke';
const RECORDS_FILE = join(SMOKE_DIR, 'records.json');
const PUBLIC_API_BASE = 'http://smoke.invalid/public-api';
const GRANT_ID = 'smoke-grant';
const MAX_STEPS = 12;
const SETTLE_MS = 6000;
const CONFIRM_MS = 10000;

const argv = process.argv.slice(2);
const onlySlugs = [];
// `--staged <file>`: an INTERNAL flow page a lane wrote to .intents-staging/
// (or any src/pages/intents/*.tsx) — bundled from that path, mounted like
// the app does under #/intents/<slug>, walked against a mocked /rest door.
// Five live flows dead-ended on step 1 (24.09.2026) while every gate was
// green: nothing had ever rendered an internal page before the deploy.
const stagedFiles = [];
let keep = false;
let jsonOut = null;
let prepareOnly = false;   // `--prepare`: fetch jsdom once, before the lanes start, then exit
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--page' && argv[i + 1]) onlySlugs.push(argv[++i]);
  else if (argv[i] === '--staged' && argv[i + 1]) stagedFiles.push(argv[++i]);
  else if (argv[i] === '--keep') keep = true;
  else if (argv[i] === '--prepare') prepareOnly = true;
  else if (argv[i] === '--json' && argv[i + 1]) jsonOut = argv[++i];
}

const errors = [];
const warnings = [];
const report = [];

function readJson(rel) {
  try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return null; }
}

// ── 1. What to smoke ──────────────────────────────────────────────────────────
function kebab(name) {
  return name.replace(/Page$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
// A staged flow page: the slug lives in the lane's manifest, not in the file
// name; without a manifest entry the component name is close enough for a URL.
function stagedPage(file) {
  const rel = file.replace(/\\/g, '/').replace(/^\.\//, '');
  const component = rel.split('/').pop().replace(/\.tsx$/, '');
  const manifest = readJson('.intents-staging/manifest.json');
  const entry = ((manifest && manifest.flows) || []).find(f => f && (f.file === rel || String(f.file || '').endsWith('/' + component + '.tsx') || f.component === component));
  return { slug: (entry && entry.slug) || kebab(component), component, file: rel, internal: true };
}
let pages;
if (stagedFiles.length > 0) {
  pages = stagedFiles.map(stagedPage);
} else {
  const surface = readJson(SURFACE);
  const allPages = (surface && Array.isArray(surface.pages)) ? surface.pages : [];
  pages = allPages
    .filter(p => p && p.slug && p.component && (onlySlugs.length === 0 || onlySlugs.includes(p.slug)))
    .map(p => ({ ...p, file: `${PAGES_DIR}/${p.component}.tsx`, internal: false }));
}
if (pages.length === 0 && !prepareOnly) {
  console.log('render-smoke: OK (no public pages declared)');
  process.exit(0);
}
const appMeta = readJson('app_metadata.json');
const apps = (appMeta && appMeta.apps) || {};

// ── 2. Dependencies: esbuild ships with vite; jsdom is fetched on demand ──────
// jsdom is NOT in the template. It is installed into its own tiny tree under
// .smoke/deps (36 packages, seconds) — never into the app's node_modules: an
// `npm install --no-save` there makes npm reconcile the whole template tree
// against the lockfile, minutes in a cold sandbox, and it may prune packages
// the app needs.
const DEPS_DIR = join(ROOT, SMOKE_DIR, 'deps');
const appRequire = createRequire(join(ROOT, 'package.json'));

async function loadDep(name) {
  for (const base of [join(ROOT, 'package.json'), join(DEPS_DIR, 'package.json')]) {
    try {
      const req = base === join(ROOT, 'package.json') ? appRequire : createRequire(base);
      return await import(req.resolve(name));
    } catch { /* try the next tree */ }
  }
  return null;
}

const tStart = Date.now();
const secs = (from) => ((Date.now() - from) / 1000).toFixed(1);

let esbuild = await loadDep('esbuild');
if (!esbuild) {
  console.log('WARN: render-smoke: esbuild not resolvable from node_modules — smoke skipped');
  process.exit(0);
}
let jsdomMod = await loadDep('jsdom');
if (!jsdomMod) {
  // One installer per tree: six lanes reach check-staging within seconds of
  // each other, and six concurrent `npm install` into the same directory
  // corrupt it. mkdir is the atomic lock; the others wait for the winner.
  const tInstall = Date.now();
  const lockDir = join(ROOT, SMOKE_DIR, 'deps.installing');
  mkdirSync(join(ROOT, SMOKE_DIR), { recursive: true });
  let owner = false;
  try { mkdirSync(lockDir); owner = true; } catch { owner = false; }
  if (owner) {
    try {
      mkdirSync(DEPS_DIR, { recursive: true });
      if (!existsSync(join(DEPS_DIR, 'package.json'))) {
        writeFileSync(join(DEPS_DIR, 'package.json'), JSON.stringify({ name: 'render-smoke-deps', private: true, version: '0.0.0' }));
      }
      execSync('npm install --no-audit --no-fund --no-package-lock --loglevel=error jsdom@26', {
        cwd: DEPS_DIR, stdio: ['ignore', 'inherit', 'inherit'], timeout: 180000,
      });
      jsdomMod = await loadDep('jsdom');
      console.log(`render-smoke: jsdom installed into ${SMOKE_DIR}/deps in ${secs(tInstall)}s`);
    } catch (e) {
      console.log(`WARN: render-smoke: jsdom install failed after ${secs(tInstall)}s (${String(e && e.message || e).split('\n')[0]}) — smoke skipped`);
    } finally {
      try { rmSync(lockDir, { recursive: true, force: true }); } catch { /* fine */ }
    }
  } else {
    for (let waited = 0; waited < 180000 && existsSync(lockDir); waited += 1000) await new Promise(r => setTimeout(r, 1000));
    jsdomMod = await loadDep('jsdom');
    if (jsdomMod) console.log(`render-smoke: jsdom installed by a parallel run (waited ${secs(tInstall)}s)`);
  }
} else {
  console.log('render-smoke: jsdom present');
}
if (!jsdomMod) {
  console.log('WARN: render-smoke: jsdom not available — smoke skipped');
  process.exit(0);
}
if (prepareOnly) {
  console.log(`render-smoke: prepared (esbuild + jsdom ready, ${secs(tStart)}s)`);
  process.exit(0);
}
const { JSDOM } = jsdomMod;

// ── 3. Synthetic visitor data ─────────────────────────────────────────────────
function hex24(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h.toString(16).padStart(8, '0') + 'a1b2c3d4e5f60718293a4b5c').slice(0, 24);
}

function control(entity, key) {
  const c = apps[entity] && apps[entity].controls && apps[entity].controls[key];
  return c || null;
}

function appIdOf(entity) {
  return (apps[entity] && apps[entity].app_id) || `app-${entity}`;
}

function targetAppId(c) {
  const url = c && (c.lookup_app || c.lookupapp || c.target_app);
  if (typeof url !== 'string') return undefined;
  const m = /\/apps\/([a-f0-9]{24})/i.exec(url);
  return m ? m[1] : url;
}

function fieldConfig(entity, key) {
  const c = control(entity, key);
  const options = c && c.lookup_data && typeof c.lookup_data === 'object'
    ? Object.entries(c.lookup_data).map(([k, l]) => ({ key: k, label: String(l) }))
    : undefined;
  const tgt = targetAppId(c);
  const target_entity = tgt ? Object.keys(apps).find(e => apps[e].app_id === tgt) : undefined;
  return {
    key,
    label: (c && c.label) || key,
    fulltype: (c && c.fulltype) || 'string/text',
    required: Boolean(c && c.required && c.required !== 'None' && c.required !== 'False'),
    ...(options ? { options } : {}),
    ...(c && String(c.fulltype || '').startsWith('multiple') ? { multiple: true } : {}),
    ...(tgt ? { target_app_id: tgt } : {}),
    ...(target_entity ? { target_entity } : {}),
  };
}

function pageConfig(page) {
  const endpoints = (page.endpoints || []).map(ep => ({
    op: ep.op,
    entity: ep.entity,
    app_id: appIdOf(ep.entity),
    fields: (ep.fields || []).map(k => fieldConfig(ep.entity, k)),
    ...(ep.scope ? { scope: ep.scope } : {}),
    ...(ep.scope_description ? { scope_description: ep.scope_description } : {}),
    ...(ep.max_records ? { max_records: ep.max_records } : {}),
    ...(ep.preset_fields ? { preset_fields: ep.preset_fields } : {}),
    ...(ep.default_fields ? { default_fields: ep.default_fields } : {}),
  }));
  const primary = endpoints.find(e => e.op === 'create') || endpoints[0] || { entity: 'page', app_id: 'app-page', fields: [] };
  const lp = page.link_param && typeof page.link_param === 'object' ? page.link_param : null;
  return {
    type: 'custom',
    entity: primary.entity,
    app_id: primary.app_id,
    grant_id: GRANT_ID,
    challenge: 'none',
    title: page.title || page.slug,
    description: page.description || '',
    thank_you_title: '',
    thank_you_message: '',
    fields: primary.fields,
    endpoints,
    link_param: lp ? {
      name: lp.name || 'id',
      entity: lp.entity,
      app_id: appIdOf(lp.entity),
      label_field: lp.label_field || '',
      secondary_field: lp.secondary_field || null,
    } : null,
  };
}

const today = new Date();
function isoDate(offsetDays) {
  const d = new Date(today.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function fakeValue(entity, key, i, recordsByEntity) {
  const c = control(entity, key) || {};
  const ft = String(c.fulltype || 'string/text');
  const label = c.label || key;
  if (ft.startsWith('multipleapplookup')) {
    const t = targetAppId(c);
    return t ? [`${PUBLIC_API_BASE}/grants/${GRANT_ID}/apps/${t}/records/${hex24(t + ':' + (i % 3))}`] : [];
  }
  if (ft.startsWith('applookup')) {
    const t = targetAppId(c);
    return t ? `${PUBLIC_API_BASE}/grants/${GRANT_ID}/apps/${t}/records/${hex24(t + ':' + (i % 3))}` : null;
  }
  if (ft.startsWith('multiplelookup')) {
    const keys = Object.keys(c.lookup_data || {});
    return keys.length ? [keys[i % keys.length]] : [];
  }
  if (ft.startsWith('lookup')) {
    const keys = Object.keys(c.lookup_data || {});
    return keys.length ? keys[i % keys.length] : null;
  }
  if (ft.startsWith('bool')) return i % 2 === 0;
  if (ft.startsWith('int') || ft.startsWith('number')) return 10 * (i + 1);
  if (ft.startsWith('date/datetime')) return `${isoDate(i + 1)}T${String(9 + i).padStart(2, '0')}:00:00`;
  if (ft.startsWith('date')) return isoDate(i + 1);
  if (ft === 'string/email') return `smoke${i + 1}@example.invalid`;
  if (ft === 'string/tel') return `0951 00000${i + 1}`;
  if (ft === 'string/url') return `https://example.invalid/${i + 1}`;
  if (ft.startsWith('file') || ft.startsWith('geo') || ft.startsWith('signature')) return null;
  return `${label} ${i + 1}`;
}

function syntheticRecords(entity, n) {
  const controls = (apps[entity] && apps[entity].controls) || {};
  const keys = Object.keys(controls);
  const out = {};
  for (let i = 0; i < n; i++) {
    const id = hex24(entity + ':' + i);
    const fields = {};
    for (const k of keys) fields[k] = fakeValue(entity, k, i);
    out[id] = { id, fields, created_at: `${isoDate(-i - 1)}T08:00:00`, updated_at: null };
  }
  return out;
}

const providedRecords = readJson(RECORDS_FILE) || {};
// The owner's field policy per slug (page_job writes it from the page state):
// the walk then sees the page as the visitor does — hidden fields gone,
// fixed values as presets — and a step the policy emptied must be skipped.
const POLICY_FILE = join(SMOKE_DIR, 'policy.json');
const providedPolicy = readJson(POLICY_FILE) || {};

function applyPolicy(cfgPage, policy) {
  if (!policy || typeof policy !== 'object') return cfgPage;
  const fieldRules = policy.fields || {};
  const listRules = policy.lists || {};
  for (const ep of cfgPage.endpoints || []) {
    const rules = fieldRules[ep.entity] || {};
    if (ep.op === 'create') {
      const preset = { ...(ep.preset_fields || {}) };
      ep.fields = (ep.fields || []).filter(f => {
        const r = rules[f.key] || {};
        if (r.fixed !== undefined && r.fixed !== null) preset[f.key] = r.fixed;
        return !r.hidden && (r.fixed === undefined || r.fixed === null);
      }).map(f => {
        const r = rules[f.key] || {};
        return { ...f, ...(r.required !== undefined && r.required !== null ? { required: Boolean(r.required) } : {}), ...(r.label ? { label: r.label } : {}) };
      });
      for (const [k, r] of Object.entries(rules)) if (r.fixed !== undefined && r.fixed !== null) preset[k] = r.fixed;
      if (Object.keys(preset).length) ep.preset_fields = preset;
    } else {
      const lr = listRules[ep.entity] || {};
      const hidden = new Set(lr.hidden || []);
      if (hidden.size) ep.fields = (ep.fields || []).filter(f => !hidden.has(f.key));
      // The owner's filter and size run in the grant; the mock applies them
      // to the records it serves (projectList), so the page sees the same list.
      if (lr.filter && (lr.filter.field || (lr.filter.conditions || []).length)) ep.owner_filter = lr.filter;
      if (lr.max_records) ep.max_records = Math.min(Number(lr.max_records), Number(ep.max_records || 500));
    }
  }
  const primary = (cfgPage.endpoints || []).find(e => e.op === 'create');
  if (primary) cfgPage.fields = primary.fields;
  if (Object.keys(fieldRules).length) cfgPage.policy = { fields: fieldRules };
  for (const k of ['title', 'description', 'thank_you_title', 'thank_you_message']) {
    if (policy.texts && policy.texts[k]) cfgPage[k] = policy.texts[k];
  }
  return cfgPage;
}
const recordsCache = new Map();
function recordsFor(entity) {
  if (recordsCache.has(entity)) return recordsCache.get(entity);
  let map;
  const provided = providedRecords[entity];
  if (Array.isArray(provided) && provided.length > 0) {
    map = {};
    for (const r of provided) {
      const id = String((r && (r.id || r.record_id)) || hex24(entity + ':' + Object.keys(map).length));
      map[id] = { id, fields: (r && r.fields) || {}, created_at: (r && r.created_at) || `${isoDate(-1)}T08:00:00`, updated_at: null };
    }
  } else {
    map = syntheticRecords(entity, 3);
  }
  recordsCache.set(entity, map);
  return map;
}

// The real grant answers a list with the endpoint's projection only — a
// column the owner hid (or the page never declared) is simply absent. The
// mock does the same, so a page that filters on a hidden column runs here
// exactly as it does for the visitor (live: FeWo counted "verfügbar" from a
// status the list no longer carried).
function projectList(cfg, entity, map) {
  const page = Object.values(cfg.pages || {})[0] || {};
  const ep = (page.endpoints || []).find(e => e.op !== 'create' && e.entity === entity);
  if (!ep || !Array.isArray(ep.fields) || ep.fields.length === 0) return map;
  const keep = new Set(ep.fields.map(f => f.key));
  const flt = ep.owner_filter;
  const norm = (x) => (x && typeof x === 'object' && 'key' in x) ? String(x.key) : (typeof x === 'boolean' ? String(x) : String(x ?? ''));
  const same = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
  const dateOf = (v) => {
    if (v && typeof v === 'object' && v.rel) { const d = new Date(); d.setDate(d.getDate() + Number(v.days || 0)); return v.rel === 'today' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 16); }
    return String(v ?? '');
  };
  const holds = (c, all) => {
    const v = all[c.field];
    const empty = v === undefined || v === null || v === '';
    switch (c.op) {
      case 'empty': return empty;
      case 'not_empty': return !empty;
      case 'eq': return same(v, c.value);
      case 'ne': return !same(v, c.value);
      case 'in': return (Array.isArray(c.value) ? c.value : [c.value]).some(x => same(v, x));
      case 'not_in': return !(Array.isArray(c.value) ? c.value : [c.value]).some(x => same(v, x));
      default: {
        if (empty) return false;
        const isDate = c.value && typeof c.value === 'object' || /^\d{4}-\d{2}-\d{2}/.test(String(c.value));
        const a = isDate ? String(v) : Number(v), b = isDate ? dateOf(c.value) : Number(c.value);
        if (c.op === 'gt') return a > b; if (c.op === 'gte') return a >= b; if (c.op === 'lt') return a < b; return a <= b;
      }
    }
  };
  const out = {};
  let n = 0;
  for (const [id, rec] of Object.entries(map)) {
    const all = rec.fields || {};
    if (flt) {
      const conds = Array.isArray(flt.conditions) ? flt.conditions : (flt.field ? [flt] : []);
      const results = conds.map(c => holds(c, all));
      const ok = flt.mode === 'any' ? results.some(Boolean) : results.every(Boolean);
      if (conds.length && !ok) continue;
    }
    if (ep.max_records && n >= Number(ep.max_records)) break;
    const fields = {};
    for (const [k, v] of Object.entries(all)) if (keep.has(k)) fields[k] = v;
    out[id] = { ...rec, fields };
    n++;
  }
  return out;
}

function entityByAppId(appId) {
  return Object.keys(apps).find(e => apps[e].app_id === appId) || null;
}

// ── 4. The mocked network ─────────────────────────────────────────────────────
function makeFetch(cfg, log) {
  let inflight = 0;
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
  const impl = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const method = String((init && init.method) || 'GET').toUpperCase();
    inflight++;
    try {
      await new Promise(r => setTimeout(r, 5));
      log.requests.push(`${method} ${url}`);
      if (/public-pages\.json(\?|$)/.test(url)) return json(cfg);
      if (/\/locales\/[\w-]+\.json(\?|$)/.test(url)) return new Response('{}', { status: 404 });
      if (/\/version\.json(\?|$)/.test(url)) return json({ version: 'smoke' });
      if (/_challenge(\?|$)/.test(url)) {
        // challenge: 'none' in the config means this is never asked for; if a
        // page asks anyway, answer with a trivially solvable pair.
        return json({ salt: 's', challenge: 'e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919683', maxnumber: 1, token: 'smoke', expires_at: new Date(Date.now() + 60000).toISOString() });
      }
      let m = /\/grants\/[^/]+\/apps\/([^/?]+)\/records\/([^/?]+)/.exec(url);
      if (m && method === 'GET') {
        const entity = entityByAppId(m[1]);
        const rec = entity ? recordsFor(entity)[m[2]] : null;
        return rec ? json(rec) : json({ detail: 'not found' }, 404);
      }
      m = /\/grants\/[^/]+\/apps\/([^/?]+)\/records(\?|$)/.exec(url);
      if (m && method === 'GET') {
        const entity = entityByAppId(m[1]);
        return json(entity ? projectList(cfg, entity, recordsFor(entity)) : {});
      }
      if (m && method === 'POST') {
        let fields = {};
        try { fields = JSON.parse(init && init.body || '{}').fields || {}; } catch { /* body not JSON */ }
        const id = hex24('created:' + log.created.length);
        log.created.push({ app_id: m[1], fields });
        return json({ id, fields, created_at: new Date().toISOString().slice(0, 19), updated_at: null }, 201);
      }
      // The internal door (livingAppsService via servicePort): the same
      // synthetic records, the app's REST shapes — a list is a map keyed by
      // id, one record carries `id`, aggregate_records answers [[n]].
      m = /\/rest(?:\/v1)?\/apps\/([^/?]+)\/aggregate_records/.exec(url);
      if (m) {
        const entity = entityByAppId(m[1]);
        return json([[entity ? Object.keys(recordsFor(entity)).length : 0]]);
      }
      m = /\/rest(?:\/v1)?\/apps\/([^/?]+)\/records\/([^/?]+)(\?|$)/.exec(url);
      if (m && method === 'GET') {
        const entity = entityByAppId(m[1]);
        const rec = entity ? recordsFor(entity)[m[2]] : null;
        return rec ? json(rec) : json({ detail: 'not found' }, 404);
      }
      if (m && method === 'PATCH') {
        const entity = entityByAppId(m[1]);
        const rec = entity ? recordsFor(entity)[m[2]] : null;
        if (!rec) return json({ detail: 'not found' }, 404);
        let fields = {};
        try { fields = JSON.parse(init && init.body || '{}').fields || {}; } catch { /* body not JSON */ }
        rec.fields = { ...rec.fields, ...fields };
        rec.updated_at = new Date().toISOString().slice(0, 19);
        log.updated.push({ app_id: m[1], id: m[2], fields });
        return json(rec);
      }
      if (m && method === 'DELETE') return new Response('', { status: 204 });
      m = /\/rest(?:\/v1)?\/apps\/([^/?]+)\/records(\?|$)/.exec(url);
      if (m && method === 'GET') {
        const entity = entityByAppId(m[1]);
        return json(entity ? recordsFor(entity) : {});
      }
      if (m && method === 'POST') {
        let fields = {};
        try { fields = JSON.parse(init && init.body || '{}').fields || {}; } catch { /* body not JSON */ }
        const id = hex24('created:' + log.created.length);
        const entity = entityByAppId(m[1]);
        const rec = { id, fields, created_at: new Date().toISOString().slice(0, 19), updated_at: null };
        if (entity) recordsFor(entity)[id] = rec;
        log.created.push({ app_id: m[1], fields });
        return json(rec, 201);
      }
      if (/\/rest(?:\/v1)?\/user(\?|$)/.test(url)) return json({ id: 'smoke-user', name: 'Smoke' });
      if (/sentry|\/rest\/|\/litellm\//.test(url)) return new Response('', { status: 204 });
      log.unexpected.push(`${method} ${url}`);
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    } finally {
      inflight--;
    }
  };
  impl.pending = () => inflight;
  return impl;
}

// ── 5. A browser-shaped global scope ──────────────────────────────────────────
const installedGlobals = new Set();

function installDom(slug, onJsdomError, internal = false) {
  const virtualConsole = new jsdomMod.VirtualConsole();
  virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  virtualConsole.on('jsdomError', (e) => onJsdomError(e));
  const dom = new JSDOM('<!doctype html><html lang="de"><head></head><body><div id="root"></div></body></html>', {
    url: `http://smoke.invalid/objects/smoke/#/${internal ? 'intents' : 'public'}/${slug}`,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const win = dom.window;
  const define = (k, v) => {
    try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); installedGlobals.add(k); } catch { /* read-only host global */ }
  };
  const mirror = (k) => {
    try { Object.defineProperty(globalThis, k, { get: () => win[k], configurable: true }); installedGlobals.add(k); } catch { /* keep */ }
  };
  define('window', win);
  define('document', win.document);
  define('navigator', win.navigator);
  define('self', win);
  // Every page gets a fresh window: re-point what an earlier page installed.
  for (const k of Object.getOwnPropertyNames(win)) {
    if (k in globalThis && !installedGlobals.has(k)) continue;
    const d = Object.getOwnPropertyDescriptor(win, k);
    if (d && ('value' in d || d.get)) mirror(k);
  }
  for (const k of ['localStorage', 'sessionStorage', 'location', 'history', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) mirror(k);
  // EventTarget members live on the prototype, not on the instance — Sentry
  // and friends call `globalThis.addEventListener('pagehide', …)` directly.
  for (const k of ['addEventListener', 'removeEventListener', 'dispatchEvent']) {
    if (typeof win[k] === 'function') define(k, win[k].bind(win));
  }
  // Media queries: the DatePicker asks for '(pointer: coarse)' and renders a
  // native <input type="date"> when it matches — the branch a script can fill.
  const mm = (q) => ({ matches: /pointer:\s*coarse/.test(q), media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
  win.matchMedia = mm; define('matchMedia', mm);
  class NoopObserver { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  if (!win.ResizeObserver) { win.ResizeObserver = NoopObserver; define('ResizeObserver', NoopObserver); }
  if (!win.IntersectionObserver) { win.IntersectionObserver = NoopObserver; define('IntersectionObserver', NoopObserver); }
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.print = () => {};
  win.scrollTo = () => {};
  return dom;
}

// ── 6. Bundle one page with esbuild ───────────────────────────────────────────
function aliasPlugin() {
  let extra = {};
  try { extra = JSON.parse(process.env.RENDER_SMOKE_ALIASES || '{}'); } catch { extra = {}; }
  const keys = Object.keys(extra);
  return {
    name: 'render-smoke-aliases',
    setup(build) {
      if (keys.length === 0) return;
      build.onResolve({ filter: /.*/ }, (args) => {
        if (extra[args.path]) return { path: extra[args.path] };
        return null;
      });
    },
  };
}

async function bundlePage(page) {
  mkdirSync(join(ROOT, SMOKE_DIR), { recursive: true });
  const entry = join(ROOT, SMOKE_DIR, `entry-${page.slug}.tsx`);
  const outfile = join(ROOT, SMOKE_DIR, `bundle-${page.slug}.mjs`);
  writeFileSync(entry, [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { HashRouter } from 'react-router-dom';",
    `import Page from '../${page.file.replace(/\.tsx$/, '')}';`,
    'export { React, createRoot, HashRouter, Page };',
    '',
  ].join('\n'));
  const result = await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    write: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxDev: false,
    sourcemap: 'inline',
    alias: { '@': resolve(ROOT, 'src') },
    plugins: [aliasPlugin()],
    loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.gif': 'dataurl', '.webp': 'dataurl', '.woff': 'empty', '.woff2': 'empty' },
    define: {
      'process.env.NODE_ENV': '"development"',
      'import.meta.env.DEV': 'true',
      'import.meta.env.PROD': 'false',
      'import.meta.env.MODE': '"development"',
      'import.meta.env.SSR': 'false',
      'import.meta.env.BASE_URL': '"./"',
    },
    logLevel: 'silent',
    absWorkingDir: ROOT,
  });
  return { outfile, warnings: result.warnings || [] };
}

// ── 7. The walk ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function text(el) {
  return (el && el.textContent || '').replace(/\s+/g, ' ').trim();
}

function visible(el) {
  // jsdom has no layout: "visible" means attached and not hidden by attribute.
  if (!el || !el.isConnected) return false;
  for (let n = el; n; n = n.parentElement) {
    if (n.hidden || n.getAttribute('aria-hidden') === 'true') return false;
  }
  return true;
}

async function settle(doc, fetchImpl, maxMs = SETTLE_MS) {
  const start = Date.now();
  let last = '';
  let stable = 0;
  while (Date.now() - start < maxMs) {
    await sleep(40);
    const now = doc.body.innerHTML;
    if (now === last && fetchImpl.pending() === 0) {
      stable++;
      if (stable >= 3) return;
    } else {
      stable = 0;
      last = now;
    }
  }
}

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? el.ownerDocument.defaultView.HTMLTextAreaElement.prototype
    : el.tagName === 'SELECT' ? el.ownerDocument.defaultView.HTMLSelectElement.prototype
    : el.ownerDocument.defaultView.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('change', { bubbles: true }));
}

function click(el) {
  const win = el.ownerDocument.defaultView;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    try { el.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 })); } catch { /* jsdom: PointerEvent missing */ }
  }
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function currentStep(doc) {
  // The shell writes the step into the URL (`?step=n`, absent on step 1);
  // that is the page's own numbering. The indicator's position is only a
  // fallback — a skipped step (enabledIf, emptied by the owner's policy) is
  // not rendered there, so positions and step numbers drift apart.
  const m = /[?&]step=(\d+)/.exec(doc.defaultView.location.hash);
  if (m) return Number(m[1]);
  const cur = doc.querySelector('[aria-current="step"]');
  if (cur) {
    const li = cur.closest('li');
    if (li && li.parentElement) return Array.from(li.parentElement.children).indexOf(li) + 1;
  }
  return 1;
}

function stepRegion(doc) {
  return doc.querySelector('[role="region"]') || doc.getElementById('root');
}

const CONTROL_SELECTOR = [
  '[data-field]', 'input:not([type="hidden"])', 'textarea', 'select',
  '[role="radio"]', '[role="option"]', '[role="checkbox"]', '[role="combobox"]',
  'button[aria-pressed]', '[data-key]', '[data-journey-range]',
  '[data-journey-summary]', '[data-journey-success]', '[data-journey-file]',
].join(', ');

function hasControls(region) {
  return Array.from(region.querySelectorAll(CONTROL_SELECTOR)).some(visible);
}

// A step that SHOWS something instead of asking („Vorschlag ansehen“, the
// decision's preparation before the verdict) has no control — and is not
// empty: below its heading it renders values of a record the door served.
// A hint sentence alone („Bitte unten fortfahren.“) still is an empty step.
// Live 20.10.2026 two lanes failed here and added a meaningless
// data-key/data-field to a div just to pass; a gate that punishes a
// legitimate step trains the agents to game it.
function readContent(region) {
  const clone = region.cloneNode(true);
  for (const el of clone.querySelectorAll('[data-journey-step-heading], button, nav, [role="alert"]')) el.remove();
  return text(clone);
}
function showsRecord(region) {
  const content = readContent(region);
  if (!content) return false;
  for (const map of recordsCache.values()) {
    for (const rec of Object.values(map)) {
      for (const v of Object.values(rec.fields || {})) {
        const s = v && typeof v === 'object' && 'label' in v ? v.label : v;
        if (typeof s !== 'string' || s.trim().length < 4 || /^https?:|^\d{4}-\d{2}-\d{2}/.test(s)) continue;
        if (content.includes(s.trim().slice(0, 20))) return true;
      }
    }
  }
  return false;
}

function fillStep(region, doc) {
  const actions = [];
  // Cards / pills (EntitySelectStep, ChoiceGroup): pick the first one when nothing is picked.
  for (const group of region.querySelectorAll('[role="radiogroup"], [role="group"]')) {
    const options = Array.from(group.querySelectorAll('[role="radio"], [role="checkbox"]')).filter(visible);
    if (options.length === 0) continue;
    if (options.some(o => o.getAttribute('aria-checked') === 'true')) continue;
    click(options[0]); actions.push(`pick ${text(options[0]).slice(0, 30) || 'option'}`);
  }
  const cards = Array.from(region.querySelectorAll('button[aria-pressed]')).filter(v => visible(v) && !v.hasAttribute('data-day'));
  if (cards.length > 0 && !cards.some(c => c.getAttribute('aria-pressed') === 'true')) {
    click(cards[0]); actions.push(`card ${text(cards[0]).slice(0, 30)}`);
  }
  // Availability range: two free days ahead.
  for (const range of region.querySelectorAll('[data-journey-range]')) {
    const days = Array.from(range.querySelectorAll('button[data-day]')).filter(b => !b.disabled && visible(b));
    const pressed = days.filter(b => b.getAttribute('aria-pressed') === 'true');
    if (pressed.length >= 2 || days.length < 2) continue;
    const todayIso = isoDate(0);
    const future = days.filter(b => b.getAttribute('data-day') > todayIso);
    const pick = future.length >= 2 ? future : days;
    click(pick[0]); actions.push(`range from ${pick[0].getAttribute('data-day')}`);
    if (pick[1]) { click(pick[1]); actions.push(`range to ${pick[1].getAttribute('data-day')}`); }
  }
  // Combobox pickers: open, take the first option.
  for (const box of region.querySelectorAll('input[role="combobox"]')) {
    if (!visible(box) || box.value) continue;
    box.focus(); click(box);
    setNativeValue(box, 'a');
    actions.push('combobox open');
  }
  // A file field (FileField): choose a small PDF once — it travels as a data URL.
  for (const el of region.querySelectorAll('input[type="file"]')) {
    if (el.disabled || !el.parentElement || !el.parentElement.querySelector('[data-journey-file]')) continue;
    const win = el.ownerDocument.defaultView;
    const file = new win.File(['%PDF-1.4\n%%EOF\n'], 'smoke.pdf', { type: 'application/pdf' });
    Object.defineProperty(el, 'files', { value: [file], configurable: true });
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
    actions.push('file smoke.pdf');
  }
  // Plain controls.
  for (const el of region.querySelectorAll('input:not([type="hidden"]), textarea, select')) {
    if (!visible(el) || el.disabled || el.readOnly) continue;
    if (el.getAttribute('role') === 'combobox') continue;
    const type = (el.getAttribute('type') || (el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' ? 'select' : 'text')).toLowerCase();
    if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button') continue;
    // A picker's search box narrows the cards — typing there hides them.
    if (type === 'search' || el.getAttribute('role') === 'searchbox' || el.getAttribute('aria-controls')) continue;
    if (el.value !== '' && el.value !== null) continue;
    let value;
    switch (type) {
      case 'email': value = 'smoke@example.invalid'; break;
      case 'tel': value = '0951 123456'; break;
      case 'url': value = 'https://example.invalid'; break;
      case 'number': {
        const min = parseFloat(el.getAttribute('min') || '');
        value = Number.isFinite(min) && min > 1 ? String(min) : '1';
        break;
      }
      case 'date': value = isoDate(7); break;
      case 'datetime-local': value = `${isoDate(7)}T10:30`; break;
      case 'time': value = '10:30'; break;
      case 'select': {
        const opt = Array.from(el.options).find(o => o.value !== '' && !o.disabled);
        value = opt ? opt.value : null;
        break;
      }
      case 'textarea': value = 'Smoke-Test'; break;
      default: {
        const mode = (el.getAttribute('inputmode') || '').toLowerCase();
        if (mode === 'numeric' || mode === 'decimal') value = '1';
        else if (mode === 'email') value = 'smoke@example.invalid';
        else if (mode === 'tel') value = '0951 123456';
        else value = 'Smoke-Test';
      }
    }
    if (value === null) continue;
    setNativeValue(el, value);
    actions.push(`${type} ${el.getAttribute('name') || el.id || ''}=${value}`);
  }
  return actions;
}

function alertsIn(doc) {
  return Array.from(doc.querySelectorAll('[role="alert"], [data-journey-error-summary]')).filter(visible).map(text).filter(Boolean);
}

async function smokePage(page) {
  const file = page.file;
  const pageReport = { slug: page.slug, file, internal: Boolean(page.internal), steps: [], result: 'unknown', errors: [], warnings: [], requests: [] };
  const fail = (msg) => { pageReport.errors.push(msg); errors.push(`${file}: render-smoke '${page.slug}': ${msg}`); };
  const warn = (msg) => { pageReport.warnings.push(msg); warnings.push(`${file}: render-smoke '${page.slug}': ${msg}`); };

  if (!existsSync(join(ROOT, file))) {
    fail(page.internal ? `${file} does not exist` : `declared in ${SURFACE} but ${file} does not exist`);
    pageReport.result = 'missing';
    return pageReport;
  }

  let bundle;
  try {
    bundle = await bundlePage(page);
  } catch (e) {
    const msg = (e && e.errors && e.errors.length)
      ? e.errors.map(x => `${x.location ? `${x.location.file}:${x.location.line}: ` : ''}${x.text}`).join('; ')
      : String(e && e.message || e);
    fail(`does not bundle: ${msg.slice(0, 600)}`);
    pageReport.result = 'bundle-error';
    return pageReport;
  }

  // A public page gets its synthetic grant config; an internal page talks to
  // the app's own door and needs none.
  const cfg = page.internal
    ? { version: 1, public_api_base: PUBLIC_API_BASE, pages: {}, unpublished_count: 0 }
    : { version: 1, public_api_base: PUBLIC_API_BASE, pages: { [page.slug]: applyPolicy(pageConfig(page), providedPolicy[page.slug]) }, unpublished_count: 0 };
  if (!page.internal && providedPolicy[page.slug]) pageReport.policy = providedPolicy[page.slug];
  const log = { requests: [], created: [], updated: [], unexpected: [] };

  const runtimeErrors = [];
  const consoleNoise = [];
  const origConsoleError = console.error;
  // React logs a thrown component error before a boundary catches it; a key
  // or act() warning is dev noise. Only error signatures count.
  const looksLikeError = (line) => /(TypeError|ReferenceError|RangeError|SyntaxError|Uncaught|Minified React error|Objects are not valid as a React child|The above error occurred|error boundary|Maximum update depth|Rendered (more|fewer) hooks)/i.test(line);
  console.error = (...args) => {
    const line = args.map(a => (a && a.stack) || (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ');
    const short = line.split('\n').slice(0, 3).join(' ').slice(0, 500);
    if (looksLikeError(line)) runtimeErrors.push(short); else consoleNoise.push(short);
  };
  const onWindowError = (ev) => { runtimeErrors.push(String(ev && (ev.error && ev.error.stack || ev.message) || ev).slice(0, 500)); };
  const dom = installDom(page.slug, (e) => { runtimeErrors.push(`uncaught: ${String(e && (e.detail && e.detail.stack || e.message) || e).slice(0, 400)}`); }, page.internal);
  const doc = dom.window.document;
  const fetchImpl = makeFetch(cfg, log);
  dom.window.fetch = fetchImpl;
  Object.defineProperty(globalThis, 'fetch', { value: fetchImpl, configurable: true, writable: true });
  dom.window.addEventListener('error', onWindowError);
  const onRejection = (reason) => { runtimeErrors.push(`unhandled rejection: ${String(reason && reason.stack || reason).slice(0, 400)}`); };
  process.on('unhandledRejection', onRejection);

  let root = null;
  try {
    const mod = await import(pathToFileURL(bundle.outfile).href + `?t=${Date.now()}`);
    const { React, createRoot, HashRouter, Page } = mod;
    let boundaryError = null;
    class Boundary extends React.Component {
      constructor(props) { super(props); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error }; }
      componentDidCatch(error) { boundaryError = error; }
      render() { return this.state.error ? React.createElement('div', { 'data-smoke-crash': '' }, String(this.state.error && this.state.error.message || this.state.error)) : this.props.children; }
    }
    root = createRoot(doc.getElementById('root'));
    root.render(React.createElement(Boundary, null, React.createElement(HashRouter, null, React.createElement(Page, null))));
    await settle(doc, fetchImpl);

    // Loading may legitimately take a moment (config, then records).
    for (let i = 0; i < 5 && doc.querySelector('[data-public-loading]'); i++) await settle(doc, fetchImpl, 2000);

    const crashed = () => boundaryError || doc.querySelector('[data-smoke-crash]');
    if (crashed()) {
      fail(`crashes while rendering: ${String((boundaryError && boundaryError.message) || text(doc.querySelector('[data-smoke-crash]'))).slice(0, 300)}`);
      pageReport.result = 'crash';
      return pageReport;
    }
    // An internal wizard opens with its start screen ("So funktioniert's" +
    // "Los geht's"); the visitor presses the button, so does the smoke.
    const start = doc.querySelector('[data-journey-intro] [data-journey-start]');
    if (start && visible(start)) {
      click(start);
      await settle(doc, fetchImpl);
      pageReport.steps.push({ step: 'intro', text: 'start pressed' });
      if (crashed()) {
        fail(`crashes after the start screen: ${String((boundaryError && boundaryError.message) || text(doc.querySelector('[data-smoke-crash]'))).slice(0, 300)}`);
        pageReport.result = 'crash';
        return pageReport;
      }
    }
    if (!page.internal && doc.querySelector('[data-public-unavailable]')) {
      fail(`reports "not available" against its own declaration — the page loads a slug or endpoint the surface does not declare (requests: ${log.requests.filter(r => !/sentry/.test(r)).slice(0, 4).join(' | ')})`);
      pageReport.result = 'unavailable';
      return pageReport;
    }
    if (doc.querySelector('[data-public-loading]')) {
      fail('never leaves the loading state (config or records request left unanswered)');
      pageReport.result = 'stuck-loading';
      return pageReport;
    }

    const isWizard = Boolean(doc.querySelector('[aria-current="step"], [data-journey-next], [data-journey-summary]'));
    if (!isWizard) {
      // A landing page or a one-screen form: rendered without a crash, with
      // content — that is the whole test for it.
      const body = text(doc.getElementById('root'));
      if (body.length < 20) fail(`renders almost nothing (${JSON.stringify(body)})`);
      pageReport.result = pageReport.errors.length ? 'empty' : 'rendered';
      pageReport.steps.push({ step: 0, label: 'page', text: body.slice(0, 300) });
      return pageReport;
    }

    let lastStep = -1;
    let stuckRounds = 0;
    // The boundary replaces the whole tree, so the step indicator is gone
    // once a step crashed: remember which step "Weiter" was heading for.
    let enteringStep = 1;
    for (let round = 0; round < MAX_STEPS; round++) {
      if (crashed()) {
        fail(`crashes on step ${enteringStep}: ${String((boundaryError && boundaryError.message) || text(doc.querySelector('[data-smoke-crash]'))).slice(0, 300)}`);
        pageReport.result = 'crash';
        return pageReport;
      }
      if (doc.querySelector('[data-journey-success]')) {
        pageReport.result = 'success';
        pageReport.steps.push({ step: 'success', text: text(doc.querySelector('[data-journey-success]')).slice(0, 300) });
        return pageReport;
      }
      const summary = doc.querySelector('[data-journey-summary]');
      if (summary) {
        const confirm = summary.querySelector('[data-journey-confirm]');
        pageReport.steps.push({ step: 'summary', text: text(summary).slice(0, 400) });
        if (!confirm) { fail('summary without a confirm button'); pageReport.result = 'summary-no-confirm'; return pageReport; }
        if (confirm.disabled) {
          const missing = Array.from(summary.querySelectorAll('button, a')).filter(b => b !== confirm && visible(b)).map(text).filter(t => t && !/ändern|change|zurück|back/i.test(t));
          fail(`summary blocks the confirm — required fields no step asked for: ${missing.slice(0, 6).join(', ') || text(summary).slice(0, 200)}`);
          pageReport.result = 'summary-blocked';
          return pageReport;
        }
        enteringStep = 'success';
        click(confirm);
        await settle(doc, fetchImpl, CONFIRM_MS);
        if (doc.querySelector('[data-journey-success]')) continue;
        const problems = alertsIn(doc);
        if (problems.length) { fail(`confirm failed: ${problems.join(' / ').slice(0, 300)}`); pageReport.result = 'confirm-failed'; return pageReport; }
        if (crashed()) continue;
        fail('confirm does not reach the success page (no error shown, no success rendered)');
        pageReport.result = 'confirm-silent';
        return pageReport;
      }

      const step = currentStep(doc);
      const region = stepRegion(doc);
      const label = region.getAttribute('aria-label') || `step ${step}`;
      const stepText = text(region);
      const reading = !hasControls(region) && showsRecord(region);
      if (!hasControls(region) && !reading) {
        fail(`step ${step} "${label}" shows a heading and nothing else — no control, card, summary or content (a step that only SHOWS the picked record passes when it renders that record) — visible: ${JSON.stringify(stepText.slice(0, 200))}`);
        pageReport.result = 'empty-step';
        return pageReport;
      }
      const actions = reading ? ['read'] : fillStep(region, doc);
      await settle(doc, fetchImpl, 2500);
      // A combobox opened above: take its first option now that it rendered.
      const option = Array.from(doc.querySelectorAll('[role="option"]')).find(visible);
      if (option) { click(option); actions.push(`option ${text(option).slice(0, 30)}`); await settle(doc, fetchImpl, 1500); }
      pageReport.steps.push({ step, label, actions, text: stepText.slice(0, 300) });

      // A single pick on a step without StepNav moves on by itself (the layer
      // owns that step change): the example input already left the step.
      if (currentStep(doc) !== step || doc.querySelector('[data-journey-summary], [data-journey-success]')) {
        lastStep = step; stuckRounds = 0; enteringStep = currentStep(doc);
        continue;
      }

      const next = Array.from(doc.querySelectorAll('[data-journey-next]')).find(visible);
      if (!next) {
        warn(`step ${step} "${label}" has no StepNav "Weiter" and no pick that moves on — the smoke cannot walk further`);
        pageReport.result = 'no-next';
        return pageReport;
      }
      if (next.disabled) {
        // A disabled next is a validation gate the example input did not satisfy.
        warn(`step ${step} "${label}": "Weiter" stays disabled after example input (${actions.join(', ') || 'nothing to fill'})`);
        pageReport.result = 'blocked';
        return pageReport;
      }
      const before = doc.body.innerHTML;
      enteringStep = step + 1;
      click(next);
      await settle(doc, fetchImpl);
      if (crashed()) continue;
      const after = currentStep(doc);
      enteringStep = after;
      const progressed = after !== step || doc.querySelector('[data-journey-summary], [data-journey-success]');
      if (progressed) { lastStep = step; stuckRounds = 0; continue; }
      const problems = alertsIn(doc);
      if (problems.length === 0 && doc.body.innerHTML === before) {
        fail(`"Weiter" on step ${step} "${label}" leads nowhere: the step stays, no message appears`);
        pageReport.result = 'next-dead';
        return pageReport;
      }
      if (problems.length === 0) {
        // Something changed but no step change and no message: give it one more round.
        stuckRounds++;
        if (stuckRounds >= 2) { fail(`"Weiter" on step ${step} "${label}" leads nowhere: the step stays, no message appears`); pageReport.result = 'next-dead'; return pageReport; }
        continue;
      }
      // Blocked with a reason: the page told the visitor what is missing — fill once more, then stop.
      stuckRounds++;
      if (stuckRounds >= 2 || lastStep === step) {
        warn(`step ${step} "${label}" blocks the example input: ${problems.join(' / ').slice(0, 200)}`);
        pageReport.result = 'blocked';
        return pageReport;
      }
      lastStep = step;
    }
    fail(`did not reach the success page within ${MAX_STEPS} rounds (last step ${currentStep(doc)})`);
    pageReport.result = 'no-end';
    return pageReport;
  } catch (e) {
    fail(`crashes: ${String(e && e.stack || e).split('\n').slice(0, 4).join(' ').slice(0, 500)}`);
    pageReport.result = 'crash';
    return pageReport;
  } finally {
    if (runtimeErrors.length && pageReport.result !== 'crash') {
      fail(`logs a runtime error: ${runtimeErrors[0].slice(0, 300)}`);
    }
    if (consoleNoise.length) pageReport.console = consoleNoise.slice(0, 10);
    pageReport.requests = log.requests.filter(r => !/sentry/.test(r)).slice(0, 20);
    pageReport.created = log.created;
    pageReport.updated = log.updated;
    if (log.unexpected.length) pageReport.warnings.push(`unexpected requests: ${log.unexpected.slice(0, 5).join(' | ')}`);
    try { if (root) root.unmount(); } catch { /* already gone */ }
    console.error = origConsoleError;
    process.off('unhandledRejection', onRejection);
    try { dom.window.close(); } catch { /* fine */ }
  }
}

// ── 8. Run ────────────────────────────────────────────────────────────────────
for (const page of pages) {
  const tPage = Date.now();
  const r = await smokePage(page);
  r.seconds = Number(secs(tPage));
  report.push(r);
  const stepsWalked = r.steps.filter(s => typeof s.step === 'number').length;
  if (r.errors.length === 0) {
    console.log(`render-smoke: ${page.slug} ${r.result === 'success' ? `OK (${stepsWalked} steps, summary confirmed, success page reached)` : r.result === 'rendered' ? 'OK (renders)' : `${r.result} (${r.warnings[0] || 'see report'})`} in ${r.seconds}s`);
  } else {
    console.log(`render-smoke: ${page.slug} FAILED (${r.result}) after ${r.seconds}s`);
  }
}

if (jsonOut) {
  try { writeFileSync(jsonOut, JSON.stringify(report, null, 2)); } catch { /* optional */ }
}
if (!keep) {
  // Bundles and entries go; .smoke/deps (jsdom) and .smoke/records.json stay
  // for a second pass in the same sandbox (repair round). The deploy removes
  // the whole directory.
  for (const page of pages) {
    for (const f of [`entry-${page.slug}.tsx`, `bundle-${page.slug}.mjs`]) {
      try { rmSync(join(ROOT, SMOKE_DIR, f), { force: true }); } catch { /* fine */ }
    }
  }
}

for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log(`render-smoke: OK (${pages.length} page${pages.length === 1 ? '' : 's'}, ${secs(tStart)}s)`);
