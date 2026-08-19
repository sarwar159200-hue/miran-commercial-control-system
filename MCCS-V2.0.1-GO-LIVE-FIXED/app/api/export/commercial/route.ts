import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/mccs/auth";

export async function GET() {
  const { supabase } = await requireUser();
  const [poR,vR,mR] = await Promise.all([
    supabase.from("purchase_orders").select("po_number,po_date,current_value,status,is_historical,vendors(vendor_name),currencies(code)").eq("is_deleted",false).order("po_date"),
    supabase.from("vendors").select("vendor_code,vendor_name,relationship_type,parent_vendor_id,is_active").order("vendor_name"),
    supabase.from("payment_milestones").select("milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status,purchase_orders(po_number)").order("planned_due_date"),
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
