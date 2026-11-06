"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Check, CircleHelp, Compass, ExternalLink, LoaderCircle, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";

type Item = { id:number; session_id:number; kind:"discovery"|"question"|"resource"; title:string; body:string; url:string|null; created_at:string; updated_at:string };
type Session = { id:number; title:string; central_question:string; notes:string; status:"active"|"paused"|"completed"; item_count:number; created_at:string; updated_at:string };
type Detail = Session & { items:Item[] };
const labels = { discovery:"Discovery", question:"Question", resource:"Resource" };

export default function ExploreSessions() {
  const [sessions,setSessions]=useState<Session[]>([]);
  const [active,setActive]=useState<Detail|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [creating,setCreating]=useState(false);
  const [title,setTitle]=useState("");
  const [question,setQuestion]=useState("");
  const [kind,setKind]=useState<Item["kind"]>("discovery");
  const [itemTitle,setItemTitle]=useState("");
  const [itemBody,setItemBody]=useState("");
  const [itemUrl,setItemUrl]=useState("");
  const [notes,setNotes]=useState("");

  const load=useCallback(async()=>{setLoading(true);try{setSessions(await api<Session[]>("/explore/sessions"));}catch(e){setError(e instanceof Error?e.message:"Could not load explorations.");}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>sessions.filter(s=>(s.title+" "+s.central_question).toLowerCase().includes(search.toLowerCase())),[sessions,search]);

  async function open(s:Session){setError("");try{const d=await api<Detail>("/explore/sessions/"+s.id);setActive(d);setNotes(d.notes);setItemTitle("");setItemBody("");setItemUrl("");}catch(e){setError(e instanceof Error?e.message:"Could not open exploration.");}}
  async function create(e:React.FormEvent){e.preventDefault();if(!title.trim()||!question.trim())return;setBusy(true);setError("");try{const s=await api<Session>("/explore/sessions",{method:"POST",body:JSON.stringify({title:title.trim(),central_question:question.trim()})});setSessions(v=>[s,...v]);setTitle("");setQuestion("");setCreating(false);await open(s);}catch(e){setError(e instanceof Error?e.message:"Could not start exploration.");}finally{setBusy(false);}}
  async function addItem(e:React.FormEvent){e.preventDefault();if(!active||!itemTitle.trim())return;setBusy(true);setError("");try{const item=await api<Item>("/explore/sessions/"+active.id+"/items",{method:"POST",body:JSON.stringify({kind,title:itemTitle.trim(),body:itemBody.trim(),url:kind==="resource"?(itemUrl.trim()||null):null})});const items=[item,...active.items];setActive({...active,items,item_count:items.length});setSessions(v=>v.map(s=>s.id===active.id?{...s,item_count:items.length}:s));setItemTitle("");setItemBody("");setItemUrl("");}catch(e){setError(e instanceof Error?e.message:"Could not save item.");}finally{setBusy(false);}}
  async function saveNotes(){if(!active)return;setBusy(true);try{await api<Session>("/explore/sessions/"+active.id,{method:"PATCH",body:JSON.stringify({notes})});setActive({...active,notes});}catch(e){setError(e instanceof Error?e.message:"Could not save notes.");}finally{setBusy(false);}}
  async function setStatus(status:Session["status"]){if(!active)return;setBusy(true);try{await api<Session>("/explore/sessions/"+active.id,{method:"PATCH",body:JSON.stringify({status})});setActive({...active,status});setSessions(v=>v.map(s=>s.id===active.id?{...s,status}:s));}catch(e){setError(e instanceof Error?e.message:"Could not update status.");}finally{setBusy(false);}}
  async function removeItem(item:Item){if(!active)return;setBusy(true);try{await api<void>("/explore/sessions/"+active.id+"/items/"+item.id,{method:"DELETE"});const items=active.items.filter(i=>i.id!==item.id);setActive({...active,items,item_count:items.length});setSessions(v=>v.map(s=>s.id===active.id?{...s,item_count:items.length}:s));}catch(e){setError(e instanceof Error?e.message:"Could not remove item.");}finally{setBusy(false);}}
  async function removeSession(s:Session){if(!window.confirm("Delete “"+s.title+"” and everything saved inside it?"))return;setBusy(true);try{await api<void>("/explore/sessions/"+s.id,{method:"DELETE"});setSessions(v=>v.filter(x=>x.id!==s.id));if(active?.id===s.id)setActive(null);}catch(e){setError(e instanceof Error?e.message:"Could not delete exploration.");}finally{setBusy(false);}}

  return <section className="atlas-discovery" aria-label="Independent explorations">
    <div className="atlas-discovery-heading"><div><p className="eyebrow">FOLLOW YOUR CURIOSITY</p><h3>Exploration journal</h3><p>Give an interesting question room to grow. Collect discoveries, open questions and useful resources as you go.</p></div>
      {!active?<button className="atlas-button atlas-primary" onClick={()=>setCreating(v=>!v)}><Plus size={15}/>{creating?"Close":"Start an exploration"}</button>:<button className="atlas-button atlas-secondary" onClick={()=>setActive(null)}>All explorations <ArrowUpRight size={14}/></button>}
    </div>
    {error&&<div className="atlas-explore-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {creating&&!active&&<form className="atlas-discovery-create" onSubmit={create}>
      <label>Exploration title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. The science of memory" maxLength={240} required/></label>
      <label>What are you curious about?<textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Write the question you want to follow…" rows={2} maxLength={4000} required/></label>
      <button className="atlas-button atlas-primary" disabled={busy||!title.trim()||!question.trim()}>{busy?"Starting…":"Create exploration"}<ArrowUpRight size={14}/></button>
    </form>}
    {active?<div className="atlas-discovery-detail">
      <div className="atlas-discovery-detail-head"><div><span className="atlas-discovery-kicker">CENTRAL QUESTION</span><h4>{active.title}</h4><p>{active.central_question}</p></div>
        <label className="atlas-discovery-status">Status<select value={active.status} disabled={busy} onChange={e=>void setStatus(e.target.value as Session["status"])}><option value="active">In progress</option><option value="paused">On hold</option><option value="completed">Completed</option></select></label>
      </div>
      <div className="atlas-discovery-columns"><div className="atlas-discovery-main">
        <form className="atlas-discovery-item-form" onSubmit={addItem}>
          <div className="atlas-discovery-form-title"><span><Plus size={14}/>Add to this exploration</span><select aria-label="Saved item type" value={kind} onChange={e=>setKind(e.target.value as Item["kind"])}><option value="discovery">Discovery</option><option value="question">Question</option><option value="resource">Resource</option></select></div>
          <label>Title<input value={itemTitle} onChange={e=>setItemTitle(e.target.value)} placeholder={kind==="question"?"What do you still want to understand?":kind==="resource"?"Name this resource":"What did you discover?"} required maxLength={240}/></label>
          <label>Notes<textarea value={itemBody} onChange={e=>setItemBody(e.target.value)} placeholder="Capture the useful detail while it is fresh…" rows={3} maxLength={12000}/></label>
          {kind==="resource"&&<label>Link<input type="url" value={itemUrl} onChange={e=>setItemUrl(e.target.value)} placeholder="https://…"/></label>}
          <button className="atlas-button atlas-primary" disabled={busy||!itemTitle.trim()}>{busy?"Saving…":"Save to journal"}<Check size={14}/></button>
        </form>
        <div className="atlas-discovery-items-heading"><span>YOUR THREAD</span><span>{active.items.length} SAVED</span></div>
        {!active.items.length?<div className="atlas-discovery-empty"><Compass size={20}/><p>Your first discovery goes here. Save a useful idea, a question to investigate, or a resource worth revisiting.</p></div>:
          <div className="atlas-discovery-items">{active.items.map(item=><article className="atlas-discovery-item" key={item.id}>
            <div className="atlas-discovery-item-icon">{item.kind==="question"?<CircleHelp size={15}/>:item.kind==="resource"?<BookOpen size={15}/>:<Sparkles size={15}/>}</div>
            <div className="atlas-discovery-item-copy"><span>{labels[item.kind]}</span><h5>{item.title}</h5>{item.body&&<p>{item.body}</p>}{item.url&&<a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={12}/>Open resource</a>}</div>
            <button className="atlas-discovery-remove" aria-label={"Remove "+item.title} disabled={busy} onClick={()=>void removeItem(item)}><Trash2 size={14}/></button>
          </article>)}</div>}
      </div><aside className="atlas-discovery-notes"><label>Session notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Keep a running summary, observations, or connections…" rows={8}/></label>
        <button className="atlas-button atlas-secondary" onClick={()=>void saveNotes()} disabled={busy||notes===active.notes}>Save notes</button>
        <button className="atlas-discovery-delete" onClick={()=>void removeSession(active)} disabled={busy}><Trash2 size={13}/>Delete exploration</button>
      </aside></div>
    </div>:<div className="atlas-discovery-list-wrap">
      <div className="atlas-discovery-list-top"><div><span className="atlas-discovery-kicker">YOUR OPEN THREADS</span><strong>{sessions.length.toString().padStart(2,"0")}</strong></div><label className="atlas-library-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find an exploration…"/></label></div>
      {loading?<div className="atlas-explore-state"><LoaderCircle className="atlas-spin" size={18}/>Loading your explorations…</div>:!filtered.length?<div className="atlas-discovery-empty"><Compass size={21}/><p>{sessions.length?"No explorations match that search.":"No open questions yet. Start with something you have always wanted to understand."}</p></div>:
        <div className="atlas-discovery-list">{filtered.map(s=><article className="atlas-discovery-card" key={s.id}>
          <button className="atlas-discovery-card-open" onClick={()=>void open(s)}><span className="atlas-discovery-card-status">{s.status==="completed"?"COMPLETED":s.status==="paused"?"ON HOLD":"IN PROGRESS"}</span><strong>{s.title}</strong><p>{s.central_question}</p><span className="atlas-discovery-card-foot">{s.item_count} saved {s.item_count===1?"item":"items"} · Continue exploring <ArrowUpRight size={13}/></span></button>
          <button className="atlas-discovery-remove" aria-label={"Delete "+s.title} disabled={busy} onClick={()=>void removeSession(s)}><Trash2 size={14}/></button>
        </article>)}</div>}
    </div>}
  </section>;
}
