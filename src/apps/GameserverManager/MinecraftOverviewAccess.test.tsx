import { fireEvent, render, screen } from '@testing-library/react';
import { MinecraftOverviewAccess } from './MinecraftOverviewAccess';

let mockSession: { user: { id: string; emailVerified: boolean } } | null;
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ session: mockSession }) }));
const mockFetch = jest.fn();
beforeEach(() => {
  mockSession = { user: { id: 'one', emailVerified: true } };
  mockFetch.mockReset();
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: mockFetch });
});

test('replaces invitation with linked profile and keeps management accessible', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ minecraft: { username: 'Player_123', uuid: '12345678-1234-1234-1234-123456789abc' } }) });
  const open = jest.fn();
  const { rerender } = render(<MinecraftOverviewAccess onOpen={open} />);
  await screen.findByText('Verknüpftes Profil: Player_123');
  expect(screen.getByText('12345678-1234-1234-1234-123456789abc')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('/api/v1/public/minecraft/avatars/12345678-1234-1234-1234-123456789abc'));
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Du willst Teil/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Whitelist verwalten' }));
  expect(open).toHaveBeenCalledTimes(1);
  mockSession = null;
  rerender(<MinecraftOverviewAccess onOpen={open} />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByText('Verknüpftes Profil: Player_123')).not.toBeInTheDocument();
});

test('keeps invitation when no profile is linked', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ minecraft: null }) });
  render(<MinecraftOverviewAccess onOpen={() => {}} />);
  await screen.findByText(/Du willst Teil/);
  expect(screen.getByRole('button', { name: 'Whitelist öffnen' })).toBeInTheDocument();
});

test('does not request private data for anonymous users', () => {
  mockSession = null;
  render(<MinecraftOverviewAccess onOpen={() => {}} />);
  expect(mockFetch).not.toHaveBeenCalled();
});
