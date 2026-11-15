// Telefone brasileiro com DDD. Guardamos sempre só os dígitos (ex.: 67996123456), sem +55.
const DDDS=new Set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" "));
export function normalizePhone(raw){
 let d=String(raw??"").replace(/\D/g,"");
 if(d.length>=12&&d.startsWith("55"))d=d.slice(2); // aceita +55
 if(d.length<10||d.length>11)return null;
 if(!DDDS.has(d.slice(0,2)))return null;
 const num=d.slice(2);
 if(d.length===11&&num[0]!=="9")return null; // celular: 9 dígitos começando com 9
 if(d.length===10&&!/[2-9]/.test(num[0]))return null; // fixo: 8 dígitos
 if(/^(\d)\1+$/.test(num))return null; // 99999999, 00000000...
 return d;
}
export function formatPhone(d){
 d=String(d||"");
 if(d.length===11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
 if(d.length===10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
 return d;
}
export const PHONE_ERROR="Informe um telefone válido com DDD (ex.: 67 99612-3456).";
