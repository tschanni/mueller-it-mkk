import React, { useEffect, useRef, useState } from 'react';
import { EventPage, GameServer, Metrics, Players, request, statusText } from './api';
import { useServers } from './useServers';
import './gameserver.css';
const tabs = ['Übersicht', 'Server', 'Leistung', 'Ereignisse'];
const value = (v: unknown, unit = '') => v === null || v === undefined || v === '' ? 'Nicht verfügbar' : String(v) + unit;
const date = (v: string | null) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('de-DE') : 'Nicht verfügbar';
function Status({ server }: {
    server: GameServer;
}) { return <span><span aria-hidden="true" className={'gsm-indicator ' + (server.stale ? 'UNKNOWN' : server.status)}/>{statusText(server.status)}{server.stale ? ' (veraltet)' : ''}</span>; }
function Fields({ title, fields }: {
    title: string;
    fields: [
        string,
        React.ReactNode
    ][];
}) { return <fieldset><legend>{title}</legend><dl>{fields.map(([label, content]) => <React.Fragment key={label}><dt>{label}</dt><dd>{content}</dd></React.Fragment>)}</dl></fieldset>; }
function Graph({ title, samples, unit = '' }: {
    title: string;
    samples: {
        time: string;
        n: number | null;
    }[];
    unit?: string;
}) {
    const sorted = [...samples].filter(s => Number.isFinite(Date.parse(s.time))).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const nums = sorted.filter(s => s.n !== null && Number.isFinite(s.n));
    if (!nums.length)
        return null;
    const max = Math.max(1, ...nums.map(s => s.n!));
    const start = Date.parse(sorted[0].time);
    const span = Math.max(1, Date.parse(sorted[sorted.length - 1].time) - start);
    const points = sorted.map(s => s.n === null || !Number.isFinite(s.n) ? null : [8 + (Date.parse(s.time) - start) / span * 464, 112 - s.n / max * 100]);
    const segments: number[][][] = [[]];
    points.forEach(p => { if (p)
        segments[segments.length - 1].push(p);
    else
        segments.push([]); });
    return <fieldset><legend>{title}</legend><div className="gsm-graph"><svg viewBox="0 0 480 125" role="img" aria-label={title + ': ' + nums.length + ' Messwerte, Maximum ' + max + unit}><path d="M8 12H472 M8 37H472 M8 62H472 M8 87H472 M8 112H472 M8 12V112 M124 12V112 M240 12V112 M356 12V112 M472 12V112" stroke="#164b24" fill="none"/>{segments.filter(s => s.length).map((s, i) => <g key={i}><polyline points={s.map(p => p.join(',')).join(' ')} fill="none" stroke="#00ff40" strokeWidth="1.5"/>{s.map((p, j) => <circle key={j} cx={p[0]} cy={p[1]} r="2" fill="#00ff40"/>)}</g>)}</svg></div><div className="gsm-graph-caption"><span>{date(sorted[0].time)}</span><span>0–{max}{unit}</span><span>{date(sorted[sorted.length - 1].time)}</span></div></fieldset>;
}
export function GameserverManager() {
    const { servers, loading, error, connection, updated, revision, refresh } = useServers();
    const [tab, setTab] = useState(0);
    const [selected, setSelected] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{
        players?: Players;
        metrics?: Metrics;
        events?: EventPage;
    }>({});
    const [detailError, setDetailError] = useState('');
    const [busy, setBusy] = useState(false);
    const [copy, setCopy] = useState('');
    const [eventId, setEventId] = useState('');
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const server = servers.find(s => s.id === selected) || servers[0];
    const slug = server?.slug;
    useEffect(() => { setPage(1); setCopy(''); setEventId(''); }, [slug]);
    useEffect(() => {
        setData({});
        setDetailError('');
        if (!slug || tab === 0)
            return;
        const abort = new AbortController();
        setBusy(true);
        const kind = tab === 1 ? 'players' : tab === 2 ? 'metrics' : 'events';
        void request<Players | Metrics | EventPage>('servers/' + encodeURIComponent(slug) + '/' + kind + (kind === 'events' ? '?limit=25&page=' + page : kind === 'metrics' ? '?limit=100' : ''), abort.signal).then(result => { if (!abort.signal.aborted)
            setData({ [kind]: result }); }).catch(e => { if (!abort.signal.aborted)
            setDetailError(e.message || 'Daten nicht verfügbar.'); }).finally(() => { if (!abort.signal.aborted)
            setBusy(false); });
        return () => abort.abort();
    }, [slug, tab, page, revision]);
    const event = data.events?.items.find(e => e.id === eventId);
    const address = server ? server.connection.host + ':' + server.connection.port : '';
    return <div className="gsm">
 <div className="gsm-toolbar"><span>Öffentliche Serverüberwachung</span><button onClick={refresh}>Aktualisieren</button></div>
 <div role="tablist" aria-label="Gameserver-Ansichten" className="gsm-tabs">{tabs.map((label, i) => <button key={label} ref={el => { tabRefs.current[i] = el; }} id={'gsm-tab-' + i} role="tab" aria-selected={tab === i} aria-controls={'gsm-panel-' + i} tabIndex={tab === i ? 0 : -1} onClick={() => setTab(i)} onKeyDown={e => { let next = i; if (e.key === 'ArrowRight')
        next = (i + 1) % 4;
    else if (e.key === 'ArrowLeft')
        next = (i + 3) % 4;
    else if (e.key === 'Home')
        next = 0;
    else if (e.key === 'End')
        next = 3;
    else
        return; e.preventDefault(); setTab(next); tabRefs.current[next]?.focus(); }}>{label}</button>)}</div>
 <div role="tabpanel" id={'gsm-panel-' + tab} aria-labelledby={'gsm-tab-' + tab} className="gsm-panel">
 {loading && <p role="status">Server werden geladen…</p>}{error && <p role="alert">{error} <button onClick={refresh}>Erneut versuchen</button></p>}
 {!loading && !error && !servers.length && <p>Keine Gameserver eingerichtet.</p>}
 {tab === 0 && !!servers.length && <><div className="gsm-list"><table><thead><tr>{['Server', 'Spiel', 'Status', 'Spieler', 'Version', 'Latenz'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{servers.map(s => <tr key={s.id} aria-selected={server?.id === s.id} onClick={() => setSelected(s.id)} onDoubleClick={() => { setSelected(s.id); setTab(1); }}><td><button className="gsm-server-link" onClick={() => setSelected(s.id)} onKeyDown={e => { if (e.key === 'Enter') {
        setSelected(s.id);
        setTab(1);
    } }}>{s.name}</button></td><td>{s.gameType === 'MINECRAFT' ? 'Minecraft' : s.gameType === 'TERRARIA' ? 'Terraria' : s.gameType}</td><td><Status server={s}/></td><td>{value(s.onlinePlayers)} / {value(s.maxPlayers)}</td><td>{value(s.gameVersion)}</td><td>{value(s.latencyMs, ' ms')}</td></tr>)}</tbody></table></div>{server && <Fields title="Ausgewählter Server" fields={[['Adresse', address], ['Überwachung', server.capability === 'TCP_ONLY' ? 'Nur TCP erreichbar; Spielstatus und Spieler unbekannt.' : server.statusMessage], ['Letzte Prüfung', date(server.lastCheckedAt)]]}/>}<p>Server doppelt anklicken oder mit Enter öffnen.</p></>}
 {tab !== 0 && server && <><label className="gsm-selector">Server: <select value={server.id} onChange={e => setSelected(e.target.value)}>{servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{busy && <p role="status">Daten werden geladen…</p>}{detailError && <p role="alert">{detailError} <button onClick={refresh}>Erneut versuchen</button></p>}
 {tab === 1 && <><div className="gsm-details"><Fields title="Allgemein" fields={[['Servername', server.name], ['Spiel', server.gameType], ['Status', <Status server={server}/>], ['Version', value(server.gameVersion)], ['Letzte erfolgreiche Prüfung', date(server.lastSuccessfulCheckAt)]]}/><Fields title="Verbindung" fields={[['Hostname', server.connection.host], ['Port', server.connection.port], ['Latenz', value(server.latencyMs, ' ms')], ['Monitoring', server.capability], ['Letzte Prüfung', date(server.lastCheckedAt)]]}/><Fields title="Spieler" fields={[['Aktuell', value(server.onlinePlayers)], ['Maximum', value(server.maxPlayers)], ['Spielerliste', data.players ? data.players.available ? data.players.players.join(', ') || 'Keine Spieler gemeldet.' : 'Spielernamen nicht öffentlich verfügbar.' : 'Nicht verfügbar']]}/><Fields title="Weitere Informationen" fields={[['Statusmeldung', server.statusMessage], ['MOTD', value(server.motd)], ['Monitoring-Hinweis', server.lastError?.message || 'Keine Warnung gemeldet.']]}/></div><button onClick={async () => { try {
            await navigator.clipboard.writeText(address);
            setCopy('Adresse kopiert.');
        }
        catch {
            setCopy('Kopieren fehlgeschlagen. Adresse: ' + address);
        } }}>Adresse kopieren</button><span role="status"> {copy}</span></>}
 {tab === 2 && data.metrics && <>{!data.metrics.snapshots.length && !data.metrics.metrics.length ? <p>Für diesen Server sind noch keine Verlaufsdaten verfügbar.</p> : <><Graph title="Serverstatus (1 = Online, 0 = Offline; unbekannt = Lücke)" samples={data.metrics.snapshots.map(s => ({ time: s.recordedAt, n: s.status === 'ONLINE' ? 1 : s.status === 'OFFLINE' ? 0 : null }))}/><Graph title="Spieler" samples={data.metrics.snapshots.map(s => ({ time: s.recordedAt, n: s.onlinePlayers }))}/><Graph title="Latenz" unit=" ms" samples={data.metrics.snapshots.map(s => ({ time: s.recordedAt, n: s.latencyMs }))}/><Graph title="CPU" unit=" %" samples={data.metrics.metrics.map(s => ({ time: s.recordedAt, n: s.cpuPercent }))}/><Graph title="Arbeitsspeicher" unit=" MiB" samples={data.metrics.metrics.map(s => ({ time: s.recordedAt, n: s.memoryUsedBytes === null ? null : s.memoryUsedBytes / 1048576 }))}/><p>{data.metrics.snapshots.length} Statusmessungen. Begrenzter Verlauf; daraus wird keine Uptime oder Verfügbarkeit berechnet.</p>{data.metrics.snapshots.every(s => s.status !== 'ONLINE' && s.status !== 'OFFLINE' && s.onlinePlayers === null && s.latencyMs === null) && !data.metrics.metrics.length && <p>Keine darstellbaren Messwerte; der gemeldete Status ist unbekannt.</p>}</>}</>}
 {tab === 3 && data.events && <><div className="gsm-list"><table><thead><tr>{['Zeitpunkt', 'Server', 'Typ', 'Ereignis'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{data.events.items.map(e => <tr key={e.id} aria-selected={eventId === e.id}><td><button className="gsm-server-link" onClick={() => setEventId(e.id)}>{date(e.occurredAt)}</button></td><td>{server.name}</td><td>{e.type}</td><td>{e.message}</td></tr>)}</tbody></table></div>{!data.events.items.length && <p>Keine Öffentlichen Ereignisse vorhanden.</p>}{event && <Fields title="Ereignisdetails" fields={[['Zeitpunkt', date(event.occurredAt)], ['Typ', event.type], ['Meldung', event.message], ['Spieler', value(event.playerName)]]}/>}<div className="gsm-pagination"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Zurück</button><span>Seite {page} · {data.events.total} Ereignisse</span><button disabled={page * 25 >= data.events.total} onClick={() => setPage(p => p + 1)}>Weiter</button></div></>}
 </>}
 </div><div className="status-bar" role="status"><p className="status-bar-field">{servers.length} Server</p><p className="status-bar-field">{servers.filter(s => s.status === 'ONLINE' && !s.stale).length} Online{error ? ' (unbestätigt)' : ''}</p><p className="status-bar-field">Aktualisiert: {updated ? updated.toLocaleTimeString('de-DE') : '–'}</p><p className="status-bar-field">{connection}</p></div>
 </div>;
}
