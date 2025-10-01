"use client";

import AirportField from "./AirportField";

export default function AirportInput(props: {
  id: string;
  label: string;
  value?: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const { id, label, value, onChange, autoFocus } = props;
  return (
    <AirportField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      placeholder="Type city or airport"
    />
  );
}
