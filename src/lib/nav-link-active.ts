/**
 * Active-state rule shared by the native nav link and the sidebar.
 *
 * React Router's `NavLink` activates on a plain `startsWith`, which also lights
 * `/new` up on `/newsletter`. Requiring a segment boundary is the behaviour the
 * sidebar actually wants: `/l` stays active on `/l/lead-1`, but `/new` does not
 * claim `/newsletter`.
 */
export function isNavLinkActive(pathname: string, target: string, end?: boolean): boolean {
  if (pathname === target) return true;
  // "/" prefixes every path, so it only ever matches exactly.
  if (target === "/" || end) return false;
  return pathname.startsWith(target.endsWith("/") ? target : `${target}/`);
}
