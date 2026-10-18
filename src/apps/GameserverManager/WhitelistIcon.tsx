export function WhitelistIcon({ kind }: { kind: 'discord' | 'profile' | 'shield' | 'check' | 'refresh' }) {
  const paths = {
    discord: 'M8 5 5 6 3 16l4 2 1-2m8-11 3 1 2 10-4 2-1-2M8 5h8M7 15c3 2 7 2 10 0M8 11h1m6 0h1',
    profile: 'M8 3h8v8H8zM5 21v-5l3-2h8l3 2v5M9 7h.01M15 7h.01',
    shield: 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6zM8 12l3 3 5-6',
    check: 'm5 12 4 4L19 6',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3',
  };
  return <svg className="mc98-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
