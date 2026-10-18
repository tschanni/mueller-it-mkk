import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
jest.mock('./apps/Gallery/Gallery', () => ({ Gallery: () => null }));
test('renders the existing desktop and Gameserver-Manager icon', () => {
 render(<App />);
 expect(screen.getByRole('button', { name: 'Gameserver-Manager' })).toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Taschenrechner' })).toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
