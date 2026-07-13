export function Switch({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`switch ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
    />
  );
}

export function Radio({ on }: { on: boolean }) {
  return <span className={`radio ${on ? 'on' : ''}`} />;
}

export function RadioRow({
  value,
  current,
  onSelect,
  label,
}: {
  value: string;
  current: string;
  onSelect: (v: string) => void;
  label: string;
}) {
  return (
    <div className="radio-row" onClick={() => onSelect(value)}>
      <Radio on={current === value} />
      <span className="radio-label">{label}</span>
    </div>
  );
}
