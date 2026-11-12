"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Bookmark, BookOpen, Check, ChevronLeft, ChevronRight,
  FileText, List, LoaderCircle, Maximize2, Minus, Plus, Search, StickyNote,
  Grid2X2, Trash2, X, PanelLeftClose, PanelLeftOpen, Highlighter, Underline, Lock, Download,
} from "lucide-react";
import { api, apiBlob } from "../../lib/api";

type PdfDocument = any;
type Mark = { id:number; page_number:number; label:string };
type Rect = { x:number; y:number; width:number; height:number };
type Annotation = { id:number; page_number:number; selected_text:string|null; note:string; highlight_rects:Rect[]|null; annotation_type:"highlight"|"underline"|"strikeout"|"comment"; color:"yellow"|"green"|"blue"|"pink"; created_at:string; updated_at:string };
type OutlineItem = { title:string; page:number|null; depth:number };
type AnnotationPayload = { page_number:number; selected_text:string; note:string; highlight_rects:Rect[]; annotation_type:"highlight"|"underline"|"strikeout"; color:"yellow"|"green"|"blue"|"pink" };
type Props = {
  documentId:number; title:string; pageCount:number; pdfUrl:string; initialPage:number;
  bookmarks:Mark[]; annotations:Annotation[]; readerMode:boolean;
  onExit:()=>void; onToggleFocus:()=>void; onProgressChange:(page:number)=>void;
  onBookmarksChange:(items:Mark[])=>void; onAnnotationsChange:(items:Annotation[])=>void;
  onError:(message:string)=>void;
};

function clamp(n:number,min:number,max:number){return Math.min(max,Math.max(min,n));}

function PdfPage({pdf,pageNumber,scale,searchTerm,annotations,onSelect}:{pdf:PdfDocument;pageNumber:number;scale:number;searchTerm:string;annotations:Annotation[];onSelect:(page:number,text:string,rects:Rect[],anchor:{left:number;top:number;width:number;height:number})=>void}) {
  const host=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [dimensions,setDimensions]=useState({width:0,height:0});
  useEffect(()=>{
    let cancelled=false; let renderTask:any; let page:any;
    const hostNode=host.current;
    if(!hostNode||!pdf)return;
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      try {
        page=await pdf.getPage(pageNumber);
        if(cancelled)return;
        const viewport=page.getViewport({scale});
        const canvas=canvasRef.current;
        if(!canvas)return;
        const ratio=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
        canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
        const context=canvas.getContext("2d");
        if(!context)return;
        // Build the selectable text layer before starting canvas rasterisation.
        // PDF.js can serialize work on a page; keeping extraction first avoids
        // leaving the text layer empty while a long-running render task is active.
        const text=await page.getTextContent();
        if(cancelled)return;
        const layer=hostNode.querySelector(".atlas-pdf-text-layer") as HTMLDivElement|null;
        if(layer){
          layer.replaceChildren();
          const viewportTransform=viewport.transform;
          for(const item of text.items as any[]){
            if(!item.str)continue;
            const tx=(window as any).pdfjsUtilTransform
              ? (window as any).pdfjsUtilTransform(viewportTransform,item.transform)
              : [0,0,0,0,0,0];
            const span=document.createElement("span");
            const fontHeight=Math.max(1,Math.hypot(tx[2],tx[3]));
            span.textContent=item.str;
            span.style.left=`${tx[4]}px`;
            span.style.top=`${tx[5]-fontHeight}px`;
            span.style.fontSize=`${fontHeight}px`;
            span.style.height=`${fontHeight*1.2}px`;
            span.style.width=`${Math.max(1,item.width*scale)}px`;
            span.style.fontFamily="sans-serif";
            layer.appendChild(span);
          }
        }
        renderTask=page.render({canvasContext:context,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null});
        await renderTask.promise;
        if(cancelled)return;
        setDimensions({width:viewport.width,height:viewport.height});
      } catch(error){if(!cancelled)console.error("PDF page render failed",error);}
    },{root:hostNode.closest(".atlas-pdf-scroll"),rootMargin:"900px 0px",threshold:0});
    observer.observe(hostNode);
    return ()=>{cancelled=true;observer.disconnect();try{renderTask?.cancel();}catch{}};
  },[pdf,pageNumber,scale]);

  useEffect(()=>{
    const layer=host.current?.querySelector(".atlas-pdf-text-layer");
    if(!layer)return;
    const needle=searchTerm.trim().toLocaleLowerCase();
    layer.querySelectorAll("span").forEach(span=>{
      const hit=Boolean(needle&&span.textContent?.toLocaleLowerCase().includes(needle));
      span.classList.toggle("atlas-pdf-search-hit",hit);
    });
  },[searchTerm,dimensions.width,dimensions.height]);

  const selectText=()=>{
    const selection=window.getSelection();
    const text=selection?.toString().trim();
    const page=host.current;
    if(!selection||!text||!page||selection.rangeCount===0)return;

    // Selection can be created in the text layer and the mouseup target may
    // be a nested span. Verify the range belongs to this page before saving it.
    const range=selection.getRangeAt(0);
    const anchor=range.commonAncestorContainer;
    if(!page.contains(anchor.nodeType===Node.TEXT_NODE?anchor.parentNode:anchor))return;
    // The document-level listener intentionally receives events whose target
    // is the document; ownership is established by the selected range above.

    const pageRect=page.getBoundingClientRect();
    if(pageRect.width<=0||pageRect.height<=0)return;
    const rects=Array.from(range.getClientRects()).map(rect=>({
      x:clamp((rect.left-pageRect.left)/pageRect.width,0,1),
      y:clamp((rect.top-pageRect.top)/pageRect.height,0,1),
      width:clamp(rect.width/pageRect.width,0,1),
      height:clamp(rect.height/pageRect.height,0,1),
    })).filter(rect=>rect.width>0&&rect.height>0);
    onSelect(pageNumber,text,rects,(()=>{const rect=range.getBoundingClientRect();return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};})());
  };

  // Listen on the document too: PDF text selection can finish on an inner
  // text-layer span rather than bubbling through the page wrapper.
  useEffect(()=>{
    const handleMouseUp=()=>selectText();
    document.addEventListener("mouseup",handleMouseUp);
    return()=>document.removeEventListener("mouseup",handleMouseUp);
  },[pageNumber,onSelect]);
  return <div className="atlas-pdf-page-shell">
    <div className="atlas-pdf-page-label">PAGE {pageNumber}</div>
    <div className="atlas-pdf-page" ref={host} role="document" aria-label={`PDF page ${pageNumber}`} onMouseUp={selectText} style={{width:dimensions.width||"min(100%, 780px)",height:dimensions.height||Math.max(500,Math.round(990*scale))}}>
      <canvas ref={canvasRef} className="atlas-pdf-canvas" aria-hidden="true"/>
      <div className="atlas-pdf-text-layer"/>
      {annotations.filter(mark=>mark.page_number===pageNumber).flatMap(mark=>(mark.highlight_rects||[]).map((rect,index)=><span key={`${mark.id}-${index}`} className={`atlas-pdf-mark atlas-pdf-mark-${mark.annotation_type} atlas-pdf-color-${mark.color}`} title={mark.note||mark.selected_text||"PDF annotation"} style={{left:`${rect.x*100}%`,top:`${rect.y*100}%`,width:`${rect.width*100}%`,height:`${rect.height*100}%`}}/>))}
    </div>
  </div>;
}

export default function PdfReaderWorkspace(props:Props) {
  const {documentId,title,pageCount,pdfUrl,initialPage,bookmarks,annotations,readerMode,onExit,onToggleFocus,onProgressChange,onBookmarksChange,onAnnotationsChange,onError}=props;
  const [pdf,setPdf]=useState<PdfDocument|null>(null);
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(initialPage);
  const [pageInput,setPageInput]=useState(String(initialPage));
  const [zoom,setZoom]=useState<"width"|"page"|number>("width");
  const [scale,setScale]=useState(1);
  const [activePanel,setActivePanel]=useState<"thumbnails"|"outline"|"annotations"|"bookmarks">("thumbnails");
  const [outline,setOutline]=useState<OutlineItem[]>([]);
  const [pageSizes,setPageSizes]=useState<Record<number,{width:number;height:number}>>({});
  const [query,setQuery]=useState("");
  const [searching,setSearching]=useState(false);
  const [matches,setMatches]=useState<{page:number;snippet:string}[]>([]);
  const [selectedText,setSelectedText]=useState("");
  const [selectedRects,setSelectedRects]=useState<Rect[]>([]);
  const [selectedPage,setSelectedPage]=useState(initialPage);
  const [note,setNote]=useState("");
  const [selectionAnchor,setSelectionAnchor]=useState<{left:number;top:number;width:number;height:number}|null>(null);
  const [commentMode,setCommentMode]=useState(false);
  const [lockedTool,setLockedTool]=useState<{type:"highlight"|"underline";color:"yellow"|"green"|"blue"|"pink"}|null>(null);
  const [lockedColor,setLockedColor]=useState<"yellow"|"green"|"blue"|"pink">("yellow");
  const [selectionRevision,setSelectionRevision]=useState(0);
  const lastAutoSavedRevision=useRef(0);
  const [annotationSearch,setAnnotationSearch]=useState("");
  const [annotationTypeFilter,setAnnotationTypeFilter]=useState("all");
  const [annotationColorFilter,setAnnotationColorFilter]=useState("all");
  const [editingAnnotationId,setEditingAnnotationId]=useState<number|null>(null);
  const [editingAnnotationNote,setEditingAnnotationNote]=useState("");
  const [editingAnnotationType,setEditingAnnotationType]=useState<"highlight"|"underline"|"strikeout">("highlight");
  const [editingAnnotationColor,setEditingAnnotationColor]=useState<"yellow"|"green"|"blue"|"pink">("yellow");
  const [annotationRetry,setAnnotationRetry]=useState<{message:string;run:()=>Promise<void>}|null>(null);
  const [readingTheme,setReadingTheme]=useState<"paper"|"sepia"|"dark">("paper");
  const [themeDocumentId,setThemeDocumentId]=useState<number|null>(null);
  const [exporting,setExporting]=useState(false);
  const [saving,setSaving]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const scrollRef=useRef<HTMLDivElement>(null);
  const pageRefs=useRef<Map<number,HTMLDivElement>>(new Map());
  const currentPageRef=useRef(initialPage);
  const pendingNavigation=useRef<number|null>(null);
  const pdfRef=useRef<PdfDocument|null>(null);
  const scaleMode=useRef<"width"|"page"|number>("width");
  const scaleRequest=useRef(0);

  useEffect(()=>{
    try{
      const saved=window.localStorage.getItem(`atlas:pdf-theme:${documentId}`);
      setReadingTheme(saved==="sepia"||saved==="dark"?saved:"paper");
    }catch{setReadingTheme("paper");}
    setThemeDocumentId(documentId);
  },[documentId]);
  useEffect(()=>{
    if(themeDocumentId!==documentId)return;
    try{window.localStorage.setItem(`atlas:pdf-theme:${documentId}`,readingTheme);}
    catch{onError("Could not save this document's reading theme in this browser.");}
  },[documentId,readingTheme,themeDocumentId,onError]);

  useEffect(()=>{
    let cancelled=false;let task:any;
    setLoading(true);setPdf(null);
    (async()=>{
      try{
        const pdfjs:any=await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.mjs",import.meta.url).toString();
        const response=await fetch(pdfUrl);
        if(!response.ok)throw new Error("Could not load this PDF.");
        const data=await response.arrayBuffer();
        task=pdfjs.getDocument({data});
        const doc=await task.promise;
        if(cancelled){await doc.destroy();return;}
        (window as any).pdfjsUtilTransform=pdfjs.Util.transform;
        pdfRef.current=doc;setPdf(doc);setPageSizes({});
        const raw=await doc.getOutline();
        const items:OutlineItem[]=[];
        const walk=async(nodes:any[],depth:number)=>{
          for(const node of nodes||[]){
            let target:number|null=null;
            try{
              const dest=typeof node.dest==="string"?await doc.getDestination(node.dest):node.dest;
              if(dest){const ref=dest[0];target=(await doc.getPageIndex(ref))+1;}
            }catch{}
            items.push({title:node.title||"Untitled section",page:target,depth});
            if(node.items?.length)await walk(node.items,depth+1);
          }
        };
        await walk(raw||[],0);
        if(!cancelled)setOutline(items);
      }catch(error){if(!cancelled)onError(error instanceof Error?error.message:"Could not open this PDF.");}
      finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;try{task?.destroy();}catch{};pdfRef.current=null;};
  },[pdfUrl,onError]);

  useEffect(()=>{
    if(!pdf)return;
    let cancelled=false;
    const start=Math.max(1,page-8),end=Math.min(pageCount,page+8);
    (async()=>{
      for(let number=start;number<=end;number++){
        try{
          const proxy=await pdf.getPage(number);
          if(cancelled)return;
          const viewport=proxy.getViewport({scale:1});
          setPageSizes(current=>current[number]?current:{...current,[number]:{width:viewport.width,height:viewport.height}});
        }catch(error){if(!cancelled)console.debug(`Could not measure PDF page ${number}`,error);}
      }
    })();
    return()=>{cancelled=true;};
  },[pdf,page,pageCount]);

  const updateScale=useCallback(()=>{
    const container=scrollRef.current;const document=pdfRef.current;if(!container||!document)return;
    const request=++scaleRequest.current;
    const width=Math.max(260,container.clientWidth-56);
    const pageHeight=Math.max(280,container.clientHeight-48);
    document.getPage(page).then((p:any)=>{
      if(request!==scaleRequest.current)return;
      const base=p.getViewport({scale:1});
      const widthScale=width/base.width;
      const fitPage=Math.min(widthScale,pageHeight/base.height);
      const mode=scaleMode.current;
      setScale(mode==="width"?widthScale:mode==="page"?fitPage:clamp(mode/100,.5,3));
    }).catch(()=>{});
  },[page]);
  useEffect(()=>{updateScale();const node=scrollRef.current;if(!node)return;const observer=new ResizeObserver(updateScale);observer.observe(node);return()=>observer.disconnect();},[updateScale,pdf]);

  useEffect(()=>{
    const root=scrollRef.current;if(!pdf||!root)return;
    let frame=0;
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const bounds=root.getBoundingClientRect();const center=(bounds.top+bounds.bottom)/2;
        let nearest=page;let distance=Number.POSITIVE_INFINITY;
        root.querySelectorAll<HTMLElement>("[data-page]").forEach(node=>{
          const rect=node.getBoundingClientRect();
          if(rect.bottom<=bounds.top||rect.top>=bounds.bottom)return;
          const next=Number(node.dataset.page);const delta=Math.abs((rect.top+rect.bottom)/2-center);
          if(delta<distance){distance=delta;nearest=next;}
        });
        if(pendingNavigation.current!==null){
          if(nearest!==pendingNavigation.current)return;
          pendingNavigation.current=null;
        }
        if(nearest!==page){currentPageRef.current=nearest;setPage(nearest);onProgressChange(nearest);}
      });
    };
    const repositionSelection=()=>{
      const selection=window.getSelection();
      if(!selection||selection.isCollapsed||!selection.rangeCount){setSelectionAnchor(null);return;}
      const rect=selection.getRangeAt(0).getBoundingClientRect();
      if(rect.bottom<0||rect.top>window.innerHeight){setSelectionAnchor(null);return;}
      setSelectionAnchor({left:rect.left,top:rect.top,width:rect.width,height:rect.height});
    };
    const finishNavigation=()=>{pendingNavigation.current=null;update();};
    root.addEventListener("scroll",update,{passive:true});
    root.addEventListener("scroll",repositionSelection,{passive:true});
    root.addEventListener("scrollend",finishNavigation);
    update();
    return()=>{root.removeEventListener("scroll",update);root.removeEventListener("scroll",repositionSelection);root.removeEventListener("scrollend",finishNavigation);cancelAnimationFrame(frame);};
  },[pdf,scale,page,onProgressChange]);

  const goToPage=useCallback((next:number)=>{
    const target=clamp(next,1,pageCount);
    setSelectionAnchor(null);setPageInput(String(target));
    if(target===currentPageRef.current)return;
    currentPageRef.current=target;
    pendingNavigation.current=target;
    setPage(target);onProgressChange(target);
    window.requestAnimationFrame(()=>{
      const root=scrollRef.current;const node=pageRefs.current.get(target);
      if(!root||!node)return;
      const top=node.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop;
      const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      root.scrollTo({top,behavior:reducedMotion?"auto":"smooth"});
    });
  },[pageCount,onProgressChange]);
  useEffect(()=>{if(pdf&&initialPage>1){const timer=window.setTimeout(()=>goToPage(initialPage),180);return()=>clearTimeout(timer);}},[pdf,initialPage,goToPage]);

  useEffect(()=>{
    const handleReaderKeys=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const editing=Boolean(target&&(target.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(target.tagName)));
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="f"){
        event.preventDefault();setShowSearch(true);return;
      }
      if(editing)return;
      if(event.key==="Escape"){
        setSelectionAnchor(null);setSelectedText("");setSelectedRects([]);setCommentMode(false);return;
      }
      if(event.key==="ArrowRight"||event.key==="PageDown"){
        event.preventDefault();goToPage(page+1);return;
      }
      if(event.key==="ArrowLeft"||event.key==="PageUp"){
        event.preventDefault();goToPage(page-1);return;
      }
      if(event.key==="+"||event.key==="="){
        event.preventDefault();const next=clamp(Math.round(scale*100)+10,50,300);scaleMode.current=next;setZoom(next);setScale(next/100);return;
      }
      if(event.key==="-"){
        event.preventDefault();const next=clamp(Math.round(scale*100)-10,50,300);scaleMode.current=next;setZoom(next);setScale(next/100);
      }
    };
    window.addEventListener("keydown",handleReaderKeys);
    return()=>window.removeEventListener("keydown",handleReaderKeys);
  },[goToPage,page,scale]);

  async function searchPdf(event?:React.FormEvent){
    event?.preventDefault();if(!pdf||!query.trim())return;
    setSearching(true);setMatches([]);
    try{
      const needle=query.trim().toLocaleLowerCase();const found:{page:number;snippet:string}[]=[];
      for(let p=1;p<=pageCount;p++){
        const pageProxy=await pdf.getPage(p);const text=await pageProxy.getTextContent();
        const joined=(text.items as any[]).map(item=>item.str||"").join(" ");
        const lower=joined.toLocaleLowerCase();let index=lower.indexOf(needle);
        while(index>=0){found.push({page:p,snippet:joined.slice(Math.max(0,index-65),Math.min(joined.length,index+needle.length+90))});index=lower.indexOf(needle,index+needle.length);if(found.length>=250)break;}
        if(found.length>=250)break;
      }
      setMatches(found);if(found[0])goToPage(found[0].page);
    }catch(error){onError(error instanceof Error?error.message:"PDF search failed.");}
    finally{setSearching(false);}
  }

  async function addBookmark(){
    setSaving(true);
    try{const item=await api<Mark>(`/explore/documents/${documentId}/bookmarks`,{method:"POST",body:JSON.stringify({page_number:page,label:`Page ${page}`})});onBookmarksChange([...bookmarks.filter(mark=>mark.page_number!==page),item].sort((a,b)=>a.page_number-b.page_number));}
    catch(error){onError(error instanceof Error?error.message:"Could not save bookmark.");}
    finally{setSaving(false);}
  }
  async function persistAnnotation(payload:AnnotationPayload){
    setSaving(true);setAnnotationRetry(null);
    try{
      const item=await api<Annotation>(`/explore/documents/${documentId}/annotations`,{method:"POST",body:JSON.stringify(payload)});
      onAnnotationsChange([item,...annotations]);
      setNote("");setSelectedText("");setSelectedRects([]);setSelectionAnchor(null);setCommentMode(false);window.getSelection()?.removeAllRanges();
      setActivePanel("annotations");
    }catch(error){
      const message=error instanceof Error?error.message:"Could not save annotation.";
      setAnnotationRetry({message,run:()=>persistAnnotation(payload)});
    }finally{setSaving(false);}
  }
  async function saveAnnotation(annotationType:"highlight"|"underline"|"strikeout"="highlight",color:"yellow"|"green"|"blue"|"pink"="yellow",comment=note.trim()){
    if(!selectedText.trim()||!selectedRects.length)return;
    await persistAnnotation({page_number:selectedPage,selected_text:selectedText,note:comment,highlight_rects:selectedRects,annotation_type:annotationType,color});
  }
  function toggleLockedTool(type:"highlight"|"underline"){
    if(lockedTool?.type===type){setLockedTool(null);return;}
    lastAutoSavedRevision.current=selectionRevision;
    setLockedTool({type,color:lockedColor});
    setCommentMode(false);
  }
  useEffect(()=>{
    if(!lockedTool||selectionRevision===0||selectionRevision<=lastAutoSavedRevision.current)return;
    if(!selectedText.trim()||!selectedRects.length)return;
    lastAutoSavedRevision.current=selectionRevision;
    void saveAnnotation(lockedTool.type,lockedTool.color,"");
  },[selectionRevision,lockedTool]);
  async function persistAnnotationUpdate(id:number,payload:{note:string;annotation_type:"highlight"|"underline"|"strikeout";color:"yellow"|"green"|"blue"|"pink"}){
    setSaving(true);setAnnotationRetry(null);
    try{
      const updated=await api<Annotation>(`/explore/documents/${documentId}/annotations/${id}`,{method:"PATCH",body:JSON.stringify(payload)});
      onAnnotationsChange(annotations.map(item=>item.id===id?updated:item));
      setEditingAnnotationId(null);setEditingAnnotationNote("");
    }catch(error){
      const message=error instanceof Error?error.message:"Could not update annotation.";
      setAnnotationRetry({message,run:()=>persistAnnotationUpdate(id,payload)});
    }finally{setSaving(false);}
  }
  async function updateAnnotation(id:number){
    await persistAnnotationUpdate(id,{note:editingAnnotationNote,annotation_type:editingAnnotationType,color:editingAnnotationColor});
  }
  async function exportAnnotatedPdf(){
    setExporting(true);
    try{
      const blob=await apiBlob(`/explore/documents/${documentId}/export`);
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");link.href=url;
      const base=title.replace(/\.pdf$/i,"").replace(/[^a-z0-9-_]+/gi,"-").replace(/^-+|-+$/g,"")||"document";
      link.download=`${base}-annotated.pdf`;document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){onError(error instanceof Error?error.message:"Could not export annotated PDF.");}
    finally{setExporting(false);}
  }
  const visibleAnnotations=useMemo(()=>annotations.filter(item=>{
    const text=`${item.selected_text||""} ${item.note||""}`.toLocaleLowerCase();
    return (!annotationSearch.trim()||text.includes(annotationSearch.trim().toLocaleLowerCase()))
      &&(annotationTypeFilter==="all"||item.annotation_type===annotationTypeFilter)
      &&(annotationColorFilter==="all"||item.color===annotationColorFilter);
  }),[annotations,annotationSearch,annotationTypeFilter,annotationColorFilter]);
  async function deleteBookmark(id:number){
    try{await api<void>(`/explore/documents/${documentId}/bookmarks/${id}`,{method:"DELETE"});onBookmarksChange(bookmarks.filter(item=>item.id!==id));}
    catch(error){onError(error instanceof Error?error.message:"Could not remove bookmark.");}
  }
  async function persistAnnotationDelete(id:number){
    setSaving(true);setAnnotationRetry(null);
    try{await api<void>(`/explore/documents/${documentId}/annotations/${id}`,{method:"DELETE"});onAnnotationsChange(annotations.filter(item=>item.id!==id));}
    catch(error){
      const message=error instanceof Error?error.message:"Could not remove annotation.";
      setAnnotationRetry({message,run:()=>persistAnnotationDelete(id)});
    }finally{setSaving(false);}
  }
  async function deleteAnnotation(id:number){await persistAnnotationDelete(id);}
  useEffect(()=>{currentPageRef.current=page;setSelectedPage(page);setPageInput(String(page));},[page]);
  const currentBookmark=bookmarks.some(mark=>mark.page_number===page);
  const pageNumbers=useMemo(()=>Array.from({length:pageCount},(_,index)=>index+1),[pageCount]);

  return <div className={`atlas-reader theme-${readingTheme} ${readerMode?"is-focus":""}`}>
    <header className="atlas-reader-header">
      <button className="atlas-reader-back" onClick={onExit}><ArrowLeft size={15}/> Library</button>
      <div className="atlas-reader-document-title"><FileText size={16}/><span>{title}</span><small>PDF</small></div>
      <button className="atlas-reader-mode" onClick={onToggleFocus}><Maximize2 size={14}/>{readerMode?"Exit focus":"Focus mode"}</button>
    </header>
    <div className="atlas-reader-toolbar">
      <div className="atlas-reader-page-control"><button onClick={()=>goToPage(page-1)} disabled={page<=1} aria-label="Previous page"><ChevronLeft size={16}/></button><input aria-label="Current page" value={pageInput} inputMode="numeric" onChange={e=>setPageInput(e.target.value.replace(/[^0-9]/g,""))} onBlur={()=>{const n=Number(pageInput);goToPage(Number.isFinite(n)&&n>0?n:page);}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const n=Number(pageInput);goToPage(Number.isFinite(n)&&n>0?n:page);}}}/><span>/ {pageCount}</span><button onClick={()=>goToPage(page+1)} disabled={page>=pageCount} aria-label="Next page"><ChevronRight size={16}/></button></div>
      <div className="atlas-reader-toolbar-divider"/>
      <button className={`atlas-reader-tool ${zoom==="width"?"active":""}`} onClick={()=>{scaleMode.current="width";setZoom("width");updateScale();}}>Fit width</button>
      <button className={`atlas-reader-tool ${zoom==="page"?"active":""}`} onClick={()=>{scaleMode.current="page";setZoom("page");updateScale();}}>Fit page</button>
      <div className="atlas-reader-zoom"><button onClick={()=>{const n=clamp(scale*100-10,50,300);scaleMode.current=n;setZoom(n);updateScale();}} aria-label="Zoom out"><Minus size={14}/></button><span>{Math.round(scale*100)}%</span><button onClick={()=>{const n=clamp(scale*100+10,50,300);scaleMode.current=n;setZoom(n);updateScale();}} aria-label="Zoom in"><Plus size={14}/></button></div>
      <div className="atlas-reader-tool-group" aria-label="Annotation modes">
        <button className={lockedTool?.type==="highlight"?"atlas-reader-tool active":"atlas-reader-tool"} onClick={()=>toggleLockedTool("highlight")} aria-pressed={lockedTool?.type==="highlight"} title="Lock highlighter mode" aria-label="Toggle locked highlight mode"><Highlighter size={14}/> Highlight {lockedTool?.type==="highlight"&&<Lock size={11}/>}</button>
        <button className={lockedTool?.type==="underline"?"atlas-reader-tool active":"atlas-reader-tool"} onClick={()=>toggleLockedTool("underline")} aria-pressed={lockedTool?.type==="underline"} title="Lock underline mode" aria-label="Toggle locked underline mode"><Underline size={14}/> Underline {lockedTool?.type==="underline"&&<Lock size={11}/>}</button>
        <select aria-label="Annotation colour" value={lockedColor} onChange={event=>{const color=event.target.value as typeof lockedColor;setLockedColor(color);setLockedTool(current=>current?{...current,color}:null);}} className="atlas-reader-theme-select">
          <option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="pink">Pink</option>
        </select>
      </div>
      <select aria-label="Reading theme" value={readingTheme} onChange={event=>setReadingTheme(event.target.value as typeof readingTheme)} className="atlas-reader-theme-select">
        <option value="paper">Paper</option><option value="sepia">Sepia</option><option value="dark">Dark</option>
      </select>
      <button className="atlas-reader-tool" onClick={()=>void exportAnnotatedPdf()} disabled={exporting} title="Download a copy with PDF annotations"><Download size={14}/>{exporting?"Exporting…":"Export PDF"}</button>
      <button className={`atlas-reader-tool ${showSearch?"active":""}`} onClick={()=>setShowSearch(v=>!v)}><Search size={14}/> Search</button>
      <button className={`atlas-reader-tool ${currentBookmark?"active":""}`} onClick={()=>void addBookmark()} disabled={saving} title="Bookmark current page"><Bookmark size={14}/> Bookmark</button>
      <button className="atlas-reader-tool" onClick={()=>setSidebarOpen(v=>!v)} aria-label={sidebarOpen?"Hide sidebar":"Show sidebar"}>{sidebarOpen?<PanelLeftClose size={14}/>:<PanelLeftOpen size={14}/>}</button>
    </div>
    {annotationRetry&&<div className="atlas-reader-mutation-retry" role="alert"><span>{annotationRetry.message}</span><button type="button" onClick={()=>void annotationRetry.run()} disabled={saving}>Retry annotation change</button><button type="button" onClick={()=>setAnnotationRetry(null)} disabled={saving} aria-label="Dismiss annotation error"><X size={13}/></button></div>}
    {showSearch&&<><form className="atlas-pdf-search" onSubmit={searchPdf}><Search size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search words or phrases in this PDF…"/><button disabled={searching||!query.trim()}>{searching?"Searching…":"Find"}</button><button type="button" onClick={()=>{setShowSearch(false);setMatches([]);}} aria-label="Close search"><X size={15}/></button></form>{matches.length>0&&<div className="atlas-pdf-search-results" aria-live="polite">{matches.map((match,index)=><button key={`${match.page}-${index}`} onClick={()=>goToPage(match.page)}><strong>Page {match.page}</strong>{match.snippet}</button>)}</div>}{!searching&&query.trim()&&matches.length===0&&<div className="atlas-pdf-search-results"><span className="atlas-reader-empty">No matches found. Press Find to search the document.</span></div>}</>}
    {selectionAnchor&&selectedText&&!lockedTool&&<div className="atlas-pdf-selection-toolbar" style={{left:`clamp(170px, ${selectionAnchor.left+selectionAnchor.width/2}px, calc(100vw - 170px))`,top:`max(12px, ${selectionAnchor.top-52}px)`}} role="toolbar" aria-label="Annotate selected text">
      <span>Mark</span>
      {(["yellow","green","blue","pink"] as const).map(color=><button key={color} type="button" className={`atlas-pdf-color-swatch atlas-pdf-swatch-${color}`} title={`Highlight ${color}`} aria-label={`Highlight in ${color}`} disabled={saving} onMouseDown={event=>event.preventDefault()} onClick={()=>void saveAnnotation("highlight",color,"")}/>)}
      <i/>
      <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>void saveAnnotation("underline","yellow","")} disabled={saving} title="Underline selection">U</button>
      <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>void saveAnnotation("strikeout","pink","")} disabled={saving} title="Strike through selection"><s>S</s></button>
      <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{setCommentMode(true);setActivePanel("annotations");setSidebarOpen(true);}} disabled={saving} title="Add a comment"><StickyNote size={14}/></button>
      <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{setSelectedText("");setSelectedRects([]);setSelectionAnchor(null);}} aria-label="Dismiss selection toolbar"><X size={13}/></button>
    </div>}
    <div className={`atlas-reader-body ${sidebarOpen?"":"sidebar-hidden"}`}>
      <main className="atlas-pdf-stage">
        <div className="atlas-pdf-scroll" ref={scrollRef} role="region" aria-label="PDF pages" tabIndex={0}>
          {loading?<div className="atlas-explore-state"><LoaderCircle className="atlas-spin" size={20}/>Preparing your reader…</div>:pdf?<div className="atlas-pdf-pages">{pageNumbers.map(number=><div key={number} id={`atlas-pdf-page-${number}`} data-page={number} className="atlas-pdf-virtual-slot" ref={node=>{if(node)pageRefs.current.set(number,node);else pageRefs.current.delete(number);}}>{Math.abs(number-page)<=4?<PdfPage pdf={pdf} pageNumber={number} scale={scale} searchTerm={query} annotations={annotations} onSelect={(p,text,rects,anchor)=>{setSelectedPage(p);setSelectedText(text);setSelectedRects(rects);setSelectionAnchor(anchor);setCommentMode(false);setSelectionRevision(value=>value+1);}}/>:<div className="atlas-pdf-virtual-placeholder" style={{height:Math.max(280,Math.round((pageSizes[number]?.height??pageSizes[1]?.height??990)*scale))}} aria-hidden="true"/>}</div>)}</div>:<div className="atlas-explore-state">Unable to render this PDF.</div>}
        </div>
        <div className="atlas-reader-status" role="status" aria-live="polite"><span>PAGE {page} OF {pageCount}</span><span>{Math.round(page/pageCount*100)}% THROUGH</span></div>
      </main>
      {sidebarOpen&&<aside className="atlas-reader-sidebar">
        <div className="atlas-reader-tabs" role="tablist" aria-label="PDF navigation panels" onKeyDown={event=>{if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;event.preventDefault();const panels=["thumbnails","outline","annotations","bookmarks"] as const;const current=panels.indexOf(activePanel);const next=panels[(current+(event.key==="ArrowRight"?1:-1)+panels.length)%panels.length];setActivePanel(next);window.requestAnimationFrame(()=>document.getElementById("atlas-reader-tab-"+next)?.focus());}}>
          <button role="tab" aria-selected={activePanel==="thumbnails"} tabIndex={activePanel==="thumbnails"?0:-1} id="atlas-reader-tab-thumbnails" className={activePanel==="thumbnails"?"active":""} onClick={()=>setActivePanel("thumbnails")}><Grid2X2 size={14}/> Pages</button>
          <button role="tab" aria-selected={activePanel==="outline"} tabIndex={activePanel==="outline"?0:-1} id="atlas-reader-tab-outline" className={activePanel==="outline"?"active":""} onClick={()=>setActivePanel("outline")}><List size={14}/> Outline</button>
          <button role="tab" aria-selected={activePanel==="annotations"} tabIndex={activePanel==="annotations"?0:-1} id="atlas-reader-tab-annotations" className={activePanel==="annotations"?"active":""} onClick={()=>setActivePanel("annotations")}><StickyNote size={14}/> Marks <span>{annotations.length}</span></button>
          <button role="tab" aria-selected={activePanel==="bookmarks"} tabIndex={activePanel==="bookmarks"?0:-1} id="atlas-reader-tab-bookmarks" className={activePanel==="bookmarks"?"active":""} onClick={()=>setActivePanel("bookmarks")}><Bookmark size={14}/> Saved <span>{bookmarks.length}</span></button>
        </div>
        {activePanel==="thumbnails"&&<div id="atlas-reader-panel-thumbnails" role="tabpanel" aria-labelledby="atlas-reader-tab-thumbnails" className="atlas-pdf-sidebar-scroll">{pageNumbers.map(number=><button key={number} aria-label={`Go to page ${number}`} className={`atlas-pdf-thumb ${page===number?"active":""}`} onClick={()=>goToPage(number)}><PdfThumbnail pdf={pdf} page={number}/><span>{number}</span></button>)}</div>}
        {activePanel==="outline"&&<div id="atlas-reader-panel-outline" role="tabpanel" aria-labelledby="atlas-reader-tab-outline" className="atlas-pdf-sidebar-scroll">{outline.length?outline.map((item,index)=><button key={index} className="atlas-pdf-outline-item" style={{paddingLeft:12+item.depth*13}} disabled={!item.page} onClick={()=>item.page&&goToPage(item.page)}><span>{item.title}</span>{item.page&&<small>{item.page}</small>}</button>):<p className="atlas-reader-empty">This document does not contain a navigable outline.</p>}</div>}
        {activePanel==="annotations"&&<div id="atlas-reader-panel-annotations" role="tabpanel" aria-labelledby="atlas-reader-tab-annotations" className="atlas-pdf-sidebar-scroll">
          {selectedText&&commentMode&&<form className="atlas-reader-note-form" onSubmit={event=>{event.preventDefault();void saveAnnotation("highlight","yellow",note.trim());}}><p className="eyebrow">SELECTED PASSAGE · PAGE {selectedPage}</p><blockquote className="atlas-pdf-selection-preview">{selectedText}</blockquote><label>Comment <small>OPTIONAL · ATTACHED TO THIS MARK</small><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add context to this highlight…"/></label><div className="atlas-reader-annotation-form-actions"><button type="submit" className="atlas-button atlas-primary atlas-full" disabled={saving||!selectedRects.length}>{saving?"Saving…":"Save highlight & comment"}<Check size={14}/></button><button type="button" onClick={()=>{setSelectedText("");setSelectedRects([]);setSelectionAnchor(null);setNote("");}} className="atlas-reader-clear-selection">Clear selection</button></div></form>}
          <div className="atlas-reader-list-heading">ANNOTATIONS · {visibleAnnotations.length} OF {annotations.length}</div>
          <input className="atlas-reader-annotation-search" aria-label="Search annotations" value={annotationSearch} onChange={event=>setAnnotationSearch(event.target.value)} placeholder="Find a passage or comment…"/>
          <div className="atlas-reader-annotation-filters">
            <select aria-label="Filter annotation type" value={annotationTypeFilter} onChange={event=>setAnnotationTypeFilter(event.target.value)}><option value="all">All marks</option><option value="highlight">Highlights</option><option value="underline">Underlines</option><option value="strikeout">Strike-throughs</option><option value="comment">Comments</option></select>
            <select aria-label="Filter annotation colour" value={annotationColorFilter} onChange={event=>setAnnotationColorFilter(event.target.value)}><option value="all">All colours</option><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="pink">Pink</option></select>
          </div>
          {visibleAnnotations.length?visibleAnnotations.map(item=><article className={`atlas-reader-note atlas-reader-mark-card atlas-pdf-color-${item.color}`} key={item.id}>
            <button className="atlas-reader-note-page" onClick={()=>goToPage(item.page_number)}>{item.annotation_type.toUpperCase()} · PAGE {item.page_number} <ArrowUpRight size={11}/></button>
            {item.selected_text&&<blockquote>{item.selected_text}</blockquote>}
            {editingAnnotationId===item.id?<div className="atlas-reader-edit-comment">
              <label>Comment<textarea aria-label="Edit annotation comment" rows={3} value={editingAnnotationNote} onChange={event=>setEditingAnnotationNote(event.target.value)}/></label>
              <div className="atlas-reader-annotation-edit-fields">
                <label>Mark type<select aria-label="Edit annotation type" value={editingAnnotationType} onChange={event=>setEditingAnnotationType(event.target.value as typeof editingAnnotationType)}><option value="highlight">Highlight</option><option value="underline">Underline</option><option value="strikeout">Strike-through</option></select></label>
                <label>Colour<select aria-label="Edit annotation colour" value={editingAnnotationColor} onChange={event=>setEditingAnnotationColor(event.target.value as typeof editingAnnotationColor)}><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="pink">Pink</option></select></label>
              </div>
              <div><button onClick={()=>void updateAnnotation(item.id)} disabled={saving}>Save changes</button><button onClick={()=>setEditingAnnotationId(null)} disabled={saving}>Cancel</button></div>
            </div>:item.note&&<p>{item.note}</p>}
            <div className="atlas-reader-mark-actions"><button onClick={()=>{setEditingAnnotationId(item.id);setEditingAnnotationNote(item.note);setEditingAnnotationType(item.annotation_type==="comment"?"highlight":item.annotation_type);setEditingAnnotationColor(item.color);}}>Edit annotation</button><button className="atlas-reader-note-delete" onClick={()=>void deleteAnnotation(item.id)} aria-label="Delete annotation"><Trash2 size={12}/></button></div>
          </article>):<p className="atlas-reader-empty">{annotations.length?"No annotations match these filters.":"Select a passage in the PDF to highlight it or attach a comment."}</p>}
        </div>}
        {activePanel==="bookmarks"&&<div id="atlas-reader-panel-bookmarks" role="tabpanel" aria-labelledby="atlas-reader-tab-bookmarks" className="atlas-pdf-sidebar-scroll"><div className="atlas-reader-list-heading">BOOKMARKED PAGES</div>{bookmarks.length?bookmarks.map(mark=><article className="atlas-reader-bookmark" key={mark.id}><button onClick={()=>goToPage(mark.page_number)}><Bookmark size={13}/><span><strong>{mark.label}</strong><small>Page {mark.page_number}</small></span><ArrowUpRight size={13}/></button><button className="atlas-reader-note-delete" onClick={()=>void deleteBookmark(mark.id)} aria-label="Remove bookmark"><Trash2 size={12}/></button></article>):<p className="atlas-reader-empty">Bookmark a page to find your way back to it.</p>}</div>}
        <div className="atlas-reader-sidebar-foot"><BookOpen size={13}/> Annotations stay attached to this document.</div>
      </aside>}
    </div>
  </div>;
}

function PdfThumbnail({pdf,page}:{pdf:PdfDocument|null;page:number}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const shell=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    let cancelled=false;let task:any;let proxy:any;
    const node=shell.current;if(!node||!pdf)return;
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      try{
        proxy=await pdf.getPage(page);if(cancelled)return;
        const viewport=proxy.getViewport({scale:.18});const el=canvas.current;if(!el)return;
        el.width=Math.floor(viewport.width*2);el.height=Math.floor(viewport.height*2);
        el.style.width=`${viewport.width}px`;el.style.height=`${viewport.height}px`;
        task=proxy.render({canvasContext:el.getContext("2d"),viewport,transform:[2,0,0,2,0,0]});
        await task.promise;
      }catch(error){if(!cancelled)console.debug("PDF thumbnail unavailable",error);}
    },{root:node.closest(".atlas-pdf-sidebar-scroll"),rootMargin:"240px 0px"});
    observer.observe(node);
    return()=>{cancelled=true;observer.disconnect();try{task?.cancel();}catch{};try{proxy?.cleanup();}catch{}};
  },[pdf,page]);
  return <span ref={shell} className="atlas-pdf-thumb-preview"><canvas ref={canvas}/></span>;
}
