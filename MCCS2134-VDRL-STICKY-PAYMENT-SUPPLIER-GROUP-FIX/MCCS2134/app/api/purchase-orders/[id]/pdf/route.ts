import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
export const dynamic="force-dynamic";

function dateText(v?:string|null){if(!v)return "";const d=new Date(v+(/T/.test(v)?"":"T00:00:00"));if(Number.isNaN(d.getTime()))return v;return `${String(d.getDate()).padStart(2,"0")}/${d.toLocaleString("en-US",{month:"short"})}/${d.getFullYear()}`}
function clean(v:any){return v==null?"":String(v)}
function money(v:any){return Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function wrap(text:string,max:number){const words=text.replace(/\s+/g," ").trim().split(" ");const lines:string[]=[];let line="";for(const w of words){const n=line?`${line} ${w}`:w;if(n.length>max){if(line)lines.push(line);line=w}else line=n}if(line)lines.push(line);return lines}
function white(page:any,x:number,y:number,w:number,h:number){page.drawRectangle({x,y,width:w,height:h,color:rgb(1,1,1)})}
function text(page:any,font:any,value:any,x:number,y:number,size=5.3,maxWidth?:number){let s=clean(value);if(!s)return;while(maxWidth&&font.widthOfTextAtSize(s,size)>maxWidth&&size>3.5)size-=0.2;page.drawText(s,{x,y,size,font,color:rgb(0,0,0)})}
function multiline(page:any,font:any,value:any,x:number,y:number,maxChars:number,size=5.1,leading=6,maxLines=5){const lines=wrap(clean(value),maxChars).slice(0,maxLines);lines.forEach((l,i)=>text(page,font,l,x,y-i*leading,size));}

export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const s=await createClient();if(!s)return new Response("Not configured",{status:500});const {data:{user}}=await s.auth.getUser();if(!user)return new Response("Unauthorized",{status:401});
 const {data:po,error}=await s.from("purchase_orders").select("*").eq("id",id).eq("is_deleted",false).maybeSingle();if(error||!po)return new Response("PO not found",{status:404});
 const [vr,cr,itemsr]=await Promise.all([s.from("vendors").select("vendor_name,legal_name,address,phone,email,contact_person").eq("id",po.vendor_id).maybeSingle(),s.from("currencies").select("code").eq("id",po.currency_id).maybeSingle(),s.from("purchase_order_items").select("*").eq("purchase_order_id",id).order("sequence_no")]);
 const vendor=vr.data||{},currency=cr.data?.code||"",items=itemsr.data??[];
 const template=await fs.readFile(path.join(process.cwd(),"public","Miran_PO_Template.pdf"));const pdf=await PDFDocument.load(template);const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);const page=pdf.getPage(0);
 // Remove the sample PO data while preserving the approved Miran layout/lines.
 white(page,92,638,253,67);white(page,399,638,187,67);white(page,43,582,541,33);white(page,476,548,110,34);white(page,95,468,230,72);white(page,365,468,220,72);white(page,141,368,187,91);white(page,327,400,125,92);
 // Header/vendor block
 text(page,bold,vendor.vendor_name||vendor.legal_name,95,697,5.2,245);multiline(page,font,vendor.address,95,686,72,4.8,5.5,2);text(page,font,vendor.phone,95,674,4.8,245);text(page,font,vendor.email,95,650,4.6,245);text(page,font,vendor.contact_person,95,662,4.8,245);
 text(page,bold,po.po_number,402,697,5.4,180);text(page,font,po.pr_number,402,686,5.0,180);text(page,font,dateText(po.initial_po_date||po.po_date),402,675,5.0,180);text(page,font,dateText(po.revised_po_date),402,664,5.0,180);text(page,font,currency,402,653,5.0,180);text(page,font,po.prepared_by||po.approved_by_text,402,642,5.0,180);
 // Item row - template supports a compact commercial summary; additional item text is stacked in the description cell.
 const displayItems=items.length?items.slice(0,4):[{item_code:"NA",description:po.notes||"Purchase Order",site:"MEL",uom:"Each",quantity:1,unit_cost:Number(po.original_value||0)}];
 displayItems.forEach((it:any,i:number)=>{const yy=607-i*6;text(page,font,it.item_code||"NA",44,yy,4.2,27);text(page,font,it.description||"",75,yy,4.0,250);text(page,font,it.site||"MEL",334,yy,4.1,16);text(page,font,it.uom||"Each",353,yy,4.1,18);text(page,font,Number(it.quantity||0).toFixed(2),374,yy,4.1,28);text(page,font,currency,404,yy,4.0,18);text(page,font,money(it.unit_cost),425,yy,4.0,55);text(page,font,currency,486,yy,4.0,18);text(page,font,money(Number(it.quantity||0)*Number(it.unit_cost||0)),510,yy,4.0,73)});
 const itemSubtotal=items.length?items.reduce((a:number,it:any)=>a+Number(it.quantity||0)*Number(it.unit_cost||0),0):Number(po.original_value||0);const discount=Number(po.discount||0),extra=Number(po.extra_cost||0),total=itemSubtotal-discount+extra;
 text(page,font,currency,480,574,4.2);text(page,font,money(itemSubtotal),505,574,4.2,78);text(page,font,currency,480,566,4.2);text(page,font,money(discount),505,566,4.2,78);text(page,font,currency,480,558,4.2);text(page,font,money(extra),505,558,4.2,78);text(page,bold,currency,480,550,4.3);text(page,bold,money(total),505,550,4.3,78);
 // Shipping / billing
 multiline(page,bold,po.shipping_address||"Miran Energy LTD\nSulaimaniyah-Kirkuk Road, Postal Code: 46001, Iraq",100,526,70,4.5,5.2,5);multiline(page,font,po.billing_address||'TAURUS ARM Co. for Power Generation & Oil Services and Transportation Limited ("TAURUS") for Miran Project Miran Energy LTD.',370,526,67,4.2,5.0,6);
 // Terms & Conditions value column
 multiline(page,font,po.payment_terms,145,450,55,4.6,5.4,3);multiline(page,font,po.delivery_terms||dateText(po.delivery_due_date),145,434,55,4.6,5.4,3);text(page,font,po.incoterm,145,414,4.6,180);text(page,font,po.origin_of_goods,145,403,4.6,180);multiline(page,font,po.warranty,145,392,55,4.5,5.2,3);text(page,font,po.quote_ref,145,376,4.6,180);text(page,font,dateText(po.quote_date),145,365,4.6,180);text(page,font,po.rfq_number,145,354,4.6,180);
 multiline(page,font,po.other_instruction,58,340,110,5.0,6,20);
 // Pages 2 and 3 are preserved exactly from the controlled Miran Terms & Conditions template.
 const out=await pdf.save();const body=out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength) as ArrayBuffer;return new Response(body,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${String(po.po_number).replace(/[^A-Za-z0-9._-]+/g,"_")}.pdf"`,"Cache-Control":"no-store"}})
}
