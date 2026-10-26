// @vitest-environment jsdom
import React, { useState } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateInput } from '../../../src/components/DateInput.jsx';

test('French typing and partial edits are preserved while complete values become ISO', async () => {
  const changed = vi.fn();
  function Field() {
    const [value, setValue] = useState('');
    return (
      <DateInput
        aria-label="Date"
        value={value}
        onChange={(v) => {
          changed(v);
          setValue(v);
        }}
      />
    );
  }
  render(<Field />);
  const input = screen.getByLabelText('Date');
  expect(input).toHaveAttribute('placeholder', 'jj/mm/aaaa');
  await userEvent.type(input, '29/02/2000');
  expect(input).toHaveValue('29/02/2000');
  expect(changed).toHaveBeenLastCalledWith('2000-02-29');
  await userEvent.clear(input);
  await userEvent.type(input, '31/02/2026');
  expect(input).toHaveValue('31/02/2026');
  expect(changed).toHaveBeenLastCalledWith('2026-02-31');
});
test('imports and external clearing update the displayed field without emitting data', () => {
  const onChange = vi.fn();
  const view = render(
    <DateInput aria-label="Date" value="2000-02-29" onChange={onChange} disabled />,
  );
  expect(screen.getByLabelText('Date')).toHaveValue('29/02/2000');
  expect(screen.getByLabelText('Date')).toBeDisabled();
  view.rerender(<DateInput aria-label="Date" value="" onChange={onChange} />);
  expect(screen.getByLabelText('Date')).toHaveValue('');
  expect(onChange).not.toHaveBeenCalled();
});
