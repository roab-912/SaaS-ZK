import React, { useId } from 'react';
import { Search, X } from 'lucide-react';
export function SearchField({
  label,
  value,
  onChange,
  count,
  placeholder = 'Nom, description ou empreinte…',
}) {
  const id = useId();
  return (
    <div className="library-search">
      <label htmlFor={id}>{label}</label>
      <div className="search-input">
        <Search size={18} aria-hidden="true" />
        <input
          id={id}
          type="search"
          maxLength={120}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className="icon-button"
            aria-label={'Effacer : ' + label}
            onClick={() => onChange('')}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {Number.isInteger(count) && (
        <p className="search-count" role="status">
          {count} résultat{count === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
