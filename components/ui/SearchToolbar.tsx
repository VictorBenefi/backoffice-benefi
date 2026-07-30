"use client";

type SearchToolbarProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function SearchToolbar({
  value,
  onChange,
  onClear,
  placeholder = "Buscar...",
  disabled = false,
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      />

      <button
        type="button"
        onClick={onClear}
        disabled={disabled || value.length === 0}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Limpiar
      </button>
    </div>
  );
}
