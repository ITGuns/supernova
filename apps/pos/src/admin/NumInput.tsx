import { useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

// A numeric field you can actually type into. The parent owns the formatted
// value ("12.50", "8.25"); while the field has focus it shows exactly what
// was typed and only commits on blur / Enter, so typing "1", "12", "12."
// never gets reformatted mid-keystroke. Escape restores the old value.

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'type'> & {
  value: string;
  onCommit: (text: string) => void;
};

export function NumInput({ value, onCommit, className = 'pe-input', onKeyDown, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null); // null = not editing
  const cancelled = useRef(false);
  const shown = text ?? value;

  const commit = () => {
    if (!cancelled.current && text !== null && text !== value) onCommit(text);
    cancelled.current = false;
    setText(null);
  };

  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      cancelled.current = true;
      e.currentTarget.blur();
    }
    onKeyDown?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      value={shown}
      onFocus={(e) => {
        setText(value);
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={key}
    />
  );
}

/** Money in minor units ↔ "12.50". */
export function MoneyInput({ minor, onChange, ...rest }: Omit<Props, 'value' | 'onCommit'> & { minor: number; onChange: (minor: number) => void }) {
  return (
    <NumInput
      {...rest}
      value={(minor / 100).toFixed(2)}
      onCommit={(t) => onChange(Math.max(0, Math.round((parseFloat(t.replace(/[^0-9.-]/g, '')) || 0) * 100)))}
    />
  );
}

/** Whole number (blank allowed when `allowBlank`). */
export function IntInput({
  int,
  onChange,
  allowBlank,
  ...rest
}: Omit<Props, 'value' | 'onCommit'> & { int: number | null; onChange: (n: number | null) => void; allowBlank?: boolean }) {
  return (
    <NumInput
      {...rest}
      value={int === null ? '' : String(int)}
      onCommit={(t) => {
        const n = parseInt(t.replace(/[^0-9-]/g, ''), 10);
        onChange(Number.isFinite(n) ? Math.max(0, n) : allowBlank ? null : 0);
      }}
    />
  );
}
