"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem("mccs-theme");const d=saved?saved==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);setDark(d)},[]);
 function toggle(){const d=!dark;setDark(d);document.documentElement.classList.toggle("dark",d);localStorage.setItem("mccs-theme",d?"dark":"light")}
 return <button type="button" onClick={toggle} title={dark?"Switch to light mode":"Switch to dark mode"} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">{dark?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}</button>
}
