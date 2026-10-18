import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Music } from './Music';

test('opens a YouTube embed with client identification and returns to the music folder', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => [{ title: 'Sandstorm', artist: 'Darude', youtube: 'https://www.youtube.com/watch?v=y6120QOlsfU' }],
  });
  try {
    render(<Music />);
    fireEvent.click(await screen.findByRole('button', { name: 'Darude - Sandstorm.mp3' }));
    const player = screen.getByTitle('Darude - Sandstorm');
    expect(player).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(player).toHaveAttribute('src', 'https://www.youtube.com/embed/y6120QOlsfU?autoplay=1&playsinline=1');
    expect(screen.getByRole('link', { name: 'Auf YouTube öffnen' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=y6120QOlsfU');
    fireEvent.click(screen.getByRole('button', { name: /zurück/ }));
    expect(screen.queryByTitle('Darude - Sandstorm')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Darude - Sandstorm.mp3' })).toBeInTheDocument();
  } finally {
    global.fetch = originalFetch;
  }
});
