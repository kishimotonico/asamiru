import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import { useState, type ReactNode } from "react";
import { ActionButton } from "./components/FormControls";
import { WeatherSettingsSection } from "./WeatherSettingsSection";
import { TrainsSettingsSection } from "./TrainsSettingsSection";
import { LineStatusSettingsSection } from "./LineStatusSettingsSection";
import { SleepSettingsSection } from "./SleepSettingsSection";
import { DisplayStatusSection } from "./DisplayStatusSection";
import { ThemeSettingsSection } from "./ThemeSettingsSection";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

const TABS = ["表示設定", "システム設定"] as const;

function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="1.5" width="8.5" height="8.5" rx="1" />
      <path d="M1.5 4v8.5h8.5" />
    </svg>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [maximized, setMaximized] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} transition className="relative z-[10000]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition duration-200 ease-out data-[closed]:opacity-0"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className={`w-full overflow-hidden rounded-xl bg-surface shadow-xl transition-[max-width] duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 ${
            maximized ? "max-w-5xl" : "max-w-2xl"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7 sm:py-5">
            <DialogTitle className="text-lg font-semibold text-ink">設定</DialogTitle>
            <div className="flex items-center gap-1">
              <ActionButton
                onClick={() => setMaximized((v) => !v)}
                variant="ghost"
                className="h-8 w-8 px-0 py-0"
                aria-label={maximized ? "元のサイズに戻す" : "最大化"}
              >
                {maximized ? <RestoreIcon /> : <MaximizeIcon />}
              </ActionButton>
              <ActionButton onClick={onClose} variant="ghost" className="h-8 w-8 px-0 py-0" aria-label="閉じる">
                ×
              </ActionButton>
            </div>
          </div>

          <TabGroup>
            <TabList className="flex gap-1 border-b border-border px-5 pt-3 sm:px-7">
              {TABS.map((tab) => (
                <Tab
                  key={tab}
                  className="-mb-px rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted outline-none transition hover:text-ink data-[selected]:border-[var(--accent)] data-[selected]:text-ink"
                >
                  {tab}
                </Tab>
              ))}
            </TabList>

            <TabPanels className="h-[65vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <TabPanel className="space-y-7 outline-none">
                <Section title="天気">
                  <WeatherSettingsSection />
                </Section>
                <Section title="電車">
                  <TrainsSettingsSection />
                </Section>
                <Section title="路線運行情報">
                  <LineStatusSettingsSection />
                </Section>
              </TabPanel>

              <TabPanel className="space-y-7 outline-none">
                <Section title="スリープ">
                  <SleepSettingsSection />
                </Section>
                <Section title="モニター">
                  <DisplayStatusSection />
                </Section>
                <Section title="テーマ">
                  <ThemeSettingsSection />
                </Section>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-ink-subtle">{title}</h3>
      {children}
    </section>
  );
}
