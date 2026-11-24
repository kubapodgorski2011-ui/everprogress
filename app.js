(() => {
  "use strict";
  const DB_NAME = "everprogress-local";
  const STORE = "records";
  const CATEGORIES = ["Learning","Health & routine","Personal growth","Responsibilities","Other"];
  const $ = (id) => document.getElementById(id);
  let db;
  let selectedDate = localDateKey(new Date());
  let analyticsRange = "week";
  let editingId = null;
  let toastTimer;

  function localDateKey(date) {
    const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  function parseDate(key) { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d); }
  function shiftDate(key, offset) { const d=parseDate(key); d.setDate(d.getDate()+offset); return localDateKey(d); }
  function niceDate(key) { return parseDate(key).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric",year:"numeric"}); }
  function escapeText(value) { return String(value ?? "").slice(0,100); }

  function openDatabase() {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(DB_NAME,1);
      request.onupgradeneeded = () => { const database=request.result; if(!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE,{keyPath:"date"}); };
      request.onsuccess = () => { db=request.result; resolve(db); };
      request.onerror = () => reject(request.error);
    });
  }
  function getRecord(date) {
    return new Promise((resolve,reject) => {
      const req=db.transaction(STORE,"readonly").objectStore(STORE).get(date);
      req.onsuccess=()=>resolve(req.result || {date,tasks:[]}); req.onerror=()=>reject(req.error);
    });
  }
  function saveRecord(record) {
    return new Promise((resolve,reject) => {
      const req=db.transaction(STORE,"readwrite").objectStore(STORE).put(record);
      req.onsuccess=()=>resolve(); req.onerror=()=>reject(req.error);
    });
  }
  function getAllRecords() {
    return new Promise((resolve,reject) => {
      const req=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
      req.onsuccess=()=>resolve(req.result || []); req.onerror=()=>reject(req.error);
    });
  }
  async function updateRecord(date, updater) {
    const record=await getRecord(date); updater(record); await saveRecord(record); await renderAll();
  }
  function score(record) { return record.tasks.reduce((n,t)=>n+(t.completed?1:-1),0); }
  function rate(record) { return record.tasks.length ? Math.round(record.tasks.filter(t=>t.completed).length/record.tasks.length*100) : null; }
  function showToast(message) {
    const toast=$("toast"); toast.textContent=message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);
  }
  function make(tag, className, text) {
    const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node;
  }
  function taskElement(task, date) {
    const row=make("div","task-item"+(task.completed?" done":""));
    const check=make("button","task-check",task.completed?"✓":""); check.type="button"; check.setAttribute("aria-label",task.completed?"Mark incomplete":"Mark complete");
    check.addEventListener("click",()=>updateRecord(date,r=>{const t=r.tasks.find(x=>x.id===task.id); if(t)t.completed=!t.completed;}));
    const copy=make("div","task-copy"); copy.append(make("div","task-name",task.title),make("span","task-category",task.category));
    const actions=make("div","task-actions");
    const edit=make("button","", "✎"); edit.type="button"; edit.title="Edit task"; edit.setAttribute("aria-label","Edit task"); edit.addEventListener("click",()=>openEdit(task,date));
    const del=make("button","","×"); del.type="button"; del.title="Delete task"; del.setAttribute("aria-label","Delete task"); del.addEventListener("click",async()=>{if(confirm("Delete this task?")){await updateRecord(date,r=>{r.tasks=r.tasks.filter(x=>x.id!==task.id)});showToast("Task deleted.");}});
    actions.append(edit,del); row.append(check,copy,actions); return row;
  }
  function renderTaskList(container, record, showEmpty=false) {
    container.replaceChildren();
    record.tasks.forEach(t=>container.append(taskElement(t,record.date)));
    if(showEmpty) $("empty-tasks").hidden=record.tasks.length>0;
  }
  function svgChart(records, width=620, height=190) {
    const ns="http://www.w3.org/2000/svg", svg=document.createElementNS(ns,"svg");
    svg.setAttribute("viewBox",`0 0 ${width} ${height}`); svg.setAttribute("role","img"); svg.setAttribute("aria-label","Daily completion percentage chart");
    const left=34,right=12,top=15,bottom=32,innerW=width-left-right,innerH=height-top-bottom;
    [0,50,100].forEach(v=>{const y=top+innerH-(v/100)*innerH;const line=document.createElementNS(ns,"line");line.setAttribute("x1",left);line.setAttribute("x2",width-right);line.setAttribute("y1",y);line.setAttribute("y2",y);line.setAttribute("stroke","var(--border)");line.setAttribute("stroke-dasharray","3 5");svg.append(line);const label=document.createElementNS(ns,"text");label.setAttribute("x",2);label.setAttribute("y",y+4);label.setAttribute("fill","var(--muted)");label.setAttribute("font-size","10");label.textContent=v+"%";svg.append(label);});
    const valid=records.map((r,i)=>({r,i,v:rate(r)})).filter(x=>x.v!==null);
    if(!valid.length){const t=document.createElementNS(ns,"text");t.setAttribute("x",width/2);t.setAttribute("y",height/2);t.setAttribute("text-anchor","middle");t.setAttribute("fill","var(--muted)");t.setAttribute("font-size","12");t.textContent="Add tasks to start your graph";svg.append(t);return svg;}
    const points=valid.map(x=>{const xPos=left+(x.i/(Math.max(records.length-1,1)))*innerW;const yPos=top+innerH-(x.v/100)*innerH;return {...x,xPos,yPos};});
    const path=document.createElementNS(ns,"path");path.setAttribute("d",points.map((p,i)=>(i?"L":"M")+p.xPos+","+p.yPos).join(" "));path.setAttribute("fill","none");path.setAttribute("stroke","var(--green)");path.setAttribute("stroke-width","3");path.setAttribute("stroke-linecap","round");path.setAttribute("stroke-linejoin","round");svg.append(path);
    points.forEach(p=>{const c=document.createElementNS(ns,"circle");c.setAttribute("cx",p.xPos);c.setAttribute("cy",p.yPos);c.setAttribute("r","4.5");c.setAttribute("fill",p.v>=50?"var(--green)":"var(--red)");svg.append(c);const label=document.createElementNS(ns,"text");label.setAttribute("x",p.xPos);label.setAttribute("y",height-10);label.setAttribute("text-anchor","middle");label.setAttribute("fill","var(--muted)");label.setAttribute("font-size",records.length>10?"8":"10");label.textContent=parseDate(p.r.date).toLocaleDateString(undefined,{weekday:"short"}).slice(0,3);svg.append(label);});
    return svg;
  }
  function recordsForRange(all, days) {
    const map=new Map(all.map(r=>[r.date,r])); const today=localDateKey(new Date());
    return Array.from({length:days},(_,i)=>{const date=shiftDate(today,i-days+1);return map.get(date)||{date,tasks:[]};});
  }
  async function renderHome() {
    const record=await getRecord(selectedDate), total=record.tasks.length, done=record.tasks.filter(t=>t.completed).length, pct=rate(record)??0;
    $("home-date").value=selectedDate; $("completion-value").textContent=pct+"%"; $("completion-bar").style.width=pct+"%";
    $("completion-caption").textContent=`${done} of ${total} tasks completed`; $("score-value").textContent=(score(record)>0?"+":"")+score(record);
    $("done-value").textContent=done; $("open-value").textContent=total-done; $("greeting").textContent=selectedDate===localDateKey(new Date())?"Welcome back.":"Your day at a glance.";
    renderTaskList($("home-task-list"),record);
    const all=await getAllRecords(); $("home-chart").replaceChildren(svgChart(recordsForRange(all,7),520,175));
    const message=$("daily-message"); message.replaceChildren();
    const strong=make("strong", "", total===0?"A fresh start.":pct>=80?"Great momentum.":pct>=50?"You're building consistency.":"A chance to adjust.");
    const p=make("p","",total===0?"Add a few tasks to begin tracking your progress.":pct>=80?"Your plan is moving along well. Notice what helped you make space for these tasks.":pct>=50?"Some of your plan is complete. Consider choosing one clear next priority.":"Your completion rate is lower today. Check whether your plan needs more realistic time or fewer priorities.");
    message.append(strong,p);
    $("today-label").textContent=niceDate(selectedDate).toUpperCase();
  }
  async function renderTasks() {
    $("tasks-date").value=selectedDate; $("task-date-heading").textContent=niceDate(selectedDate);
    const r=await getRecord(selectedDate); renderTaskList($("full-task-list"),r,true);
    $("task-count-tag").textContent=r.tasks.length+" tasks";
    $("task-summary").textContent=`${r.tasks.filter(t=>t.completed).length} completed · ${r.tasks.filter(t=>!t.completed).length} remaining`;
  }
  async function renderAnalytics() {
    const all=await getAllRecords(), days=analyticsRange==="week"?7:30, records=recordsForRange(all,days), active=records.filter(r=>r.tasks.length);
    const avg=active.length?Math.round(active.reduce((s,r)=>s+rate(r),0)/active.length):null;
    $("average-value").textContent=avg===null?"—":avg+"%";
    $("total-done-value").textContent=records.reduce((s,r)=>s+r.tasks.filter(t=>t.completed).length,0);
    const totalScore=records.reduce((s,r)=>s+score(r),0); $("total-score-value").textContent=(totalScore>0?"+":"")+totalScore;
    $("analytics-title").textContent=analyticsRange==="week"?"Last 7 days":"Last 30 days";
    $("analytics-chart").replaceChildren(svgChart(records,760,240));
    const cats=new Map(); records.forEach(r=>r.tasks.forEach(t=>{const x=cats.get(t.category)||{total:0,done:0};x.total++;if(t.completed)x.done++;cats.set(t.category,x);}));
    const wrap=$("category-breakdown");wrap.replaceChildren();
    if(!cats.size){wrap.append(make("p","muted small","Add categorized tasks to see where your effort goes."));return;}
    CATEGORIES.filter(c=>cats.has(c)).forEach(c=>{const v=cats.get(c),pct=Math.round(v.done/v.total*100),row=make("div","category-row");row.append(make("span","",c));const track=make("div","category-track"),fill=make("div","category-fill");fill.style.width=pct+"%";track.append(fill);row.append(track,make("span","category-percent",pct+"%"));wrap.append(row);});
  }
  async function renderInsights() {
    const all=await getAllRecords(), recent=recordsForRange(all,7), active=recent.filter(r=>r.tasks.length), list=$("improvement-list"),focus=$("focus-list");
    list.replaceChildren();focus.replaceChildren();
    const total=active.reduce((s,r)=>s+r.tasks.length,0), done=active.reduce((s,r)=>s+r.tasks.filter(t=>t.completed).length,0);
    const enough=active.length>=3 && total>=5;
    if(!enough){const obs=make("div","observation");obs.append(make("div","obs-label","Getting started"),make("strong","","Build your baseline"),make("p","","Keep recording tasks for a few days. Once there is more information, EverProgress can spot patterns and offer more useful suggestions."));list.append(obs);focus.append(make("p","muted small","For now, try choosing 1–3 priorities that feel realistic for your day."));$("reflection-text").textContent="Your progress story is just beginning. A few days of notes will make the trends more meaningful.";return;}
    const pct=Math.round(done/total*100), categoryStats=new Map();
    active.forEach(r=>r.tasks.forEach(t=>{const v=categoryStats.get(t.category)||{n:0,d:0};v.n++;if(t.completed)v.d++;categoryStats.set(t.category,v);}));
    const weakest=[...categoryStats.entries()].sort((a,b)=>(a[1].d/a[1].n)-(b[1].d/b[1].n))[0];
    const observations=[];
    observations.push({label:"Weekly snapshot",title:`${pct}% of recorded tasks completed`,body:pct>=75?"Your recent completion rate is strong. Notice which planning habits are helping.":pct>=50?"Some of your plan is getting done. It may help to make the next day's priorities more specific.":"Your recent completion rate suggests your plans may need adjusting. Consider reducing the number of planned tasks or making them smaller."});
    if(weakest) observations.push({label:"Category to review",title:weakest[0],body:`${Math.round(weakest[1].d/weakest[1].n*100)}% of recorded tasks in this category were completed. This is an area worth reviewing, not a judgement. Check whether the tasks are clear and realistically scheduled.`});
    const dayRates=active.map(r=>rate(r)), first=dayRates[0], last=dayRates[dayRates.length-1];
    if(dayRates.length>=4) observations.push({label:"Recent direction",title:last>=first?"Recent days are trending upward":"Recent results have shifted",body:last>=first?"Your latest recorded day is at or above your earliest day in this sample. Keep noticing what works.":"Your latest recorded day is below your earliest day in this sample. Look for practical changes to your plan rather than assuming a reason."});
    observations.forEach(o=>{const el=make("div","observation");el.append(make("div","obs-label",o.label),make("strong","",o.title),make("p","",o.body));list.append(el);});
    const suggestions=["Choose your top three priorities before adding smaller tasks.","Break a task that feels too large into a first 10-minute step.","Give important tasks a realistic time slot and leave a little buffer.","Review repeated unfinished tasks: clarify, reschedule, reduce, or remove them.","Keep one small, achievable task in your plan to build consistency."];
    suggestions.slice(0,3).forEach((s,i)=>{const el=make("div","focus-item");el.append(make("span","focus-number",String(i+1)),make("p","",s));focus.append(el);});
    $("reflection-text").textContent=`Across ${active.length} days with recorded tasks, you completed ${done} of ${total} tasks (${pct}%). ${weakest?weakest[0]+" is the category with the most room to review in this sample.":""} Use this as a prompt to adjust your plan, not as a judgement about yourself.`;
  }
  async function renderAll(){await Promise.all([renderHome(),renderTasks(),renderAnalytics(),renderInsights()]);}
  function showPage(name) {
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+name));
    document.querySelectorAll(".nav-btn[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
    const titles={home:"Dashboard",tasks:"Tasks",analytics:"Analytics",insights:"Insights",settings:"Settings"};
    $("page-title").textContent=titles[name]||"Dashboard";
    if(name==="settings") document.querySelector(".footer").scrollIntoView({block:"end",behavior:"smooth"});
  }
  function openEdit(task,date) {
    editingId=task.id; $("edit-title").value=task.title; $("edit-category").value=task.category;
    $("edit-dialog").showModal();
    $("edit-form").onsubmit=async(e)=>{e.preventDefault();const title=$("edit-title").value.trim();if(!title)return;await updateRecord(date,r=>{const t=r.tasks.find(x=>x.id===editingId);if(t){t.title=escapeText(title);t.category=$("edit-category").value;}});$("edit-dialog").close();showToast("Task updated.");};
  }
  function setTheme(light) { document.documentElement.classList.toggle("light",light); localStorage.setItem("ep-theme",light?"light":"dark"); }
  async function exportData() {
    const data={app:"EverProgress",version:1,exportedAt:new Date().toISOString(),records:await getAllRecords()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="everprogress-backup-"+localDateKey(new Date())+".json";a.click();URL.revokeObjectURL(url);showToast("Backup exported.");
  }
  async function importData(file) {
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(parsed.app!=="EverProgress"||!Array.isArray(parsed.records))throw new Error("This file is not an EverProgress backup.");
      for(const r of parsed.records){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Array.isArray(r.tasks))continue;
        const safeTasks=r.tasks.filter(t=>t&&typeof t.title==="string"&&typeof t.id==="string").map(t=>({id:t.id,title:escapeText(t.title),category:CATEGORIES.includes(t.category)?t.category:"Other",completed:Boolean(t.completed)}));
        await saveRecord({date:r.date,tasks:safeTasks});
      }
      await renderAll();showToast("Backup imported.");
    }catch(e){alert("Could not import this file: "+e.message);}
    $("import-file").value="";
  }
  async function resetData() {
    if(!confirm("This will permanently delete all EverProgress data stored in this browser. Export a backup first if you might need it. Continue?"))return;
    await new Promise((resolve,reject)=>{const req=db.transaction(STORE,"readwrite").objectStore(STORE).clear();req.onsuccess=resolve;req.onerror=()=>reject(req.error);});
    await renderAll();showToast("Local progress reset.");
  }
  function bindEvents() {
    document.querySelectorAll(".nav-btn[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
    document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.goto)));
    $("home-date").addEventListener("change",async e=>{selectedDate=e.target.value||localDateKey(new Date());await renderAll();});
    $("tasks-date").addEventListener("change",async e=>{selectedDate=e.target.value||localDateKey(new Date());await renderAll();});
    $("quick-add").addEventListener("click",()=>{showPage("tasks");$("task-title").focus();});
    $("task-form").addEventListener("submit",async e=>{e.preventDefault();const title=$("task-title").value.trim();if(!title)return;await updateRecord(selectedDate,r=>r.tasks.push({id:crypto.randomUUID(),title:escapeText(title),category:$("task-category").value,completed:false}));$("task-title").value="";$("task-title").focus();showToast("Task added.");});
    document.querySelectorAll(".range-btn").forEach(b=>b.addEventListener("click",async()=>{analyticsRange=b.dataset.range;document.querySelectorAll(".range-btn").forEach(x=>x.classList.toggle("active",x===b));await renderAnalytics();}));
    const toggle=()=>setTheme(!document.documentElement.classList.contains("light"));
    $("theme-toggle").addEventListener("click",toggle);$("settings-theme").addEventListener("click",toggle);
    $("export-btn").addEventListener("click",exportData);$("import-file").addEventListener("change",e=>importData(e.target.files[0]));$("reset-btn").addEventListener("click",resetData);
  }
  async function init() {
    try{await openDatabase();}catch(e){alert("EverProgress could not open local storage in this browser. Try a current browser and make sure site storage is allowed.");return;}
    setTheme(localStorage.getItem("ep-theme")==="light");
    bindEvents();await renderAll();
    if("serviceWorker" in navigator && location.protocol!=="file:"){navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}
  }
  document.addEventListener("DOMContentLoaded",init);
})();