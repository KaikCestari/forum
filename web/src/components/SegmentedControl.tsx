import { m } from "motion/react";
import { spring, tap } from "../motion/tokens";

interface Props<T extends string> {
  id: string;
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Grupo de botões em que o realce desliza até a opção escolhida. */
export function SegmentedControl<T extends string>({ id, label, options, value, onChange }: Props<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <m.button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          whileTap={tap}
        >
          {o.value === value && <m.span layoutId={`${id}-pill`} className="segmented-pill" transition={spring.snappy} />}
          <span className="segmented-label">{o.label}</span>
        </m.button>
      ))}
    </div>
  );
}
