interface Props {
  status: "pending" | "synced" | "error";
  lastSavedAt: string | null;
}

export function SaveStatusIndicator({ status, lastSavedAt }: Props) {
  let color = "#4aaf4a"; // synced
  let text = "SAVED";

  if (status === "pending") {
    color = "#c8a020";
    text = "SAVING...";
  } else if (status === "error") {
    color = "#c04040";
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
      <div style={{ backgroundColor: color }} className="w-2 h-2" />
      <span style={{ color: "#888870", fontSize: "7px" }}>{text}</span>
    </div>
  );
}
