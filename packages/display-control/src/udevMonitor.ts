import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type HotplugEvent = { connectorId: string | null };

function parseUdevBlock(block: string[]): Record<string, string> {
  const props: Record<string, string> = {};
  for (const line of block) {
    const idx = line.indexOf("=");
    if (idx > 0) props[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return props;
}

/** udevadm monitor --kernel --subsystem-match=drm --property を起動し、
 *  DRM hotplug event 受信ごとに onHotplug を呼ぶ。
 *  子プロセスの起動失敗・実行時エラーは onError へ通知し、onExit を resolve する
 *  （呼び出し元の再起動フローへ委ねるため）。
 *  返値の stop() で子プロセスを終了する。 */
export function startUdevMonitor(
  onHotplug: (event: HotplugEvent) => void,
  onError?: (err: Error) => void,
): {
  stop: () => void;
  onExit: Promise<void>;
} {
  let resolveExitFn!: () => void;
  const onExit = new Promise<void>((resolve) => {
    resolveExitFn = resolve;
  });
  let exited = false;
  const resolveExit = () => {
    if (exited) return;
    exited = true;
    resolveExitFn();
  };

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn("udevadm", ["monitor", "--kernel", "--subsystem-match=drm", "--property"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    // spawn 自体が同期的に失敗するケース（通常は error イベント経由だが念のため）
    onError?.(err instanceof Error ? err : new Error(String(err)));
    resolveExit();
    return { stop: () => {}, onExit };
  }

  child.stdin.end();

  let buffer = "";
  let block: string[] = [];

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length > 0) {
        block.push(line);
        continue;
      }
      const props = parseUdevBlock(block);
      block = [];
      if (props.HOTPLUG === "1") {
        onHotplug({ connectorId: props.CONNECTOR ?? null });
      }
    }
  });

  // error イベント（udevadm 不在・権限エラー等）。未処理にするとプロセスがクラッシュする
  child.once("error", (err) => {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    resolveExit();
  });

  child.once("exit", () => {
    resolveExit();
  });

  return {
    stop: () => child.kill("SIGTERM"),
    onExit,
  };
}
