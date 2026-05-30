import { atomWithStorage } from "jotai/utils";

export type ModuleId = "clock" | "schedule" | "trains" | "weather";

export const ALL_MODULES: ModuleId[] = ["clock", "schedule", "trains", "weather"];

export const enabledModulesAtom = atomWithStorage<ModuleId[]>("asamiru-enabled-modules", ALL_MODULES);
