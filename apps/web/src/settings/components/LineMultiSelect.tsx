import {
  Button,
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { useMemo, useState } from "react";
import type { WatchedLine } from "@asamiru/shared";

type LineMultiSelectProps = {
  options: WatchedLine[];
  value: WatchedLine[];
  onChange: (lines: WatchedLine[]) => void;
};

export function LineMultiSelect({ options, value, onChange }: LineMultiSelectProps) {
  const [query, setQuery] = useState("");
  const selectedUrls = useMemo(() => new Set(value.map((line) => line.yahooUrl)), [value]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    const filtered = normalizedQuery
      ? options.filter((line) => line.name.toLowerCase().includes(normalizedQuery))
      : options;

    return [...filtered].sort((a, b) => {
      const selectedDiff = Number(selectedUrls.has(b.yahooUrl)) - Number(selectedUrls.has(a.yahooUrl));
      return selectedDiff || a.name.localeCompare(b.name, "ja");
    });
  }, [normalizedQuery, options, selectedUrls]);

  const summary = value.length === 0
    ? "路線を選択"
    : value.length <= 2
      ? value.map((line) => line.name).join("、")
      : `${value.length}路線を選択`;

  return (
    <Combobox
      value={value}
      by={(a, b) => a?.yahooUrl === b?.yahooUrl}
      onChange={(lines) => onChange(lines)}
      multiple
      immediate
      onClose={() => setQuery("")}
    >
      <div className="relative">
        <div className="flex min-h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 focus-within:border-[--accent] focus-within:ring-2 focus-within:ring-[--accent]/15">
          <ComboboxInput
            aria-label="路線を検索"
            displayValue={() => ""}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            placeholder={summary}
          />
          {value.length > 0 ? (
            <Button
              type="button"
              onClick={() => onChange(value.filter((line) => !options.some((option) => option.yahooUrl === line.yahooUrl)))}
              className="shrink-0 rounded px-1.5 py-1 text-xs font-medium text-ink-subtle hover:bg-surface-muted hover:text-ink"
            >
              既定を解除
            </Button>
          ) : null}
          <ComboboxButton className="shrink-0 rounded px-1.5 py-1 text-sm text-ink-muted hover:bg-surface-muted">
            ▾
          </ComboboxButton>
        </div>

        {value.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.map((line) => (
              <span key={line.yahooUrl} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-muted px-2 py-1 text-xs text-ink-muted">
                <span className="truncate">{line.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((selected) => selected.yahooUrl !== line.yahooUrl))}
                  className="rounded-full px-1 text-ink-subtle hover:bg-surface hover:text-ink"
                  aria-label={`${line.name}を解除`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <ComboboxOptions
          anchor="bottom start"
          className="z-[10020] mt-1 max-h-72 w-(--input-width) overflow-y-auto rounded-md border border-border-strong bg-surface p-1 shadow-xl empty:hidden"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-subtle">該当する路線がありません</div>
          ) : (
            filteredOptions.map((line) => (
              <ComboboxOption
                key={line.yahooUrl}
                value={line}
                className="group flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-ink data-focus:bg-surface-muted"
              >
                {({ selected }) => (
                  <>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong text-[11px] text-white group-data-selected:border-[--accent] group-data-selected:bg-[--accent]">
                      {selected ? "✓" : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{line.name}</span>
                  </>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
