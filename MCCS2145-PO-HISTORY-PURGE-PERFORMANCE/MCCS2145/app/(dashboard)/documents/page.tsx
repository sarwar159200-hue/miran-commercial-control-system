import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import { deleteDocumentRecord } from "../_actions/commercial";
export const dynamic = "force-dynamic";

function canPreview(name: string) { return /\.(pdf|png|jpe?g|gif|webp|txt|csv)$/i.test(name || ""); }
function prettyCategory(key:string){return ({srf:"SRF",offer:"O (Offers)",invoice:"Invoices",po:"Purchase Orders",supporting:"Supporting Documents",other:"Other Documents"} as Record<string,string>)[key]||"Other Documents";}
function categoryKey(x:any){const dc=String(x.document_category||"").toLowerCase();const dt=String(x.document_type||"").toLowerCase();if(dc==="srf")return"srf";if(dc==="invoice")return"invoice";if(dc==="po")return"po";if(dt.includes("offer"))return"offer";if(dt.includes("support"))return"supporting";return"other";}
function fmtSize(v:any){const n=Number(v||0);if(!n)return"—";if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;if(n<1024*1024*1024)return`${(n/1024/1024).toFixed(2)} MB`;return`${(n/1024/1024/1024).toFixed(2)} GB`;}
function fmtDate(v:any){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function docsQuery(vendor:string,project:string,category:string,file:string=""){const p=new URLSearchParams();if(vendor)p.set("vendor",vendor);if(project)p.set("project",project);if(category)p.set("category",category);if(file)p.set("file",file);return p.toString();}

export default async function Page({ searchParams }: { searchParams: Promise<{ uploaded?: string;deleted?:string;error?:string;vendor?:string;project?:string;category?:string;file?:string }> }) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;
  const { data: { user } } = await s.auth.getUser();
  const { data: me } = user ? await s.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle() : { data: null as any };
  const isSuperAdmin = Boolean(me?.is_super_admin || user?.email?.toLowerCase() === "sarwar.khalid@miranenergy.com");

  const [r,vr,pr] = await Promise.all([
    s.from("documents").select("id,document_title,document_type,document_category,file_name,revision,purchase_order_id,invoice_id,vendor_id,project_id,google_drive_file_id,is_historical,uploaded_at,storage_provider,storage_status,file_size,is_deleted").eq("is_deleted", false).neq("document_category","chat_voice").order("uploaded_at", { ascending: false }),
    s.from("vendors").select("id,vendor_name,is_active").order("vendor_name"),
    s.from("projects").select("id,project_name,project_code,vendor_id,is_active").order("project_name")
  ]);
  const rows=r.data??[];
  const vendors=(vr.data??[]).filter((x:any)=>x.is_active!==false);
  const projects=(pr.data??[]).filter((x:any)=>x.is_active!==false);
  const vendorMap=new Map<string,string>(vendors.map((x:any)=>[String(x.id),String(x.vendor_name||"Unnamed Supplier")]));
  const projectMap=new Map<string,string>(projects.map((x:any)=>[String(x.id),String(x.project_name||x.project_code||"Unnamed Package")]));

  const vendorCounts=new Map<string,number>(); rows.forEach((x:any)=>{if(x.vendor_id)vendorCounts.set(String(x.vendor_id),(vendorCounts.get(String(x.vendor_id))||0)+1)});
  const initialVendor=String(q.vendor||rows.find((x:any)=>x.vendor_id)?.vendor_id||vendors[0]?.id||"");
  const vendorProjects=projects.filter((x:any)=>String(x.vendor_id)===initialVendor);
  const projectCounts=new Map<string,number>(); rows.filter((x:any)=>String(x.vendor_id)===initialVendor).forEach((x:any)=>{if(x.project_id)projectCounts.set(String(x.project_id),(projectCounts.get(String(x.project_id))||0)+1)});
  const initialProject=String(q.project||rows.find((x:any)=>String(x.vendor_id)===initialVendor&&x.project_id)?.project_id||vendorProjects[0]?.id||"");
  const projectRows=rows.filter((x:any)=>(!initialVendor||String(x.vendor_id)===initialVendor)&&(!initialProject||String(x.project_id)===initialProject));
  const categoryCounts=new Map<string,number>(); projectRows.forEach((x:any)=>{const k=categoryKey(x);categoryCounts.set(k,(categoryCounts.get(k)||0)+1)});
  const categoryOrder=["srf","offer","invoice","po","supporting","other"];
  const initialCategory=String(q.category||categoryOrder.find(k=>(categoryCounts.get(k)||0)>0)||"other");
  const visibleRows=projectRows.filter((x:any)=>categoryKey(x)===initialCategory);
  const selectedFile=visibleRows.find((x:any)=>String(x.id)===String(q.file||""))||visibleRows[0]||null;
  const selectedVendorName=vendorMap.get(initialVendor)||"Suppliers / Contractors";
  const selectedProjectName=projectMap.get(initialProject)||"Select package";
  const selectedUrl=selectedFile?`/api/documents/${selectedFile.id}/file`:"";

  return <div className="mx-auto max-w-[1700px]">
    {q.deleted?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Document record deleted from MCCS. The Google Drive file has been retained.</div>:null}
    {q.error?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error}</div>:null}
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">MCCS • Secure Repository</div><h1 className="mt-2 text-3xl font-bold">Documents</h1><p className="mt-2 text-sm text-slate-500">Google Drive-backed commercial repository presented through MCCS. Browse Supplier → Package → Document Category → File without separate Drive permissions.</p></div><div className="flex gap-2"><Link href="/documents/new" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900">Metadata Only</Link><Link href="/documents/upload" className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white dark:bg-blue-600">Upload Document</Link></div></div>
    {q.uploaded?<div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">File uploaded to Google Drive and registered successfully.</div>:null}
    {r.error?<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{r.error.message}</div>:null}

    <section className="mccs-card mt-7 overflow-hidden rounded-2xl">
      <div className="grid min-h-[650px] xl:grid-cols-[280px_1fr_410px]">
        <aside className="border-r bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">Suppliers / Contractors</div>
          <div className="space-y-1">{vendors.filter((v:any)=>(vendorCounts.get(String(v.id))||0)>0).map((v:any)=>{const id=String(v.id),active=id===initialVendor;return <Link key={id} href={`/documents?${docsQuery(id,"","","")}`} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active?"bg-blue-600 text-white shadow-sm":"hover:bg-white dark:hover:bg-slate-900"}`}><span className="flex min-w-0 items-center gap-2"><span>{active?"▾":"›"}</span><span className="truncate">{v.vendor_name}</span></span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active?"bg-white/20":"bg-slate-200 text-slate-600 dark:bg-slate-800"}`}>{vendorCounts.get(id)||0}</span></Link>})}</div>
          <div className="my-4 border-t dark:border-slate-800"/>
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">What we have with them</div>
          <div className="space-y-1">{vendorProjects.map((p:any)=>{const id=String(p.id),active=id===initialProject;return <Link key={id} href={`/documents?${docsQuery(initialVendor,id,"","")}`} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${active?"bg-blue-50 font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200":"hover:bg-white dark:hover:bg-slate-900"}`}><span className="flex min-w-0 items-center gap-2"><span>📁</span><span className="truncate">{p.project_name||p.project_code}</span></span><span className="text-xs text-slate-400">{projectCounts.get(id)||0}</span></Link>})}{!vendorProjects.length?<div className="rounded-xl border border-dashed p-4 text-xs text-slate-500">No package is linked to this supplier.</div>:null}</div>
          <div className="my-4 border-t dark:border-slate-800"/>
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">Document Categories</div>
          <div className="space-y-1">{categoryOrder.map(k=>{const count=categoryCounts.get(k)||0;if(!count)return null;const active=k===initialCategory;return <Link key={k} href={`/documents?${docsQuery(initialVendor,initialProject,k,"")}`} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${active?"bg-slate-900 font-bold text-white dark:bg-blue-600":"hover:bg-white dark:hover:bg-slate-900"}`}><span className="flex items-center gap-2"><span>📂</span>{prettyCategory(k)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${active?"bg-white/15":"bg-slate-200 dark:bg-slate-800"}`}>{count}</span></Link>})}</div>
        </aside>

        <main className="min-w-0 border-r dark:border-slate-800">
          <div className="border-b px-5 py-4 dark:border-slate-800"><div className="text-xs text-slate-500">Suppliers / Contractors <span className="mx-1">›</span> <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedVendorName}</span> <span className="mx-1">›</span> <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedProjectName}</span> <span className="mx-1">›</span> <span className="font-semibold text-blue-700">{prettyCategory(initialCategory)}</span></div><div className="mt-3 flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">{prettyCategory(initialCategory)}</h2><p className="mt-1 text-xs text-slate-500">{visibleRows.length} file{visibleRows.length===1?"":"s"} in this folder</p></div></div></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Modified</th><th className="px-4 py-3">Rev</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{visibleRows.map((x:any)=>{const active=selectedFile&&String(selectedFile.id)===String(x.id),secureUrl=`/api/documents/${x.id}/file`,preview=canPreview(x.file_name);return <tr key={x.id} className={active?"bg-blue-50/70 dark:bg-blue-950/20":"hover:bg-slate-50/80 dark:hover:bg-slate-900/40"}><td className="px-5 py-4"><Link href={`/documents?${docsQuery(initialVendor,initialProject,initialCategory,String(x.id))}`} className="flex items-center gap-2 font-semibold"><span className={/\.pdf$/i.test(x.file_name||"")?"text-red-600":"text-blue-600"}>{/\.pdf$/i.test(x.file_name||"")?"▣":"▤"}</span><span>{x.file_name}</span></Link></td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{x.document_type||"Document"}</td><td className="px-4 py-4 text-slate-500">{fmtSize(x.file_size)}</td><td className="px-4 py-4 text-xs text-slate-500">{fmtDate(x.uploaded_at)}</td><td className="px-4 py-4">{x.revision||"—"}</td><td className="px-4 py-4"><div className="flex flex-wrap items-center gap-2">{x.google_drive_file_id&&preview?<a href={secureUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50">View</a>:null}{x.google_drive_file_id?<a href={`${secureUrl}?download=1`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">Download</a>:null}{isSuperAdmin?<SuperAdminDelete entity="document" entityId={x.id} entityLabel={x.document_title||x.file_name} idField="document_id" action={deleteDocumentRecord}/>:null}</div></td></tr>})}{!visibleRows.length?<tr><td colSpan={6} className="px-5 py-16 text-center text-slate-500">This folder is empty.</td></tr>:null}</tbody></table></div>
        </main>

        <aside className="bg-slate-50/40 p-4 dark:bg-slate-950/20">{selectedFile?<><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">Secure Preview</div><h3 className="mt-1 truncate text-lg font-bold">{selectedFile.file_name}</h3><div className="mt-1 text-xs text-slate-500">{selectedFile.document_type||"Document"} • {fmtSize(selectedFile.file_size)}</div></div><a href={`${selectedUrl}?download=1`} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold dark:bg-slate-900">Download</a></div><div className="mt-4 overflow-hidden rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900">{selectedFile.google_drive_file_id&&canPreview(selectedFile.file_name)?<iframe src={selectedUrl} title={selectedFile.file_name} className="h-[510px] w-full bg-white"/>:<div className="flex h-[510px] flex-col items-center justify-center p-8 text-center"><div className="text-5xl">📄</div><div className="mt-4 font-bold">Preview unavailable for this file type</div><p className="mt-2 max-w-xs text-sm text-slate-500">The file is still securely available through MCCS. Use Download to open it in its native application.</p><a href={`${selectedUrl}?download=1`} className="mt-5 rounded-xl bg-[#07111f] px-4 py-2.5 text-sm font-bold text-white">Download File</a></div>}</div></>:<div className="flex h-full min-h-[520px] items-center justify-center"><div className="max-w-xs text-center text-sm text-slate-500">Choose a file from the folder to preview its details here.</div></div>}</aside>
      </div>
    </section>
  </div>;
}
