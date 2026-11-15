export const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}});
export const fail=(message,status=400)=>json({error:message},status);
export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export const readJson=async req=>{try{return await req.json()}catch{return null}};
export const cookie=(name,value,opts={})=>{
 const parts=[`${name}=${value}`,`Path=${opts.path||"/"}`,"HttpOnly","SameSite=Lax"];
 if(opts.maxAge!==undefined)parts.push(`Max-Age=${opts.maxAge}`);
 if(opts.secure)parts.push("Secure");
 return parts.join("; ");
};
export const getCookie=(req,name)=>{const s=req.headers.get("Cookie")||"";for(const part of s.split(";")){const i=part.indexOf("=");if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim()}return null};
export const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export const unb64u=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
export const cleanText=(v,max)=>String(v??"").replace(/[\u0000-\u001f<>\\]/g,"").trim().replace(/\s+/g," ").slice(0,max);
