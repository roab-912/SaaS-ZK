// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Badge,
  Button,
  Empty,
  PageHeading,
  Stat,
  AccountEmpty,
} from '../../../src/components/ui.jsx';
import { Check } from 'lucide-react';
test('shared components preserve labels, actions and disabled buttons', async () => {
  const click = vi.fn();
  render(
    <>
      <Badge tone="green">Actif</Badge>
      <Button onClick={click}>Continuer</Button>
      <Button disabled onClick={click}>
        Bloqué
      </Button>
      <PageHeading title="Titre" desc="Description" />
      <Empty title="Vide">Aucun fichier</Empty>
      <Stat icon={Check} label="Compteur" value={3} sub="Circuit" />
      <AccountEmpty open={click} />
    </>,
  );
  expect(screen.getByRole('heading', { name: 'Titre' })).toBeVisible();
  expect(screen.getByText('Actif')).toHaveClass('green');
  await userEvent.click(screen.getByRole('button', { name: 'Bloqué' }));
  expect(click).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  expect(click).toHaveBeenCalledTimes(2);
});
