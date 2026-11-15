import {useAuthConfiguration} from "@/hooks/useAuthConfiguration";
export function EmailDeliveryNotice(){
 const {data,isError}=useAuthConfiguration();
 if(isError)return <p role="status" className="text-sm text-muted-foreground">Could not check email delivery. No message delivery has been confirmed.</p>;
 if(!data)return null;
 if(data.emailDelivery==="file")return <p role="status" className="text-sm text-muted-foreground">Local email mode: no email is sent to your inbox. Verification and reset links are saved privately in .local/auth-outbox on the computer running Borynx. Open the newest message there. Seeded Demo Accounts are already verified.</p>;
 if(data.emailDelivery==="unavailable")return <p role="status" className="text-sm text-amber-600">Email delivery is not configured. New accounts need verification before login. Configure local file delivery or an email gateway; verified accounts and ready Demo Accounts can still log in.</p>;
 return null;
}
