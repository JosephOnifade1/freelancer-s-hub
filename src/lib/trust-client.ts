const messages: Record<string, string> = {
  unauthenticated: "Sign in to manage notifications and reports.",
  forbidden: "You do not have permission to perform this action.",
  report_limit:
    "You've filed 10 reports in the last 24 hours. Please wait before filing more.",
  not_found: "That record was not found or is no longer available to you.",
};
/** No client persistence fallback: server identity and Neon are authoritative. */
export async function trustRequest<T>(
  op: string,
  params: Record<string, string> = {},
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(
    `/api/trust?${new URLSearchParams({ op, ...params })}`,
    {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      messages[result.error] ??
        "Could not complete the notification or report request.",
    );
  return result.data as T;
}
