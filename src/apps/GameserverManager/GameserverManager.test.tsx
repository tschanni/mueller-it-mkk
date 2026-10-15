import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GameserverManager } from './GameserverManager';
import { parseServers, statusText } from './api';
import App from '../../App';
jest.mock('../Gallery/Gallery', () => ({ Gallery: () => null }));
const sample = { id: 'mc', slug: 'mc', name: 'Minecraft Test', gameType: 'MINECRAFT', status: 'ONLINE', desiredState: 'ONLINE', statusMessage: 'Status geprüft', onlinePlayers: 0, maxPlayers: 20, gameVersion: 'Paper', latencyMs: 29, motd: null, lastCheckedAt: null, lastSuccessfulCheckAt: null, lastError: null, connection: { host: 'minecraft.example.com', port: 25565 }, capability: 'MINECRAFT_STATUS', stale: false };
class MockStream {
    static instances: MockStream[] = [];
    listeners: Record<string, () => void> = {};
    onerror: (() => void) | null = null;
    close = jest.fn();
    constructor() { MockStream.instances.push(this); }
    addEventListener(type: string, callback: () => void) { this.listeners[type] = callback; }
}
let fetchMock: jest.Mock;
test('preloads at page entry and reuses the result when the manager opens', async () => {
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(MockStream.instances).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Gameserver-Manager' }));
    await screen.findByRole('button', { name: 'Minecraft Test' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(MockStream.instances).toHaveLength(1);
});
beforeEach(() => {
    MockStream.instances = [];
    Object.defineProperty(window, 'EventSource', { writable: true, value: MockStream });
    fetchMock = jest.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/metrics') ? { snapshots: [], metrics: [], limit: 100, message: '' } : url.includes('/players') ? { players: [], available: false, message: '', lastHeartbeatAt: null } : url.includes('/events') ? { items: [], total: 0, page: 1, limit: 25 } : [sample, { ...sample, id: 'terraria', slug: 'terraria', name: 'Terraria Test', gameType: 'TERRARIA', status: 'UNKNOWN', capability: 'TCP_ONLY', onlinePlayers: null, maxPlayers: null, gameVersion: null, latencyMs: null }] }));
    Object.defineProperty(window, 'fetch', { writable: true, value: fetchMock });
});
test('validates responses and preserves unknown states and missing metrics', () => {
    expect(parseServers([{ ...sample, status: 'UNKNOWN', onlinePlayers: null }])[0]).toMatchObject({ status: 'UNKNOWN', onlinePlayers: null });
    expect(statusText('OFFLINE')).toBe('Offline');
    expect(statusText('UNKNOWN')).toBe('Unbekannt');
    expect(statusText('ONLINE')).toBe('Online');
    expect(() => parseServers({ servers: [] })).toThrow();
});
test('loads real summaries, supports keyboard tabs, and shows unavailable history', async () => {
    render(<GameserverManager />);
    await screen.findByRole('button', { name: 'Minecraft Test' });
    expect(screen.getByText('Unbekannt')).toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Übersicht' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Server' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Spielernamen nicht öffentlich verfügbar.');
    fireEvent.click(screen.getByRole('tab', { name: 'Leistung' }));
    await screen.findByText('Für diesen Server sind noch keine Verlaufsdaten verfügbar.');
    fireEvent.click(screen.getByRole('tab', { name: 'Ereignisse' }));
    await screen.findByText('Keine Öffentlichen Ereignisse vorhanden.');
});
test('reports errors and allows retry and empty lists', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    render(<GameserverManager />);
    await screen.findByRole('alert');
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Keine Gameserver eingerichtet.');
});
test('resynchronizes on SSE updates and closes subscriptions and aborts on unmount', async () => {
    const { unmount } = render(<GameserverManager />);
    await screen.findByRole('button', { name: 'Minecraft Test' });
    const stream = MockStream.instances[0];
    act(() => stream.listeners.connected());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    act(() => stream.listeners['status.changed']());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const signal = fetchMock.mock.calls[0][1].signal;
    unmount();
    expect(stream.close).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(true);
});
test('desktop opens on a single click, keeps one instance, restores, maximizes, and closes', async () => {
    render(<App />);
    const icon = screen.getByRole('button', { name: 'Gameserver-Manager' });
    fireEvent.click(icon);
    await screen.findByRole('button', { name: 'Minecraft Test' });
    fireEvent.click(icon);
    expect(screen.getAllByText('Öffentliche Serverüberwachung')).toHaveLength(1);
    const panel = screen.getByRole('dialog', { name: 'Gameserver-Manager – Müller IT MKK' });
    const minimize = within(panel).getByRole('button', { name: 'Minimize' });
    fireEvent.click(minimize);
    expect(panel).toHaveClass('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Gameserver-Manager – Müller IT MKK' }));
    expect(panel).not.toHaveClass('hidden');
    fireEvent.click(within(panel).getByRole('button', { name: 'Maximize' }));
    expect(panel).toHaveClass('maximized');
    fireEvent.click(within(panel).getByRole('button', { name: 'Restore' }));
    expect(panel).not.toHaveClass('maximized');
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(panel).not.toBeInTheDocument();
    expect(MockStream.instances[0].close).toHaveBeenCalled();
});

test('falls back to polling after SSE interruption and cancels polling on close', async () => {
    jest.useFakeTimers();
    const { unmount } = render(<GameserverManager />);
    try {
        await act(async () => { await Promise.resolve(); });
        const stream = MockStream.instances[0];
        act(() => { stream.onerror?.(); });
        expect(screen.getByText('Live-Verbindung unterbrochen – Abfragebetrieb')).toBeInTheDocument();
        await act(async () => { jest.advanceTimersByTime(30000); });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        unmount();
        await act(async () => { jest.advanceTimersByTime(60000); });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { unmount(); jest.useRealTimers(); }
});

test('keeps server details usable when the optional player list fails and allows retry', async () => {
    const successfulFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options: unknown) => url.includes('/players')
        ? Promise.reject(new TypeError('Failed to fetch')) : successfulFetch(url, options));
    render(<GameserverManager />);
    await screen.findByRole('button', { name: 'Minecraft Test' });
    fireEvent.click(screen.getByRole('tab', { name: 'Server' }));
    await screen.findByText('Spielerliste konnte nicht geladen werden.');
    expect(screen.getByText('minecraft.example.com')).toBeInTheDocument();
    expect(screen.getByText('Paper')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
    fetchMock.mockImplementation(successfulFetch);
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Spielernamen nicht \u00f6ffentlich verf\u00fcgbar.');
    expect(screen.queryByText('Spielerliste konnte nicht geladen werden.')).not.toBeInTheDocument();
});
