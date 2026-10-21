import { fireEvent, render, screen } from '@testing-library/react';
import { MinecraftProfile } from './MinecraftProfile';
import { MinecraftHead } from './MinecraftHead';
const uuid = '12345678-1234-1234-1234-123456789abc';

test('profile and list share the public UUID head renderer without keys or profile requests', () => {
  const fetcher = jest.fn();
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetcher });
  render(<MinecraftProfile uuid={uuid} username="Player" />);
  expect(screen.getByText(/Player/)).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', `https://mc-api.io/render/FACE/${uuid}?size=64`);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).not.toHaveAttribute('src');
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
