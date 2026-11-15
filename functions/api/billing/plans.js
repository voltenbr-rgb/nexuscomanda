import {json} from "../../_lib/http.js";

// Links públicos oficiais de checkout/assinatura do Mercado Pago.
// Não são credenciais: tokens e segredos nunca devem ser enviados ao navegador.
const CHECKOUT_URLS={
 starter:"https://mpago.la/183JsDU",
 pro:"https://mpago.la/2hu3vNa",
 business:"https://mpago.la/2FCEbxr"
};

export async function onRequestGet(c){
 const q=await c.env.DB.prepare("SELECT id,name,description,price_cents,interval_days,max_stores,features_json FROM plans WHERE active=1 ORDER BY price_cents").all();
 return json({plans:(q.results||[]).map(p=>({...p,features:JSON.parse(p.features_json),checkout_url:CHECKOUT_URLS[p.id]||null}))});
}
