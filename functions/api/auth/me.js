import {json} from "../../_lib/http.js";
import {session,requireTenant,storeLimit} from "../../_lib/auth.js";
export async function onRequestGet(c){
 const s=await session(c);if(!s)return json({authenticated:false});
 if(s.role==="master")return json({authenticated:true,role:"master"});
 const a=await requireTenant(c,{allowExpired:true});if(a.error)return json({authenticated:false},401);
 const until=a.tenant.status==="trial"?a.tenant.trial_expires_at:a.tenant.license_expires_at;
 const {password_hash,password_salt,...tenant}=a.tenant;
 return json({authenticated:true,role:"tenant",tenant,expires_at:until,max_stores:await storeLimit(c.env,a.tenant),blocked:["expired","suspended"].includes(a.tenant.status)});
}
