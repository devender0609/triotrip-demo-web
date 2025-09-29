// components/AirportInput.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Airport = { code: string; label: string };

export default function AirportInput({
  value,
  onChange,
  placeholder,
}: {
  value?: Airport | null;
  onChange: (a: Airport | null) => void;
  placeholder: string;
}) {
  const [term, setTerm] = useState(value?.label ?? "");
  const [list, setList] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);

  const dep = useMemo(() => term, [term]);
  useEffect(() => {
    const id = setTimeout(async () => {
      const t = dep.trim();
      if (t.length < 2) {
        setList([]);
        return;
      }
      try {
        const r = await fetch(`/api/airports?q=${encodeURIComponent(t)}`);
        const data = (await r.json()) as Airport[];
        setList(data);
      } catch {
        setList([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [dep]);

  return (
    <div className="relative">
      <input
        className="border rounded px-3 py-2 w-full"
        placeholder={placeholder}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
      />

      {open && list.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
          {list.map((a) => (
            <li
              key={a.code + a.label}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onMouseDown={() => {
                onChange(a);
                setTerm(a.label);
                setOpen(false);
              }}
            >
              {a.label}
            </li>
          ))}
        </ul>
      )}

      {open && term.trim().length >= 2 && list.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow px-3 py-2 text-sm text-gray-500">
          No matches
        </div>
      )}
    </div>
  );
}
