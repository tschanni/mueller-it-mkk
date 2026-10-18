import { fireEvent, render, screen } from '@testing-library/react';
import { MinecraftProfile } from './MinecraftProfile';

const id = '12345678123412341234123456789abc';
const uuid = '12345678-1234-1234-1234-123456789abc';
const skin = `https://mc-api.io/render/FACE/${uuid}?size=64`;
const profile = () => ({ uuid, name: 'Current_Name', cachedAt: 1704063600000 });
const mockFetch = jest.fn();
const originalKey = process.env.REACT_APP_MC_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.REACT_APP_MC_API_KEY;
  else process.env.REACT_APP_MC_API_KEY = originalKey;
});
beforeEach(() => {
  delete process.env.REACT_APP_MC_API_KEY;
  mockFetch.mockReset();
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: mockFetch });
});

test('sends configured key to profile and render requests and releases the image blob', async () => {
  process.env.REACT_APP_MC_API_KEY = ' test-api-key ';
  const revoke = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:avatar') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  mockFetch.mockImplementation(async (url: string) => url.includes('/render/')
    ? { ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) }
    : { ok: true, json: async () => profile() });
  const { unmount } = render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText('Verknüpftes Profil: Current_Name');
  expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:avatar');
  expect(mockFetch).toHaveBeenCalledWith(skin, expect.objectContaining({ headers: { 'X-API-Key': 'test-api-key' }, credentials: 'omit' }));
  expect(mockFetch).toHaveBeenCalledWith(`https://mc-api.io/profile/${id}`, expect.objectContaining({ headers: { 'X-API-Key': 'test-api-key' } }));
  unmount();
  expect(revoke).toHaveBeenCalledWith('blob:avatar');
});

test('loads by normalized UUID without credentials and displays name and HTTPS skin', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => profile() });
  render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText('Verknüpftes Profil: Current_Name');
  expect(screen.getByText(uuid)).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledWith(`https://mc-api.io/profile/${id}`, expect.objectContaining({ credentials: 'omit', signal: expect.any(AbortSignal) }));
  expect(screen.getByRole('img', { name: 'Minecraft-Skin von Current_Name' })).toHaveAttribute('src', skin);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Skin konnte nicht geladen werden.')).toBeInTheDocument();
});

test.each(['network', 'wrong UUID'])('keeps stored data when Minecraft returns %s', async failure => {
  if (failure === 'network') mockFetch.mockRejectedValue(new Error('Unavailable'));
  else mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...profile(), uuid: '0'.repeat(32) }) });
  render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText(/Minecraft-Profil derzeit nicht verfügbar/);
  expect(screen.getByText('Verknüpftes Profil: Old_Name')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', skin);
});

test('handles profiles without a custom skin', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ uuid, name: 'Current_Name' }) });
  render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText('Verknüpftes Profil: Current_Name');
  expect(screen.getByRole('img')).toHaveAttribute('src', skin);
});
