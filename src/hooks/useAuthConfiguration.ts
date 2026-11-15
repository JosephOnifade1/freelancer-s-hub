import {useQuery} from "@tanstack/react-query";
export interface AuthConfiguration {emailDelivery:"file"|"email"|"unavailable"}
export function useAuthConfiguration(){
 return useQuery<AuthConfiguration>({queryKey:["auth-configuration"],queryFn:async()=>{
  const response=await fetch("/api/auth-configuration",{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("auth_configuration_unavailable");return response.json();
 },retry:1,staleTime:30000});
}
