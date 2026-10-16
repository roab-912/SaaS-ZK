// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Issuers } from '../../../../src/features/issuers/IssuersPage.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn(async () => []) }));
test('issuer registry clearly stays uncertified and admin form is role-gated', async () => {
  const props = { user: { admin: false }, notify: vi.fn() },
    view = render(<Issuers {...props} />);
  expect(await screen.findByText(/Aucun émetteur approuvé/i)).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Administrer le registre' })).toBeNull();
  view.rerender(<Issuers {...props} user={{ admin: true }} />);
  expect(screen.getByRole('heading', { name: 'Administrer le registre' })).toBeVisible();
  expect(screen.getByText(/ne sont pas encore activés/)).toBeVisible();
  expect(api).toHaveBeenCalledWith('/issuers');
});
