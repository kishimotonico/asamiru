// ─── モニター電源連動 ───────────────────────────────────────────────

export type DisplayConnection = "connected" | "disconnected" | "unknown";
export type DisplayPower = "on" | "off" | "unknown";
export type DesiredDisplayPower = "on" | "standby";
export type DisplayCommandPhase = "idle" | "commanding" | "settling";
export type DisplayPowerOrigin = "external" | "command" | "unknown";
export type DisplayObservationTrigger = "initial" | "poll" | "hotplug" | "command-confirmation";
export type DisplayErrorCode =
  | "ddc_timeout"
  | "display_not_found"
  | "unexpected_output"
  | "ddc_failed"
  | "not_enabled";

export type DisplayCapabilities = {
  canReadConnection: boolean;
  canReadPower: boolean;
  canSetPowerOn: boolean;
  canSetStandby: boolean;
};

export type DisplayStatus = {
  /** DRM connector 名（例: HDMI-A-1）*/
  connector: string;
  connection: DisplayConnection;
  power: DisplayPower;
  powerOrigin: DisplayPowerOrigin;
  desiredPower: DesiredDisplayPower | null;
  commandPhase: DisplayCommandPhase;
  capabilities: DisplayCapabilities;
  lastObservedAt: string | null;
  lastCommandAt: string | null;
  error: { code: DisplayErrorCode; message: string; occurredAt: string } | null;
};

export type DisplayEvent = {
  status: DisplayStatus;
  trigger: DisplayObservationTrigger;
};

/** GET /api/system/display のレスポンス */
export type DisplayInfoResponse = { enabled: false } | ({ enabled: true } & DisplayStatus);
