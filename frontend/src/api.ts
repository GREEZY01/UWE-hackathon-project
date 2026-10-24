export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message =
        typeof body.detail === "string"
          ? body.detail
          : "Please check the request fields.";
    } catch {
      /* Keep status-based error. */
    }
    throw new Error(message);
  }
  return response.json();
}
export function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete this request. Please retry.";
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function pct(rate: { rate: number | null }) {
  return rate.rate === null ? "N/A" : `${(rate.rate * 100).toFixed(1)}%`;
}
export const pretty = (text: string) => text.replaceAll("_", " ");
