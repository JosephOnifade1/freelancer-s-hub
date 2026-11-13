/** No mock catalog or alternate persistence on failures. */
export async function badgeRequest<T>(uid?: string): Promise<T> {
  const response = await fetch(
    `/api/badges${uid === undefined ? "" : `?${new URLSearchParams({ uid })}`}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (!response.ok) throw new Error("Could not load badges. Please try again.");
  return (await response.json()).data as T;
}
