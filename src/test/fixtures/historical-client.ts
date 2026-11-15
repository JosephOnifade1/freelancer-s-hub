import {MockSupabaseClient} from "./mockSupabase";
/** Test-only historical persistence fixture. Never import from runtime. */
// Historical fixture intentionally retains its legacy dynamically shaped query API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const historicalClient:any=new MockSupabaseClient();
