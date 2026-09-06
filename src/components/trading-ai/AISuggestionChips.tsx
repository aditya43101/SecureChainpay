'use client';

import React from 'react';

interface AISuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function AISuggestionChips({ suggestions, onSelect, disabled }: AISuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="px-3.5 py-1.5 text-xs font-medium rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          aria-label={`Ask: ${suggestion}`}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
