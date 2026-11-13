/** Hermetic adapter/navigation tests, no live backend. */
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {fetchNotifications,fetchUnreadNotificationCount,markNotificationRead,markAllNotificationsRead,notificationLink,type AppNotification} from "./notifications";
const fetcher=vi.fn();
beforeEach(()=>{vi.stubGlobal("fetch",fetcher);fetcher.mockResolvedValue({ok:true,json:async()=>({data:[]})});});
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks();});
describe("Neon notification adapter",()=>{
 it("retains signatures but never sends client uid as authority",async()=>{await fetchNotifications("forged",20);expect(fetcher.mock.calls[0][0]).toBe("/api/trust?op=notifications&limit=20");expect(fetcher.mock.calls[0][1]).toMatchObject({cache:"no-store",credentials:"same-origin"});await fetchUnreadNotificationCount("forged");expect(fetcher.mock.calls[1][0]).toBe("/api/trust?op=unread");});
 it("single and bulk read call distinct scoped endpoints",async()=>{await markNotificationRead("notice");expect(fetcher.mock.calls[0][0]).toBe("/api/trust?op=read&id=notice");expect(fetcher.mock.calls[0][1].method).toBe("PATCH");await markAllNotificationsRead("forged");expect(fetcher.mock.calls[1][0]).toBe("/api/trust?op=read-all");});
 it("does not convert server errors to an empty inbox/count",async()=>{fetcher.mockResolvedValue({ok:false,json:async()=>({error:"unavailable"})});await expect(fetchNotifications("uid")).rejects.toThrow();await expect(fetchUnreadNotificationCount("uid")).rejects.toThrow();});
 it.each(["comment","reply","upvote"])("keeps %s post navigation",type=>{expect(notificationLink({type,contextId:"post"} as AppNotification)).toBe("/p/post");});
 it("follow links use public actor username and safe missing-actor fallback",()=>{expect(notificationLink({type:"follow",actor:{uid:"id",username:"name"}} as AppNotification)).toBe("/f/name");expect(notificationLink({type:"follow"} as AppNotification)).toBe("/");});
 it.each(["application_received","application_withdrawn"])("owner event %s goes to inbox",type=>{expect(notificationLink({type} as AppNotification)).toBe("/applications");});
 it.each(["application_accepted","application_rejected"])("applicant event %s goes to lead or safe fallback",type=>{expect(notificationLink({type,contextId:"lead"} as AppNotification)).toBe("/l/lead");expect(notificationLink({type} as AppNotification)).toBe("/applications");});
});
