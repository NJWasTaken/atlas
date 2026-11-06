"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight, BookOpen, Check, ChevronLeft, ExternalLink, GitBranch, LoaderCircle, Network, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";

type Kind = "topic"|"concept"|"question"|"note"|"source"|"claim";
type Node = {id:number;kind:Kind;title:string;body:string;source_url:string|null;position_x:number;position_y:number;position_z:number;created_at:string;updated_at:string};
type Edge = {id:number;source_node_id:number;target_node_id:number;label:string;created_at:string};
type SearchResult = {title:string;url:string;description:string;age:string|null;domain:string|null};
type Article = {url:string;title:string;site_name:string|null;author:string|null;published_date:string|null;content_markdown:string;excerpt:string};
const kinds:Kind[]=["topic","concept","question","note","source","claim"];
const colors:Record<Kind,string>={topic:"#c5a875",concept:"#80a9d0",question:"#b69bd6",note:"#83b89f",source:"#d18e75",claim:"#c6c9d2"};
const pretty:Record<Kind,string>={topic:"Topic",concept:"Concept",question:"Question",note:"Note",source:"Source",claim:"Claim"};

function Controls(){
  const {camera,gl}=useThree();
  const ref=useRef<OrbitControls|null>(null);
  useEffect(()=>{const c=new OrbitControls(camera,gl.domElement);c.enableDamping=true;c.dampingFactor=.08;c.minDistance=4;c.maxDistance=34;ref.current=c;return()=>{c.dispose();ref.current=null;};},[camera,gl]);
  useFrame(()=>ref.current?.update());
  return null;
}
function Label({node}:{node:Node}){
  const texture=useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=640;canvas.height=112;
    const ctx=canvas.getContext("2d");
    if(ctx){ctx.fillStyle="rgba(7,17,29,.9)";ctx.beginPath();ctx.roundRect(5,8,630,96,16);ctx.fill();ctx.strokeStyle="rgba(197,168,117,.4)";ctx.stroke();ctx.fillStyle="#f0e9de";ctx.font="500 34px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(node.title.length>28?node.title.slice(0,26)+"…":node.title,320,56);}
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
  },[node.title]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <sprite position={[0,-.55,0]} scale={[2.8,.5,1]}><spriteMaterial map={texture} transparent depthWrite={false}/></sprite>;
}
function EdgeBeam({a,b,label}:{a:Node;b:Node;label:string}){
  const data=useMemo(()=>{
    const start=new THREE.Vector3(a.position_x,a.position_y,a.position_z),end=new THREE.Vector3(b.position_x,b.position_y,b.position_z);
    const d=end.clone().sub(start),length=Math.max(.01,d.length());
    const direction=length>.01?d.normalize():new THREE.Vector3(0,1,0);
    return {mid:start.add(end).multiplyScalar(.5),length,q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction)};
  },[a.position_x,a.position_y,a.position_z,b.position_x,b.position_y,b.position_z]);
  const texture=useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=420;canvas.height=88;
    const ctx=canvas.getContext("2d");
    if(ctx){ctx.fillStyle="rgba(7,17,29,.9)";ctx.beginPath();ctx.roundRect(4,5,412,78,14);ctx.fill();ctx.fillStyle="#d5c09a";ctx.font="28px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(label.length>22?label.slice(0,20)+"…":label,210,44);}
    return new THREE.CanvasTexture(canvas);
  },[label]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <group><mesh position={data.mid.toArray()} quaternion={data.q}><cylinderGeometry args={[.012,.012,data.length,7]}/><meshBasicMaterial color="#73879b" transparent opacity={.55}/></mesh><sprite position={[data.mid.x,data.mid.y+.18,data.mid.z+.05]} scale={[1.5,.32,1]}><spriteMaterial map={texture} transparent depthWrite={false}/></sprite></group>;
}
function GraphNode({node,selected,onSelect,onMove,onCommit}:{node:Node;selected:boolean;onSelect:(id:number)=>void;onMove:(id:number,x:number,y:number,z:number)=>void;onCommit:(id:number,x:number,y:number,z:number)=>void}){
  const dragging=useRef(false),pos=useRef(new THREE.Vector3(node.position_x,node.position_y,node.position_z));
  useEffect(()=>{if(!dragging.current)pos.current.set(node.position_x,node.position_y,node.position_z);},[node.position_x,node.position_y,node.position_z]);
  const radius=node.kind==="topic"?.34:.25;
  return <group position={[node.position_x,node.position_y,node.position_z]}>
    <mesh
      onClick={e=>{e.stopPropagation();onSelect(node.id);}}
      onPointerDown={e=>{e.stopPropagation();dragging.current=true;pos.current.set(node.position_x,node.position_y,node.position_z);onSelect(node.id);}}
      onPointerMove={e=>{if(!dragging.current)return;const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-pos.current.z),p=new THREE.Vector3();if(e.ray.intersectPlane(plane,p)){pos.current.set(p.x,p.y,pos.current.z);onMove(node.id,p.x,p.y,pos.current.z);}}}
      onPointerUp={e=>{if(dragging.current){e.stopPropagation();dragging.current=false;onCommit(node.id,pos.current.x,pos.current.y,pos.current.z);}}}
      onPointerLeave={()=>{if(dragging.current){dragging.current=false;onCommit(node.id,pos.current.x,pos.current.y,pos.current.z);}}}
    >
      <sphereGeometry args={[radius,28,28]}/><meshStandardMaterial color={colors[node.kind]} emissive={colors[node.kind]} emissiveIntensity={selected?.45:.14} roughness={.36} metalness={.18}/>
    </mesh>
    <mesh scale={selected?1.55:1}><sphereGeometry args={[radius*1.2,20,20]}/><meshBasicMaterial color={colors[node.kind]} transparent opacity={selected?.14:.04} side={THREE.BackSide}/></mesh>
    <Label node={node}/>
  </group>;
}
function GraphCanvas({nodes,edges,selectedId,onSelect,onMove,onCommit}:{nodes:Node[];edges:Edge[];selectedId:number|null;onSelect:(id:number|null)=>void;onMove:(id:number,x:number,y:number,z:number)=>void;onCommit:(id:number,x:number,y:number,z:number)=>void}){
  const map=useMemo(()=>new Map(nodes.map(n=>[n.id,n])),[nodes]);
  return <Canvas camera={{position:[0,0,13],fov:48}} dpr={[1,1.75]} gl={{antialias:true,alpha:true}} onPointerMissed={()=>onSelect(null)}>
    <ambientLight intensity={1.3}/><pointLight position={[4,5,7]} intensity={36} color="#d4e2f1"/><pointLight position={[-6,-3,-4]} intensity={18} color="#c5a875"/><Controls/>
    {edges.map(edge=>{const a=map.get(edge.source_node_id),b=map.get(edge.target_node_id);return a&&b?<EdgeBeam key={edge.id} a={a} b={b} label={edge.label}/>:null;})}
    {nodes.map(node=><GraphNode key={node.id} node={node} selected={node.id===selectedId} onSelect={id=>onSelect(id)} onMove={onMove} onCommit={onCommit}/>)}
  </Canvas>;
}
function positionFor(count:number){if(count===0)return {position_x:0,position_y:0,position_z:0};const index=count-1,a=index*2.399963,r=2+Math.sqrt(index)*.65;return {position_x:Math.cos(a)*r,position_y:Math.sin(a)*r,position_z:Math.sin(a*.7)*1.8};}

export default function KnowledgeGraphWorkspace(){
  const [nodes,setNodes]=useState<Node[]>([]),[edges,setEdges]=useState<Edge[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [selectedId,setSelectedId]=useState<number|null>(null),[panel,setPanel]=useState<"knowledge"|"research">("research"),[creating,setCreating]=useState(false);
  const [connect,setConnect]=useState(false),[connectFrom,setConnectFrom]=useState<number|null>(null),[relation,setRelation]=useState("related to");
  const [kind,setKind]=useState<Kind>("concept"),[title,setTitle]=useState(""),[body,setBody]=useState(""),[sourceUrl,setSourceUrl]=useState("");
  const [editTitle,setEditTitle]=useState(""),[editBody,setEditBody]=useState(""),[editKind,setEditKind]=useState<Kind>("concept"),[editUrl,setEditUrl]=useState("");
  const [query,setQuery]=useState(""),[searching,setSearching]=useState(false),[results,setResults]=useState<SearchResult[]>([]),[addressUrl,setAddressUrl]=useState("");
  const [article,setArticle]=useState<Article|null>(null),[opening,setOpening]=useState(false),[selectedPassage,setSelectedPassage]=useState("");
  const [graphSearch,setGraphSearch]=useState(""),[kindFilter,setKindFilter]=useState<"all"|Kind>("all"),[connectedOnly,setConnectedOnly]=useState(false);
  const selected=nodes.find(n=>n.id===selectedId)??null;
  const connections=selected?edges.filter(edge=>edge.source_node_id===selected.id||edge.target_node_id===selected.id):[];
  const visibleNodes=useMemo(()=>{
    const term=graphSearch.trim().toLowerCase();
    let filtered=nodes.filter(node=>(kindFilter==="all"||node.kind===kindFilter)&&(!term||[node.title,node.body,node.source_url??""].some(value=>value.toLowerCase().includes(term))));
    if(connectedOnly){const linked=new Set(edges.flatMap(edge=>[edge.source_node_id,edge.target_node_id]));filtered=filtered.filter(node=>linked.has(node.id));}
    return filtered;
  },[nodes,edges,graphSearch,kindFilter,connectedOnly]);
  const visibleIds=useMemo(()=>new Set(visibleNodes.map(node=>node.id)),[visibleNodes]);
  const visibleEdges=useMemo(()=>edges.filter(edge=>visibleIds.has(edge.source_node_id)&&visibleIds.has(edge.target_node_id)),[edges,visibleIds]);

  useEffect(()=>{let live=true;api<{nodes:Node[];edges:Edge[]}>("/explore/graph").then(g=>{if(live){setNodes(g.nodes);setEdges(g.edges);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Could not load your graph.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
  useEffect(()=>{if(selected){setEditTitle(selected.title);setEditBody(selected.body);setEditKind(selected.kind);setEditUrl(selected.source_url??"");}},[selectedId,selected?.updated_at]);

  function selectNode(id:number|null){
    if(id===null){if(!connect)setSelectedId(null);return;}
    if(connect){
      if(connectFrom===null){setConnectFrom(id);setNotice("Now select the second node.");return;}
      if(connectFrom===id){setNotice("Choose a different node.");return;}
      setBusy(true);api<Edge>("/explore/graph/edges",{method:"POST",body:JSON.stringify({source_node_id:connectFrom,target_node_id:id,label:relation.trim()||"related to"})})
        .then(edge=>{setEdges(v=>v.some(e=>e.id===edge.id)?v:[...v,edge]);setConnect(false);setConnectFrom(null);setSelectedId(id);setPanel("knowledge");setNotice("Connection added.");})
        .catch(e=>setError(e instanceof Error?e.message:"Could not connect these nodes.")).finally(()=>setBusy(false));
      return;
    }
    setSelectedId(id);setPanel("knowledge");setCreating(false);
  }
  async function createNode(e:React.FormEvent){
    e.preventDefault();if(!title.trim())return;setBusy(true);setError("");
    try{const n=await api<Node>("/explore/graph/nodes",{method:"POST",body:JSON.stringify({kind,title:title.trim(),body:body.trim(),source_url:kind==="source"?(sourceUrl.trim()||null):null,...positionFor(nodes.length)})});setNodes(v=>[...v,n]);setSelectedId(n.id);setPanel("knowledge");setCreating(false);setTitle("");setBody("");setSourceUrl("");setNotice("Added to your graph.");}
    catch(e){setError(e instanceof Error?e.message:"Could not add node.");}finally{setBusy(false);}
  }
  async function saveNode(){
    if(!selected||!editTitle.trim())return;setBusy(true);
    try{const n=await api<Node>("/explore/graph/nodes/"+selected.id,{method:"PATCH",body:JSON.stringify({title:editTitle.trim(),body:editBody,kind:editKind,source_url:editUrl.trim()||null})});setNodes(v=>v.map(x=>x.id===n.id?n:x));setNotice("Node saved.");}
    catch(e){setError(e instanceof Error?e.message:"Could not save node.");}finally{setBusy(false);}
  }
  async function deleteNode(){
    if(!selected||!window.confirm("Delete "+selected.title+" and its connections?"))return;setBusy(true);
    try{await api<void>("/explore/graph/nodes/"+selected.id,{method:"DELETE"});setNodes(v=>v.filter(n=>n.id!==selected.id));setEdges(v=>v.filter(e=>e.source_node_id!==selected.id&&e.target_node_id!==selected.id));setSelectedId(null);setNotice("Node deleted.");}
    catch(e){setError(e instanceof Error?e.message:"Could not delete node.");}finally{setBusy(false);}
  }
  function moveNode(id:number,x:number,y:number,z:number){setNodes(v=>v.map(n=>n.id===id?{...n,position_x:x,position_y:y,position_z:z}:n));}
  async function commitPosition(id:number,x:number,y:number,z:number){try{await api<Node>("/explore/graph/nodes/"+id,{method:"PATCH",body:JSON.stringify({position_x:x,position_y:y,position_z:z})});}catch(e){setError(e instanceof Error?e.message:"Could not save node position.");}}
  async function deleteEdge(edge:Edge){
    try{await api<void>("/explore/graph/edges/"+edge.id,{method:"DELETE"});setEdges(v=>v.filter(item=>item.id!==edge.id));setNotice("Connection removed.");}
    catch(e){setError(e instanceof Error?e.message:"Could not remove connection.");}
  }
  async function search(e:React.FormEvent){
    e.preventDefault();if(!query.trim())return;setSearching(true);setError("");setArticle(null);
    try{const r=await api<{results:SearchResult[]}>("/explore/search",{method:"POST",body:JSON.stringify({q:query.trim(),count:10})});setResults(r.results);}
    catch(e){setError(e instanceof Error?e.message:"Search is unavailable.");}finally{setSearching(false);}
  }
  async function openPage(url:string){
    const target=url.trim().startsWith("http://")||url.trim().startsWith("https://")?url.trim():"https://"+url.trim();
    setAddressUrl(target);setOpening(true);setArticle(null);setSelectedPassage("");setError("");
    try{setArticle(await api<Article>("/explore/browse",{method:"POST",body:JSON.stringify({url:target})}));}
    catch(e){setError(e instanceof Error?e.message:"Could not open this page. Try the original website.");}finally{setOpening(false);}
  }
  async function saveSource(){
    if(!article)return;const existing=nodes.find(n=>n.kind==="source"&&n.source_url===article.url);
    if(existing){setSelectedId(existing.id);setPanel("knowledge");setNotice("This source is already in your graph.");return;}
    setBusy(true);
    try{const n=await api<Node>("/explore/graph/nodes",{method:"POST",body:JSON.stringify({kind:"source",title:article.title,source_url:article.url,body:"",...positionFor(nodes.length)})});setNodes(v=>[...v,n]);setSelectedId(n.id);setPanel("knowledge");setNotice("Source saved to your graph.");}
    catch(e){setError(e instanceof Error?e.message:"Could not save source.");}finally{setBusy(false);}
  }
  async function captureSelection(){
    if(!article)return;const quote=selectedPassage.trim();if(!quote){setError("Select a passage in the article first.");return;}if(quote.length>2000){setError("Passages are limited to 2,000 characters. Write a summary in your own words for longer material.");return;}
    setBusy(true);
    try{
      let source=nodes.find(n=>n.kind==="source"&&n.source_url===article.url);
      if(!source){source=await api<Node>("/explore/graph/nodes",{method:"POST",body:JSON.stringify({kind:"source",title:article.title,source_url:article.url,body:"",...positionFor(nodes.length)})});setNodes(v=>[...v,source!]);}
      const note=await api<Node>("/explore/graph/nodes",{method:"POST",body:JSON.stringify({kind:"note",title:("Passage from "+article.title).slice(0,240),body:quote,source_url:article.url,...positionFor(nodes.length+1)})});
      const edge=await api<Edge>("/explore/graph/edges",{method:"POST",body:JSON.stringify({source_node_id:note.id,target_node_id:source.id,label:"quoted from"})});
      setNodes(v=>[...v,note]);setEdges(v=>[...v,edge]);setSelectedId(note.id);setPanel("knowledge");setSelectedPassage("");setNotice("Passage captured and linked to its source.");
    }catch(e){setError(e instanceof Error?e.message:"Could not capture passage.");}finally{setBusy(false);}
  }

  return <section className="atlas-knowledge" aria-label="Interactive knowledge graph and research workspace">
    <header className="atlas-knowledge-heading"><div><p className="eyebrow">YOUR IDEAS, YOUR CONNECTIONS</p><h2>Build your <em>knowledge universe.</em></h2><p>Explore a question, collect sources, and connect the ideas that make sense to you.</p></div>
      <div className="atlas-knowledge-actions"><button className={"atlas-button "+(connect?"atlas-primary":"atlas-secondary")} disabled={nodes.length<2} onClick={()=>{setConnect(v=>!v);setConnectFrom(null);setNotice(connect?"Connection mode closed.":"Select two nodes to connect them.");}}><GitBranch size={15}/>{connect?"Cancel connection":"Connect nodes"}</button><button className="atlas-button atlas-primary" onClick={()=>{setCreating(true);setPanel("knowledge");setSelectedId(null);}}><Plus size={15}/> Add node</button></div>
    </header>
    {error&&<div className="atlas-knowledge-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {notice&&!error&&<p className="atlas-knowledge-notice" role="status">{notice}</p>}
    <div className="atlas-knowledge-layout">
      <div className="atlas-graph-panel"><div className="atlas-graph-toolbar"><span><Network size={14}/> KNOWLEDGE GRAPH</span><span>{visibleNodes.length} / {nodes.length} NODES · {visibleEdges.length} / {edges.length} CONNECTIONS</span></div>
        {nodes.length>0&&<div className="atlas-graph-filters">
          <label className="atlas-graph-filter-search"><Search size={14}/><input aria-label="Search saved knowledge" value={graphSearch} onChange={event=>setGraphSearch(event.target.value)} placeholder="Find a node, note, or source…"/>{graphSearch&&<button type="button" onClick={()=>setGraphSearch("")} aria-label="Clear graph search"><X size={13}/></button>}</label>
          <select aria-label="Filter by node type" value={kindFilter} onChange={event=>setKindFilter(event.target.value as "all"|Kind)}><option value="all">All types</option>{kinds.map(value=><option key={value} value={value}>{pretty[value]}</option>)}</select>
          <label className="atlas-graph-connected-filter"><input type="checkbox" checked={connectedOnly} onChange={event=>setConnectedOnly(event.target.checked)}/> Connected only</label>
          {(graphSearch||kindFilter!=="all"||connectedOnly)&&<button type="button" className="atlas-graph-clear-filters" onClick={()=>{setGraphSearch("");setKindFilter("all");setConnectedOnly(false);}}>Clear</button>}
        </div>
        {connect&&<div className="atlas-connect-hint"><span>{connectFrom===null?"Choose the starting node":"Choose the node to connect to"}</span><input aria-label="Connection label" value={relation} onChange={e=>setRelation(e.target.value)}/></div>}
        {loading?<div className="atlas-knowledge-loading"><LoaderCircle className="atlas-spin" size={20}/> Loading graph…</div>:nodes.length===0?<div className="atlas-graph-empty"><Network size={30}/><h3>Your map starts with one idea.</h3><p>Add a topic, question, concept, or note. Then build connections as your understanding grows.</p><button className="atlas-button atlas-primary" onClick={()=>{setCreating(true);setPanel("knowledge");}}><Plus size={14}/> Create your first node</button></div>:<div className="atlas-graph-canvas">
          {visibleNodes.length>0?<GraphCanvas nodes={visibleNodes} edges={visibleEdges} selectedId={selectedId} onSelect={selectNode} onMove={moveNode} onCommit={commitPosition}/>:<div className="atlas-graph-filter-empty"><Search size={22}/><strong>No nodes match these filters.</strong><span>Try another search or clear the filters.</span></div>}
          <div className="atlas-graph-legend">{kinds.map(k=><span key={k}><i style={{background:colors[k]}}/>{pretty[k]}</span>)}</div><span className="atlas-graph-help">DRAG NODES TO ARRANGE · DRAG BACKGROUND TO ORBIT · SCROLL TO ZOOM</span>
        </div>}
        {nodes.length>0&&<div className="atlas-graph-node-shortcuts" aria-label="Graph nodes">{visibleNodes.map(node=><button key={node.id} className={selectedId===node.id?"active":""} onClick={()=>selectNode(node.id)}><i style={{background:colors[node.kind]}}/>{node.title}</button>)}</div>}
      </div>
      <aside className="atlas-knowledge-side"><div className="atlas-knowledge-tabs"><button className={panel==="research"?"active":""} onClick={()=>setPanel("research")}><Search size={14}/> Research</button><button className={panel==="knowledge"?"active":""} onClick={()=>setPanel("knowledge")}><StickyNote size={14}/> Knowledge</button></div>
        {panel==="research"?<div className="atlas-research-pane">
          <form className="atlas-research-search" onSubmit={search}><label htmlFor="atlas-research-query">SEARCH THE WEB</label><div><Search size={15}/><input id="atlas-research-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a question, concept, paper…"/><button type="submit" disabled={searching||!query.trim()} aria-label="Search">{searching?<LoaderCircle className="atlas-spin" size={15}/>:<ArrowUpRight size={15}/>}</button></div></form>\n          <form className="atlas-browser-address" onSubmit={event=>{event.preventDefault();if(addressUrl.trim())void openPage(addressUrl);}}><label htmlFor="atlas-browser-url">OPEN A WEBSITE</label><div><input id="atlas-browser-url" type="url" value={addressUrl} onChange={event=>setAddressUrl(event.target.value)} placeholder="Paste a website URL…"/><button type="submit" disabled={opening||!addressUrl.trim()}>Go</button></div></form>
          {article?<div className="atlas-browser-article"><button className="atlas-browser-back" onClick={()=>setArticle(null)}><ChevronLeft size={14}/> Back to results</button><div className="atlas-browser-meta"><span>{article.site_name}</span>{article.published_date&&<span>{article.published_date}</span>}</div><h3>{article.title}</h3>{article.author&&<p className="atlas-browser-author">By {article.author}</p>}
            <div className="atlas-browser-actions"><button className="atlas-button atlas-primary" onClick={()=>void saveSource()} disabled={busy}><Plus size={13}/> Save source</button><button className="atlas-button atlas-secondary" onClick={()=>void captureSelection()} disabled={busy||!selectedPassage}><StickyNote size={13}/> Capture selection</button><a href={article.url} target="_blank" rel="noreferrer" aria-label="Open original website"><ExternalLink size={14}/></a></div>
            <div className="atlas-browser-content" onMouseUp={()=>setSelectedPassage(window.getSelection()?.toString().trim()??"")} onKeyUp={()=>setSelectedPassage(window.getSelection()?.toString().trim()??"")}><ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content_markdown}</ReactMarkdown></div>
          </div>:opening?<div className="atlas-knowledge-loading"><LoaderCircle className="atlas-spin" size={18}/> Opening article…</div>:results.length?<div className="atlas-research-results"><div className="atlas-research-results-heading">SEARCH RESULTS <span>{results.length}</span></div>{results.map((r,i)=><article key={r.url+"-"+i} className="atlas-research-result"><span>{r.domain}{r.age?" · "+r.age:""}</span><button onClick={()=>void openPage(r.url)}>{r.title}<ArrowUpRight size={13}/></button><p>{r.description}</p></article>)}</div>:<div className="atlas-research-empty"><BookOpen size={22}/><h3>Research without leaving Atlas.</h3><p>Search for papers, concepts, explanations, and anything else you're curious about. Open a result to read it here, then save sources or capture passages into your graph.</p></div>}
          <p className="atlas-research-attribution">Search powered by DuckDuckGo. Results are temporary; only sources you explicitly save become part of your graph.</p>
        </div>:<div className="atlas-node-editor">
          {creating?<form onSubmit={createNode}><div className="atlas-node-editor-heading"><div><span>NEW KNOWLEDGE NODE</span><h3>Add an idea</h3></div><button type="button" onClick={()=>setCreating(false)} aria-label="Close"><X size={15}/></button></div>
            <label>Type<select value={kind} onChange={e=>setKind(e.target.value as Kind)}>{kinds.map(k=><option key={k} value={k}>{pretty[k]}</option>)}</select></label><label>Title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="What did you discover?" maxLength={240} required/></label><label>Your notes<textarea value={body} onChange={e=>setBody(e.target.value)} rows={7} placeholder="Explain it in your own words. Add questions, examples, or connections…"/></label>
            {kind==="source"&&<label>Source URL<input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://…"/></label>}<button className="atlas-button atlas-primary atlas-full" disabled={busy||!title.trim()}>{busy?"Adding…":"Add to graph"}<Plus size={14}/></button>
          </form>:selected?<div className="atlas-node-edit-form"><div className="atlas-node-editor-heading"><div><span>{pretty[selected.kind].toUpperCase()} · NODE #{selected.id}</span><h3>Knowledge details</h3></div><button type="button" onClick={()=>setSelectedId(null)} aria-label="Close"><X size={15}/></button></div>
            <label>Type<select value={editKind} onChange={e=>setEditKind(e.target.value as Kind)}>{kinds.map(k=><option key={k} value={k}>{pretty[k]}</option>)}</select></label><label>Title<input value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={240}/></label><label>Your notes<textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={10} placeholder="Write what you understand, what remains unclear, or how this connects…"/></label>
            {(editKind==="source"||editUrl)&&<label>Source URL<input type="url" value={editUrl} onChange={e=>setEditUrl(e.target.value)} placeholder="https://…"/></label>}
            {selected.source_url&&<a className="atlas-node-source-link" href={selected.source_url} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Open original source</a>}
            {connections.length>0&&<div className="atlas-node-connections"><span>CONNECTIONS</span>{connections.map(edge=>{const outgoing=edge.source_node_id===selected.id;const other=nodes.find(node=>node.id===(outgoing?edge.target_node_id:edge.source_node_id));return <div key={edge.id}><p><strong>{edge.label}</strong> {outgoing?"→":"←"} {other?.title??"Missing node"}</p><button type="button" aria-label={"Remove connection "+edge.label+" to "+(other?.title??"node")} onClick={()=>void deleteEdge(edge)}><X size={12}/></button></div>;})}</div>}
            <button className="atlas-button atlas-primary atlas-full" onClick={()=>void saveNode()} disabled={busy||!editTitle.trim()}><Check size={14}/> Save changes</button><button className="atlas-node-delete" onClick={()=>void deleteNode()} disabled={busy}><Trash2 size={13}/> Delete node and its connections</button>
          </div>:<div className="atlas-node-empty"><StickyNote size={23}/><h3>Make the knowledge yours.</h3><p>Select a node to edit it, or add a new topic, concept, question, note, source, or claim. All relationships are created by you.</p><button className="atlas-button atlas-primary" onClick={()=>setCreating(true)}><Plus size={14}/> Add a node</button></div>}
        </div>}
      </aside>
    </div>
  </section>;
}
