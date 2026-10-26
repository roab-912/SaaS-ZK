import React from 'react';
import { displayDate, isoDate } from '../lib/format.js';

// Keep ISO values in the domain while always showing the same date order.
export function DateInput({ value, onChange, ...props }) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder="jj/mm/aaaa"
      aria-description="Format jj/mm/aaaa"
      maxLength={10}
      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      autoComplete="off"
      value={displayDate(value)}
      onChange={(e) => onChange(isoDate(e.target.value))}
    />
  );
}
