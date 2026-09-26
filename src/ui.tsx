import * as Slider from "@radix-ui/react-slider";
import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";
export function Range({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v: number) => String(v),
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  format?: (v: number) => string;
  note?: string;
}) {
  return (
    <label className="range-control">
      <span className="range-label">
        <span>{label}</span>
        <output>{format(value)}</output>
      </span>
      <Slider.Root
        className="slider"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      >
        <Slider.Track className="slider-track">
          <Slider.Range className="slider-fill" />
        </Slider.Track>
        <Slider.Thumb className="slider-thumb" aria-label={label} />
      </Slider.Root>
      {note && <small>{note}</small>}
    </label>
  );
}
export function ControlGroup({
  title,
  children,
  initial = false,
}: {
  title: string;
  children: ReactNode;
  initial?: boolean;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={initial ? "open" : undefined}
    >
      <Accordion.Item value="open" className="control-group">
        <Accordion.Header>
          <Accordion.Trigger className="control-trigger">
            {title}
            <ChevronDown size={15} />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="control-content">
          {children}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
export function Drawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer">
          <Dialog.Title>Questions worth asking.</Dialog.Title>
          <Dialog.Description>
            Change one assumption. See how the decision moves.
          </Dialog.Description>
          <Dialog.Close
            className="drawer-close"
            aria-label="Close judge questions"
          >
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
