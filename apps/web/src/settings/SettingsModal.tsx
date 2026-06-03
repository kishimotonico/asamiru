import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ActionButton } from "./components/FormControls";
import { WeatherSettingsSection } from "./WeatherSettingsSection";
import { TrainsSettingsSection } from "./TrainsSettingsSection";
import { LineStatusSettingsSection } from "./LineStatusSettingsSection";
import { SleepSettingsSection } from "./SleepSettingsSection";
import { DisplayStatusSection } from "./DisplayStatusSection";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[10000]">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#e8e6df] px-5 py-4 sm:px-7 sm:py-5">
            <DialogTitle className="text-lg font-semibold text-[#1f2024]">設定</DialogTitle>
            <ActionButton onClick={onClose} variant="ghost" className="h-8 w-8 px-0 py-0" aria-label="閉じる">
              ×
            </ActionButton>
          </div>

          <div className="max-h-[80vh] space-y-7 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <section>
              <SectionTitle>天気</SectionTitle>
              <WeatherSettingsSection />
            </section>

            <section>
              <SectionTitle>電車</SectionTitle>
              <TrainsSettingsSection />
            </section>

            <section>
              <SectionTitle>路線運行情報</SectionTitle>
              <LineStatusSettingsSection />
            </section>

            <section>
              <SectionTitle>スリープ</SectionTitle>
              <SleepSettingsSection />
            </section>

            <section>
              <SectionTitle>モニター</SectionTitle>
              <DisplayStatusSection />
            </section>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#9aa0aa]">{children}</h3>;
}
