import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DisplayConnection } from "@asamiru/shared";

const DRM_ROOT = "/sys/class/drm";

export type ConnectorStatus = {
  name: string;
  connectorId: string | null;
  status: DisplayConnection;
};

function readTrimmed(path: string): string | null {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

/** DRM connector 一覧を読む。connectorName を指定するとフィルタする */
export function readConnectorStatus(connectorName: string): ConnectorStatus | null {
  let names: string[];
  try {
    names = readdirSync(DRM_ROOT).filter((n) => /-HDMI-A-\d+$/.test(n));
  } catch {
    return null;
  }

  // card1-HDMI-A-1 のようなプレフィックス付き名前か、HDMI-A-1 だけの場合も許容
  const matched = names.find((n) => n === connectorName || n.endsWith(`-${connectorName}`));
  if (!matched) return null;

  const raw = readTrimmed(join(DRM_ROOT, matched, "status"));
  const status: DisplayConnection =
    raw === "connected" ? "connected" : raw === "disconnected" ? "disconnected" : "unknown";

  return {
    name: matched,
    connectorId: readTrimmed(join(DRM_ROOT, matched, "connector_id")),
    status,
  };
}
