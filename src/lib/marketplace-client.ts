const messages: Record<string,string>={
  already_applied:"You've already applied to this lead.",already_in_pipeline:"This opportunity is already in your pipeline.",
  lead_not_open:"This opportunity is not open for applications.",unauthenticated:"Sign in to manage applications and your pipeline.",
  application_withdrawn:"This application was withdrawn. Only the applicant can re-apply.",not_found:"That record was not found or is no longer available to you.",
};
/** No mock/localStorage fallback: server identity and Neon are authoritative. */
export async function marketplaceRequest<T>(op: string, params: Record<string,string>={}, method="GET", body?:unknown): Promise<T> {
  const response=await fetch(`/api/marketplace?${new URLSearchParams({ op,...params })}`,{
    method,cache:"no-store",credentials:"same-origin",headers:{ "content-type":"application/json" },
    ...(body !== undefined ? { body:JSON.stringify(body) } : {}),
  });
  const result=await response.json();
  if (!response.ok) throw new Error(messages[result.error] ?? "Could not complete the marketplace request.");
  return result.data as T;
}
