import { Download, ShieldCheck, Smartphone } from "lucide-react";

const APK_URL = "https://miranenergy-my.sharepoint.com/:u:/p/sarwar_khalid/IQDGmOb4fKgITp3ef6KgzTiYATM7IICnfiH4cARQHt0P8yA?e=fth2Yt";

export default function MobileAppPage() {
  return <div className="mx-auto max-w-4xl">
    <div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">MCCS Mobile</div>
    <h1 className="mt-2 text-3xl font-bold">Android App</h1>
    <p className="mt-2 text-sm text-slate-500">Install the authorized MCCS Android application from the official Miran Energy SharePoint link.</p>
    <div className="mccs-card mt-7 rounded-2xl p-6">
      <div className="flex items-start gap-4"><div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Smartphone className="h-7 w-7"/></div><div><h2 className="text-xl font-bold">MCCS Android App</h2><p className="mt-1 text-sm text-slate-500">Current installation package: app-debug.apk</p></div></div>
      <a href={APK_URL} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white dark:bg-blue-600"><Download className="h-4 w-4"/>Download MCCS Android App</a>
      <div className="mt-7 border-t border-slate-200 pt-6 dark:border-slate-800"><h3 className="font-bold">Installation</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300"><li>Download and open <b>app-debug.apk</b>.</li><li>If Android blocks installation, open <b>Settings</b> and enable <b>Allow from this source</b>.</li><li>Return and select <b>Install</b>.</li><li>If Play Protect warns you, select <b>More details → Install anyway</b>.</li><li>When finished, open <b>MCCS</b>.</li></ol></div>
      <div className="mt-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><p><b>Security notice:</b> Install MCCS only from the official Miran Energy SharePoint link shown on this page. Android may warn because the app is distributed outside Google Play.</p></div>
    </div>
  </div>;
}
