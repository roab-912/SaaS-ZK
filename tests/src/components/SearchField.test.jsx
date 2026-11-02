// @vitest-environment jsdom
import React, { useState } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchField } from '../../../src/components/SearchField.jsx';
test('search is labelled, limited, clearable and announces the actual result count', async () => {
  const changed = vi.fn();
  function Form() {
    const [value, setValue] = useState('');
    return (
      <SearchField
        label="Rechercher"
        value={value}
        onChange={(v) => {
          setValue(v);
          changed(v);
        }}
        count={value ? 0 : 2}
      />
    );
  }
  render(<Form />);
  expect(screen.getByRole('searchbox')).toHaveAccessibleName('Rechercher');
  expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '120');
  await userEvent.type(screen.getByRole('searchbox'), 'revenu');
  expect(screen.getByRole('status')).toHaveTextContent('0 résultats');
  await userEvent.click(screen.getByRole('button', { name: 'Effacer : Rechercher' }));
  expect(changed).toHaveBeenLastCalledWith('');
  expect(screen.getByRole('status')).toHaveTextContent('2 résultats');
});
