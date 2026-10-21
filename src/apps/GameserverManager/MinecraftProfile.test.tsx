import { fireEvent, render, screen } from '@testing-library/react';
import { MinecraftProfile } from './MinecraftProfile';
import { MinecraftHead, minecraftHeadUrl } from './MinecraftHead';
import { MinecraftWhitelist } from './MinecraftWhitelist';
const uuid = '12345678-1234-1234-1234-123456789abc';
const apiBase = 'https://api.example/games';
const avatarPath = `/games/api/v1/public/minecraft/avatars/${uuid}`;
const avatar = `https://api.example${avatarPath}`;

test('profile displays the public backend PNG without keys or profile requests', () => {
  const fetcher = jest.fn();
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetcher });
  render(<MinecraftProfile uuid={uuid} username="Player" apiBase={apiBase} />);
  expect(screen.getByText(/Player/)).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', avatar);
  expect(screen.getByRole('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(fetcher).not.toHaveBeenCalled();
  // The backend's neutral fallback is also a successful PNG, not an error.
  fireEvent.load(screen.getByRole('img'));
  expect(screen.getByRole('img')).toHaveAttribute('src', avatar);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).not.toHaveAttribute('src');
});

test('whitelist uses the same resolver and ignores untrusted avatar URLs', () => {
  const players = [{ uuid, username: 'Player', isCurrentUser: true, avatarUrl: 'https://untrusted.example/avatar.png?key=secret' }];
  render(<MinecraftWhitelist players={players} apiBase={apiBase} />);
  expect(screen.getByRole('img')).toHaveAttribute('src', avatar);
  expect(screen.getByText('Du')).toBeInTheDocument();
  expect(screen.getByText(/1 Spieler/)).toBeInTheDocument();
});

test('normalizes UUIDs and resolves the route on the API origin with its deployment prefix', () => {
  expect(minecraftHeadUrl(uuid.replace(/-/g, '').toUpperCase(), apiBase + '/')).toBe(avatar);
  expect(minecraftHeadUrl(uuid, 'https://staging.example/custom')).toBe(`https://staging.example/custom/api/v1/public/minecraft/avatars/${uuid}`);
  expect(minecraftHeadUrl(uuid, 'https://api.example')).toBe(`https://api.example/api/v1/public/minecraft/avatars/${uuid}`);
  expect(minecraftHeadUrl(uuid, apiBase)).toBe(new URL(avatarPath, new URL(apiBase).origin).href);
});

test('uses existing auth API configuration when no API base is passed', () => {
  const previous = process.env.REACT_APP_AUTH_API_BASE_URL;
  try {
    process.env.REACT_APP_AUTH_API_BASE_URL = 'https://staging.example/prefix/api/v1/auth';
    expect(minecraftHeadUrl(uuid)).toBe(`https://staging.example/prefix/api/v1/public/minecraft/avatars/${uuid}`);
  } finally {
    if (previous === undefined) delete process.env.REACT_APP_AUTH_API_BASE_URL;
    else process.env.REACT_APP_AUTH_API_BASE_URL = previous;
  }
});

test.each(['', '../player', '1234', 'g'.repeat(32), uuid + '?key=x', '-' + uuid])('rejects invalid UUID %s without a request', id => {
  expect(minecraftHeadUrl(id, apiBase)).toBeNull();
});

test.each(['invalid', '//untrusted.example', 'data:image/png;base64,a', 'http://api.example', 'https://user:secret@api.example', apiBase + '?key=secret', apiBase + '#fragment'])('invalid API configuration %s uses local fallback', base => {
  expect(minecraftHeadUrl(uuid, base)).toBeNull();
});

test('actual image failure stays local without retry and account changes replace the image', () => {
  const { rerender, unmount } = render(<MinecraftHead uuid={uuid} username="Player" apiBase={apiBase} />);
  fireEvent.error(screen.getByRole('img'));
  rerender(<MinecraftHead uuid={uuid} username="Player" apiBase={apiBase} />);
  expect(screen.getByRole('img')).not.toHaveAttribute('src');
  const other = 'a'.repeat(32);
  rerender(<MinecraftHead uuid={other} username="Other" apiBase={apiBase} />);
  expect(screen.getByRole('img')).toHaveAttribute('src', minecraftHeadUrl(other, apiBase));
  unmount();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('invalid UUID uses local fallback and a changed UUID recovers from failure', () => {
  const { rerender } = render(<MinecraftHead uuid="invalid" username="Player" />);
  expect(screen.getByRole('img')).not.toHaveAttribute('src');
  rerender(<MinecraftHead uuid={uuid} username="Player" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).not.toHaveAttribute('src');
  rerender(<MinecraftHead uuid={'a'.repeat(32)} username="Other" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('aaaaaaaa-aaaa'));
});
