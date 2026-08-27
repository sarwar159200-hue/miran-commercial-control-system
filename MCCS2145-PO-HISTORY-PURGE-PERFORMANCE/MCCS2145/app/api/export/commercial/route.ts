import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/mccs/auth";

export async function GET(request: Request) {
  const { supabase } = await requireUser();
  const url = new URL(request.url);
  if (url.searchParams.get("type") === "vdrl") {
    const search = (url.searchParams.get("q")||"").replace(/[,%()]/g," ").trim();
    const docs:any[]=[];
    for(let from=0;;from+=1000){
      let q:any = supabase.from("vdrl_documents").select("document_number,document_title,supplier_id,contractor_id,project_id,package_id,discipline,sub_discipline,document_type,current_stage,current_revision,planned_submit_date,actual_submit_date,planned_return_date,actual_return_date,resubmission_due_date,return_code,current_status,submission_variance,return_variance,days_overdue,responsible_party").eq("is_active",true).order("document_number");
      for (const [param,col] of [["supplier","supplier_id"],["contractor","contractor_id"],["project","project_id"],["package","package_id"],["stage","current_stage"],["status","current_status"],["code","return_code"],["discipline","discipline"],["sub_discipline","sub_discipline"],["document_type","document_type"],["revision","current_revision"],["responsible","responsible_party"]] as const) { const v=url.searchParams.get(param); if(v) q=q.eq(col,v); }
      const df=url.searchParams.get("date_from"),dt=url.searchParams.get("date_to"); if(df)q=q.gte("planned_submit_date",df); if(dt)q=q.lte("planned_submit_date",dt);
      if(search) q=q.or(`document_number.ilike.%${search}%,document_title.ilike.%${search}%,discipline.ilike.%${search}%`);
      const {data,error}=await q.range(from,from+999); if(error)throw new Error(error.message); const rows=data??[]; docs.push(...rows); if(rows.length<1000)break;
    }
    const [{data:vendors},{data:projects}] = await Promise.all([supabase.from("vendors").select("id,vendor_name"),supabase.from("projects").select("id,project_name,project_code")]);
    const vm=new Map((vendors??[]).map((x:any)=>[String(x.id),x.vendor_name])); const pm=new Map((projects??[]).map((x:any)=>[String(x.id),x.project_name||x.project_code]));
    const wb=new ExcelJS.Workbook(); wb.creator="MCCS"; wb.created=new Date(); const ws=wb.addWorksheet("VDRL Register");
    ws.columns=[
      ["Document Number","document_number",28],["Document Title","document_title",42],["Supplier","supplier",28],["Contractor","contractor",28],["Project / Package","package",30],["Discipline","discipline",18],["Sub-Discipline","sub_discipline",18],["Document Type","document_type",20],["Stage","current_stage",12],["Revision","current_revision",12],["Planned Submit","planned_submit_date",16],["Actual Submit","actual_submit_date",16],["Planned Return","planned_return_date",16],["Actual Return","actual_return_date",16],["Return Code","return_code",14],["Status","current_status",22],["Submission Variance","submission_variance",18],["Return Variance","return_variance",18],["Days Overdue","days_overdue",14],["Responsible Party","responsible_party",18]
    ].map((x:any)=>({header:x[0],key:x[1],width:x[2]}));
    (docs??[]).forEach((d:any)=>ws.addRow({...d,supplier:vm.get(String(d.supplier_id))||"",contractor:vm.get(String(d.contractor_id))||"",package:pm.get(String(d.package_id||d.project_id))||""}));
    ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}}; ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF07111F"}}; ws.views=[{state:"frozen",ySplit:1}]; ws.autoFilter={from:{row:1,column:1},to:{row:1,column:ws.columnCount}};
    const buffer=await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as BodyInit,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="MCCS-VDRL-Export-${new Date().toISOString().slice(0,10)}.xlsx"`}});
  }
  const [poR,vR,mR,iR,pR] = await Promise.all([
    supabase.from("purchase_orders").select("po_number,po_date,current_value,status,is_historical,vendors(vendor_name),currencies(code)").eq("is_deleted",false).order("po_date"),
    supabase.from("vendors").select("vendor_code,vendor_name,relationship_type,parent_vendor_id,is_active,is_deleted").eq("is_deleted",false).order("vendor_name"),
    supabase.from("payment_milestones").select("milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status,is_deleted,purchase_orders(po_number)").eq("is_deleted",false).order("planned_due_date"),
    supabase.from("invoices").select("invoice_number,invoice_date,invoice_amount,certified_amount,status,due_date,is_deleted").eq("is_deleted",false),
    supabase.from("payments").select("payment_date,paid_amount,payment_reference,bank_reference,is_deleted").eq("is_deleted",false),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MCCS";
  workbook.created = new Date();

  const pos = workbook.addWorksheet("Purchase Orders");
  pos.columns = [
    {header:"PO Number",key:"po_number",width:22},{header:"Vendor",key:"vendor",width:30},{header:"PO Date",key:"po_date",width:15},{header:"Currency",key:"currency",width:12},{header:"Current Value",key:"current_value",width:18},{header:"Status",key:"status",width:16},{header:"Historical",key:"historical",width:12}
  ];
  (poR.data??[]).forEach((r:any)=>pos.addRow({po_number:r.po_number,vendor:r.vendors?.vendor_name,po_date:r.po_date,currency:r.currencies?.code,current_value:Number(r.current_value||0),status:r.status,historical:r.is_historical?"Yes":"No"}));

  const vendors = workbook.addWorksheet("Vendors");
  vendors.columns=[{header:"Code",key:"code",width:15},{header:"Vendor",key:"vendor",width:32},{header:"Relationship",key:"rel",width:20},{header:"Status",key:"status",width:12}];
  (vR.data??[]).forEach((r:any)=>vendors.addRow({code:r.vendor_code,vendor:r.vendor_name,rel:r.relationship_type,status:r.is_active?"Active":"Inactive"}));

  const milestones = workbook.addWorksheet("Payment Milestones");
  milestones.columns=[{header:"PO",key:"po",width:22},{header:"Milestone",key:"name",width:32},{header:"%",key:"pct",width:10},{header:"Amount",key:"amt",width:18},{header:"Planned Due",key:"due",width:15},{header:"Payment Due",key:"pdue",width:15},{header:"Status",key:"status",width:15}];
  (mR.data??[]).forEach((r:any)=>milestones.addRow({po:r.purchase_orders?.po_number,name:r.milestone_name,pct:r.percentage,amt:r.fixed_amount,due:r.planned_due_date,pdue:r.payment_due_date,status:r.status}));

  const invoices = workbook.addWorksheet("Invoices");
  invoices.columns=[{header:"Invoice",key:"invoice",width:22},{header:"Date",key:"date",width:14},{header:"Invoice Amount",key:"amount",width:18},{header:"Certified",key:"certified",width:18},{header:"Due",key:"due",width:14},{header:"Status",key:"status",width:18}];
  (iR.data??[]).forEach((r:any)=>invoices.addRow({invoice:r.invoice_number,date:r.invoice_date,amount:r.invoice_amount,certified:r.certified_amount,due:r.due_date,status:r.status}));

  const payments = workbook.addWorksheet("Payments");
  payments.columns=[{header:"Date",key:"date",width:14},{header:"Paid Amount",key:"amount",width:18},{header:"Payment Ref",key:"ref",width:24},{header:"Bank Ref",key:"bank",width:24}];
  (pR.data??[]).forEach((r:any)=>payments.addRow({date:r.payment_date,amount:r.paid_amount,ref:r.payment_reference,bank:r.bank_reference}));

  for (const ws of workbook.worksheets) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: {row:1,column:1}, to:{row:1,column:ws.columnCount} };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="MCCS-Commercial-Export-${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  });
}
