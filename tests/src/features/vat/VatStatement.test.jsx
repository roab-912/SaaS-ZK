// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { VatStatement } from '../../../../src/features/vat/VatStatement.jsx';
import { vatFixture } from '../../../helpers/vat.mjs';
test('public summary distinguishes announced and verified totals and shows the completeness boundary', async () => {
  vi.stubGlobal('crypto', webcrypto);
  try {
    const f = await vatFixture();
    const view = render(<VatStatement manifest={f.manifest} sales={3000} credits={500} />);
    expect(screen.getByText('DEMO-VAT')).toBeVisible();
    expect(screen.getByText('01/09/2026 au 30/09/2026')).toBeVisible();
    expect(screen.getByText(/absence de factures inconnues/)).toBeVisible();
    view.rerender(
      <VatStatement
        manifest={f.manifest}
        sales={3000}
        credits={500}
        source={{ valid: true, issuerName: 'Autorité TVA' }}
        proved
      />,
    );
    expect(screen.getByText('Calcul et source vérifiés')).toBeVisible();
    expect(screen.getByText(/25,00/)).toBeVisible();
  } finally {
    vi.unstubAllGlobals();
  }
});
