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
import type { ReactNode } from "react";
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

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  return (
    <Dialog open={open} onClose={onClose} transition className="relative z-[10000]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition duration-200 ease-out data-[closed]:opacity-0"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-2xl overflow-hidden rounded-xl bg-surface shadow-xl transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7 sm:py-5">
            <DialogTitle className="text-lg font-semibold text-ink">設定</DialogTitle>
            <ActionButton onClick={onClose} variant="ghost" className="h-8 w-8 px-0 py-0" aria-label="閉じる">
              ×
            </ActionButton>
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

            <TabPanels className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
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
