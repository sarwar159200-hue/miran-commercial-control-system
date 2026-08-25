import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/mccs/auth";

type Tone = "danger" | "warn" | "info";
type Consequence = { label: string; value: string | number; tone?: Tone };

async function countRows(supabase:any, table:string, field:string, id:string, activeFilter?:"is_deleted") {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq(field, id);
  if (activeFilter) q = q.eq(activeFilter, false);
  const { count, error } = await q;
  if (error) return 0;
  return count || 0;
}

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireSuperAdmin();
    const entity = req.nextUrl.searchParams.get("entity");
    const id = req.nextUrl.searchParams.get("id");
    if (!entity || !id) return NextResponse.json({ error: "Entity and ID are required." }, { status: 400 });
    const c: Consequence[] = [];
    if (entity === "vendor") {
      const [projects,pos,invoices,docs] = await Promise.all([
        countRows(supabase,"projects","vendor_id",id,"is_deleted"),countRows(supabase,"purchase_orders","vendor_id",id,"is_deleted"),countRows(supabase,"invoices","vendor_id",id,"is_deleted"),countRows(supabase,"documents","vendor_id",id,"is_deleted")]);
      c.push({label:"Projects / Packages",value:projects,tone:projects?"warn":"info"},{label:"Purchase Orders",value:pos,tone:pos?"danger":"info"},{label:"Invoices",value:invoices,tone:invoices?"danger":"info"},{label:"Documents",value:docs,tone:docs?"warn":"info"});
    } else if (entity === "project") {
      const [pos,docs]=await Promise.all([countRows(supabase,"purchase_orders","project_id",id,"is_deleted"),countRows(supabase,"documents","project_id",id,"is_deleted")]);
      c.push({label:"Purchase Orders",value:pos,tone:pos?"danger":"info"},{label:"Documents",value:docs,tone:docs?"warn":"info"});
    } else if (entity === "purchase_order") {
      const [milestones,invoices,payments,docs,items]=await Promise.all([countRows(supabase,"payment_milestones","purchase_order_id",id,"is_deleted"),countRows(supabase,"invoices","purchase_order_id",id,"is_deleted"),countRows(supabase,"payments","purchase_order_id",id,"is_deleted"),countRows(supabase,"documents","purchase_order_id",id,"is_deleted"),countRows(supabase,"purchase_order_items","purchase_order_id",id)]);
      c.push({label:"Payment Milestones",value:milestones,tone:milestones?"warn":"info"},{label:"Invoices",value:invoices,tone:invoices?"danger":"info"},{label:"Payments",value:payments,tone:payments?"danger":"info"},{label:"Documents",value:docs,tone:docs?"warn":"info"},{label:"PO Line Items",value:items,tone:items?"warn":"info"});
    } else if (entity === "milestone") {
      const [invoices,docs]=await Promise.all([countRows(supabase,"invoices","payment_milestone_id",id,"is_deleted"),countRows(supabase,"documents","milestone_id",id,"is_deleted")]);
      c.push({label:"Linked Invoices",value:invoices,tone:invoices?"danger":"info"},{label:"Documents",value:docs,tone:docs?"warn":"info"},{label:"Allocation impact",value:"PO allocation will recalculate",tone:"warn"});
    } else if (entity === "invoice") {
      const [payments,docs,approvals]=await Promise.all([countRows(supabase,"payments","invoice_id",id,"is_deleted"),countRows(supabase,"documents","invoice_id",id,"is_deleted"),countRows(supabase,"invoice_approvals","invoice_id",id)]);
      c.push({label:"Payments",value:payments,tone:payments?"danger":"info"},{label:"Documents",value:docs,tone:docs?"warn":"info"},{label:"Approval History",value:approvals,tone:approvals?"warn":"info"},{label:"Report impact",value:"Invoice KPIs will recalculate",tone:"warn"});
    } else if (entity === "payment") {
      c.push({label:"Financial impact",value:"Paid totals will recalculate",tone:"danger"},{label:"Audit trail",value:"Retained",tone:"info"});
    } else if (entity === "document") {
      c.push({label:"MCCS register",value:"Record hidden",tone:"warn"},{label:"Google Drive file",value:"Kept in Drive",tone:"info"},{label:"Audit trail",value:"Retained",tone:"info"});
    } else return NextResponse.json({ error: "Unsupported entity." }, { status: 400 });
    return NextResponse.json({ consequences: c });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Super Admin permission is required." }, { status: 403 });
  }
}
