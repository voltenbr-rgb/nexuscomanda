import {json,cookie} from "../../_lib/http.js";
export async function onRequestPost(c){return json({ok:true},200,{"set-cookie":cookie("nexus_session","",{maxAge:0,secure:new URL(c.request.url).protocol==="https:"})})}
