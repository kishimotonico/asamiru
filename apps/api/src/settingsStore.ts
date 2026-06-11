import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type SettingsRecord = Record<string, unknown>;

function dataDirectory(): string {
  return process.env.ASAMIRU_DATA_DIR ?? "./data";
}

export function settingsFilePath(): string {
  return path.join(dataDirectory(), "settings.json");
}

function isSettingsRecord(value: unknown): value is SettingsRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readSettings(): Promise<SettingsRecord> {
  try {
    const raw = await fs.readFile(settingsFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isSettingsRecord(parsed)) {
      throw new TypeError("settings.json must contain a JSON object");
    }
    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {};
    throw error;
  }
}

export async function writeSettings(settings: SettingsRecord): Promise<void> {
  const targetPath = settingsFilePath();
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(directory, `.settings.json.${process.pid}.${randomUUID()}.tmp`);

  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
