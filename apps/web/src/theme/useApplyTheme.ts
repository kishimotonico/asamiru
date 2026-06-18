import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { type EffectiveTheme, themeAtom } from "./themeAtom";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): EffectiveTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * テーマ設定を解決して `document.documentElement[data-theme]` に反映する。
 * `system` のときは OS 設定（light/dark のみ）を購読し、変更に追従する。
 * 実効テーマ（light/dawn/dark）を返す。
 */
export function useApplyTheme(): EffectiveTheme {
  const preference = useAtomValue(themeAtom);
  const [systemValue, setSystemValue] = useState<EffectiveTheme>(systemTheme);

  useEffect(() => {
    if (preference !== "system") return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystemValue(mql.matches ? "dark" : "light");
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preference]);

  const effective: EffectiveTheme = preference === "system" ? systemValue : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = effective;
  }, [effective]);

  return effective;
}
