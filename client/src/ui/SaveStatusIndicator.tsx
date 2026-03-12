/** SaveStatusIndicator props. */
interface Props {
  status: "pending" | "synced" | "error";
  lastSavedAt: string | null;
}

/** Status colours matching the PRD HUD palette. */
const STATUS_COLORS = {
  synced: "#4aaf4a",
  pending: "#c8a020",
  error: "#c04040",
} as const;

/**
 * Compact save status indicator showing a coloured dot
 * and timestamp. Sits inside the ResourceBar, right-aligned.
 */
export function SaveStatusIndicator({ status, lastSavedAt }: Props) {
  const color = STATUS_COLORS[status];
  let text = "SAVED";

  if (status === "pending") {
    text = "SAVING...";
  } else if (status === "error") {
    text = "ERROR";
  }

  const timeStr = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  if (status === "synced" && timeStr) {
    text = `SAVED ${timeStr}`;
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}`,
        }}
      />
      <span style={{ color: "#888870", fontSize: "7px" }}>{text}</span>
    </div>
  );
}
