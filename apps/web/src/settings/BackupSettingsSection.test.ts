// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { BackupSettingsSection } from "./BackupSettingsSection";
import { SETTINGS_STORAGE_KEYS } from "./settingsBackup";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("BackupSettingsSection", () => {
  it("エクスポートエラーをセクション内に表示する", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS[0], "invalid-json");
    render(createElement(BackupSettingsSection));

    fireEvent.click(screen.getByRole("button", { name: "JSON をダウンロード" }));

    expect(screen.getByText(/保存値が正しい JSON ではありません/).textContent).toContain(
      SETTINGS_STORAGE_KEYS[0],
    );
  });
});
