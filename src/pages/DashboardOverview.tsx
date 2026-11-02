import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { IconAlertTriangle, IconCalendarCheck, IconClockHour4, IconPlus, IconUsers } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import type { Terminabstimmungen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { tx, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import { KanbanWidget, type KanbanCard } from '@/components/widgets/KanbanWidget';

type Filter = 'all' | 'offen' | 'ohne';

const OPEN = ['versendet', 'in_abstimmung'];

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { terminabstimmungen, terminvorschlaege, teilnehmer } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'terminabstimmungen') return undefined;
      const st = lookupKey(top.record.fields.status);
      const target = st === 'entwurf' ? 'versendet' : OPEN.includes(st ?? '') || st === 'abgelaufen' ? 'festgelegt' : null;
      if (!target) return undefined;
      const go = flowActionFor('terminabstimmungen', 'status', top.record.record_id, target);
      if (!go) return undefined;
      return { label: target === 'versendet' ? tx('Einladung versenden') : tx('Termin festlegen'), onClick: go };
    },
  });

  const toDate = (s?: string) => {
    if (!s) return null;
    const d = parseISO(s);
    return isValid(d) ? d : null;
  };
  const fmt = (s?: string) => {
    const d = toDate(s);
    return d ? format(d, 'EEE dd.MM. HH:mm', { locale: dateFnsLocale() }) : '—';
  };

  const stats = useMemo(() => {
    const byPoll = new Map<string, { total: number; answered: number; pending: typeof teilnehmer }>();
    for (const t of teilnehmer) {
      const pid = extractRecordId(t.fields.terminabstimmung);
      if (!pid) continue;
      const e = byPoll.get(pid) ?? { total: 0, answered: 0, pending: [] };
      e.total++;
      const ist = lookupKey(t.fields.einladungsstatus);
      const done = ist === 'geantwortet' || ist === 'abgesagt' || !!t.fields.teilnahme_abgesagt || !!t.fields.geantwortet_am;
      if (done) e.answered++;
      else e.pending.push(t);
      byPoll.set(pid, e);
    }
    return byPoll;
  }, [teilnehmer]);

  const finalOf = (pid: string) =>
    terminvorschlaege.find(v => v.fields.final_gewaehlt && extractRecordId(v.fields.terminabstimmung) === pid);

  const isExpired = (a: Terminabstimmungen) => {
    const st = lookupKey(a.fields.status);
    if (st === 'abgelaufen') return true;
    const d = toDate(a.fields.antwortfrist);
    return OPEN.includes(st ?? '') && !!d && d < clock;
  };
  const isOpen = (a: Terminabstimmungen) => OPEN.includes(lookupKey(a.fields.status) ?? '') && !isExpired(a);

  const expiredOpen = terminabstimmungen.filter(isExpired);
  const openPolls = terminabstimmungen.filter(isOpen);
  const pendingParticipants = openPolls.flatMap(a => (stats.get(a.record_id)?.pending ?? []).map(t => ({ t, a })));
  const festgelegt = terminabstimmungen.filter(a => lookupKey(a.fields.status) === 'festgelegt');

  const advanceGo = (a: Terminabstimmungen) => {
    const st = lookupKey(a.fields.status);
    const target = st === 'entwurf' ? 'versendet' : 'festgelegt';
    return flowActionFor('terminabstimmungen', 'status', a.record_id, target);
  };

  const columns = (LOOKUP_OPTIONS['terminabstimmungen']?.status ?? []).map(o => ({
    key: o.key,
    label: o.label,
    tone: o.key === 'abgelaufen' ? ('warning' as const) : o.key === 'festgelegt' ? ('success' as const) : o.key === 'abgesagt' ? ('destructive' as const) : ('default' as const),
  }));

  const visible = terminabstimmungen.filter(a => {
    if (filter === 'offen') return isOpen(a);
    if (filter === 'ohne') return (stats.get(a.record_id)?.pending.length ?? 0) > 0 && OPEN.includes(lookupKey(a.fields.status) ?? '');
    return true;
  });

  const cards: KanbanCard[] = [...visible]
    .sort((a, b) => (a.fields.antwortfrist ?? '').localeCompare(b.fields.antwortfrist ?? ''))
    .map(a => {
      const st = lookupKey(a.fields.status) ?? '';
      const s = stats.get(a.record_id);
      const fin = finalOf(a.record_id);
      let sub: string;
      if (fin && st === 'festgelegt') sub = tx`Termin ${fmt(fin.fields.start)}`;
      else if (st === 'entwurf') sub = tx`${s?.total ?? 0} Teilnehmer · Frist ${fmt(a.fields.antwortfrist)}`;
      else if (st === 'abgesagt' || st === 'archiviert') sub = tx`${s?.total ?? 0} Teilnehmer`;
      else sub = tx`${s?.answered ?? 0} von ${s?.total ?? 0} geantwortet · Frist ${fmt(a.fields.antwortfrist)}`;
      return {
        id: a.record_id,
        column: st,
        title: a.fields.titel ?? a.fields.abstimmungsnummer ?? '—',
        subtitle: sub,
        tone: st === 'festgelegt' ? 'success' : 'default',
      } as KanbanCard;
    });

  // Terminvorschläge offener Abstimmungen — beste Optionen zuerst
  const topOptions = terminvorschlaege
    .filter(v => {
      const a = terminabstimmungen.find(x => x.record_id === extractRecordId(v.fields.terminabstimmung));
      return !!a && (isOpen(a) || isExpired(a)) && !v.fields.final_gewaehlt;
    })
    .sort((a, b) => (b.fields.anzahl_pflichtteilnehmer_ja ?? 0) - (a.fields.anzahl_pflichtteilnehmer_ja ?? 0) || (b.fields.anzahl_ja ?? 0) - (a.fields.anzahl_ja ?? 0));

  const heroPoll = expiredOpen[0];
  const heroGo = heroPoll ? advanceGo(heroPoll) : null;

  const nextFrist = [...openPolls].sort((a, b) => (a.fields.antwortfrist ?? '').localeCompare(b.fields.antwortfrist ?? ''))[0];
  const context = (() => {
    if (terminabstimmungen.length === 0) return tx`Lege deine erste Terminabstimmung an.`;
    if (heroPoll) return tx`Bei „${heroPoll.fields.titel ?? ''}“ ist die Frist abgelaufen — Zeit, einen Termin festzulegen.`;
    if (pendingParticipants.length > 0) return tx`Noch ausstehend: ${namen(pendingParticipants.map(p => p.t.fields.vorname ?? ''))}.`;
    if (nextFrist) return tx`Alle haben geantwortet — nächste Frist bei „${nextFrist.fields.titel ?? ''}“ am ${fmt(nextFrist.fields.antwortfrist)}.`;
    if (festgelegt.length > 0) return tx`Festgelegt: ${namen(festgelegt.map(a => a.fields.titel ?? ''))}.`;
    return tx`Aktuell läuft keine Abstimmung.`;
  })();

  const createButton = crud.terminabstimmungen.canWrite && (
    <Button onClick={() => crud.terminabstimmungen.openCreate({ status: 'entwurf', standarddauer_minuten: 60, zeitzone: 'europe_berlin' })}>
      <IconPlus size={16} className="shrink-0" />
      <span>{tx('Neue Abstimmung')}</span>
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {createButton}
      </div>

      {terminabstimmungen.length === 0 ? (
        <div className="rounded-[27px] bg-card shadow-sm p-8 flex flex-col items-center text-center gap-3 overflow-hidden">
          <IconCalendarCheck size={48} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-md">{tx('Noch keine Terminabstimmung. Lege Terminvorschläge und Teilnehmer an und finde den passenden Termin.')}</p>
          {createButton}
        </div>
      ) : (
        <DashboardGrid
          variant="wide"
          hero={heroPoll && (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: heroGo ? tx('Termin festlegen') : tx('Öffnen'),
                onClick: () => (heroGo ? heroGo() : crud.terminabstimmungen.openDetail(heroPoll)),
              }}
            >
              {expiredOpen.length === 1
                ? tx`Frist abgelaufen: „${heroPoll.fields.titel ?? ''}“ — ${stats.get(heroPoll.record_id)?.answered ?? 0} von ${stats.get(heroPoll.record_id)?.total ?? 0} haben geantwortet.`
                : tx`Frist abgelaufen: ${namen(expiredOpen.map(a => a.fields.titel ?? ''))} warten auf eine Entscheidung.`}
            </HeroBanner>
          )}
          kpis={(
            <StatStrip>
              <StatStripItem
                title={tx('Offen mit Frist')}
                value={openPolls.length}
                icon={<IconClockHour4 size={16} />}
                onClick={() => setFilter(f => (f === 'offen' ? 'all' : 'offen'))}
                active={filter === 'offen'}
              />
              <StatStripItem
                title={tx('Ohne Rückmeldung')}
                value={pendingParticipants.length}
                icon={<IconUsers size={16} />}
                tone={pendingParticipants.length > 0 ? 'warning' : 'default'}
                onClick={() => setFilter(f => (f === 'ohne' ? 'all' : 'ohne'))}
                active={filter === 'ohne'}
              />
              <StatStripItem
                title={tx('Festgelegt')}
                value={festgelegt.length}
                icon={<IconCalendarCheck size={16} />}
                tone={festgelegt.length > 0 ? 'success' : 'default'}
              />
            </StatStrip>
          )}
          primary={(
            <KanbanWidget
              cards={cards}
              columns={columns}
              defaultCollapsed={['abgesagt', 'archiviert']}
              onCardClick={c => {
                const rec = terminabstimmungen.find(a => a.record_id === c.id);
                if (rec) crud.terminabstimmungen.openDetail(rec);
              }}
              onCardMove={(id, col) => {
                const go = flowActionFor('terminabstimmungen', 'status', id, col);
                if (go) {
                  go();
                  undoToast(tx('Ablauf geöffnet'));
                  return tx('Im Ablauf bestätigen');
                }
                return tx('Statuswechsel nur über den passenden Ablauf möglich');
              }}
              onAddCard={crud.terminabstimmungen.canWrite ? (() => crud.terminabstimmungen.openCreate({ status: 'entwurf', standarddauer_minuten: 60, zeitzone: 'europe_berlin' })) : undefined}
            />
          )}
          aside={(
            <>
              <WorkList
                title={tx('Erinnerung nötig')}
                max={5}
                items={pendingParticipants.map(({ t, a }) => ({
                  id: t.record_id,
                  title: `${t.fields.vorname ?? ''} ${t.fields.nachname ?? ''}`.trim() || (t.fields.email ?? '—'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Keine Antwort')}</span>
                      <span className="text-muted-foreground"> · {a.fields.titel} · {tx('Frist')} {fmt(a.fields.antwortfrist)}</span>
                    </>
                  ),
                  action: (() => {
                    const go = flowActionFor('teilnehmer', 'einladungsstatus', t.record_id, 'erinnert');
                    return go ? { label: tx('Erinnern'), onClick: go } : undefined;
                  })(),
                }))}
                onItemClick={id => {
                  const rec = teilnehmer.find(t => t.record_id === id);
                  if (rec) crud.teilnehmer.openDetail(rec);
                }}
                empty={{ text: nextFrist ? tx`Alle haben geantwortet — nächste Frist: ${nextFrist.fields.titel ?? ''}` : tx('Keine offene Abstimmung ohne Rückmeldung.') }}
              />
              <WorkList
                title={tx('Beste Terminvorschläge')}
                max={5}
                items={topOptions.map(v => {
                  const a = terminabstimmungen.find(x => x.record_id === extractRecordId(v.fields.terminabstimmung));
                  const eig = v.fields.eignung?.label;
                  return {
                    id: v.record_id,
                    title: `${fmt(v.fields.start)} · ${a?.fields.titel ?? ''}`,
                    secondLine: (
                      <>
                        <span className="font-medium text-emerald-600">{tx`${v.fields.anzahl_ja ?? 0} Ja`}</span>
                        <span className="text-muted-foreground"> · {tx`${v.fields.anzahl_wenn_noetig ?? 0} wenn nötig`} · {tx`${v.fields.anzahl_nein ?? 0} Nein`}{eig ? ` · ${eig}` : ''}</span>
                      </>
                    ),
                    action: (() => {
                      if (!a) return undefined;
                      const go = flowActionFor('terminabstimmungen', 'status', a.record_id, 'festgelegt');
                      return go ? { label: tx('Festlegen'), onClick: go } : undefined;
                    })(),
                  };
                })}
                onItemClick={id => {
                  const rec = terminvorschlaege.find(v => v.record_id === id);
                  if (rec) crud.terminvorschlaege.openDetail(rec);
                }}
                empty={{ text: tx('Noch keine Terminvorschläge in laufenden Abstimmungen.') }}
              />
            </>
          )}
        />
      )}
      {crud.surfaces}
    </div>
  );
}
