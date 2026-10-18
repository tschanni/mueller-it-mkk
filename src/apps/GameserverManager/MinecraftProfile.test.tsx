import { fireEvent, render, screen } from '@testing-library/react';
import { MinecraftProfile } from './MinecraftProfile';

const id = '12345678123412341234123456789abc';
const uuid = '12345678-1234-1234-1234-123456789abc';
const skin = 'http://textures.minecraft.net/texture/abcdef012345';
const profile = (url = skin) => ({ id, name: 'Current_Name', properties: [{ name: 'textures', value: btoa(JSON.stringify({ textures: { SKIN: { url } } })) }] });
const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: mockFetch });
});

test('loads by normalized UUID without credentials and displays name and HTTPS skin', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => profile() });
  render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText('Verknüpftes Profil: Current_Name');
  expect(screen.getByText(uuid)).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledWith(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, expect.objectContaining({ credentials: 'omit', signal: expect.any(AbortSignal) }));
  expect(screen.getByRole('img', { name: 'Minecraft-Skin von Current_Name' })).toHaveAttribute('src', skin.replace('http:', 'https:'));
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Skin konnte nicht geladen werden.')).toBeInTheDocument();
});

test.each(['network', 'invalid texture', 'wrong UUID'])('keeps stored data when Mojang returns %s', async failure => {
  if (failure === 'network') mockFetch.mockRejectedValue(new Error('Unavailable'));
  else mockFetch.mockResolvedValue({ ok: true, json: async () => failure === 'wrong UUID' ? { ...profile(), id: '0'.repeat(32) } : profile('https://example.com/texture/abc') });
  render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText(/Mojang-Profil derzeit nicht verfügbar/);
  expect(screen.getByText('Verknüpftes Profil: Old_Name')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('handles profiles without a custom skin', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id, name: 'Current_Name', properties: [] }) });
  render(<MinecraftProfile uuid={uuid} username="Old_Name" />);
  await screen.findByText('Für dieses Profil ist kein eigener Skin hinterlegt.');
});
