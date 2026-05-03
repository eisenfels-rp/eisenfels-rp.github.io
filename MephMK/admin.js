
const cfg = window.EISENFELS_ADMIN_CONFIG;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let data = null;
let currentSha = null;
let activeTab = 'pages';
let selected = {};

function uid(prefix='id'){ return prefix + '-' + Math.random().toString(36).slice(2,8); }
async function sha256(text){ const enc=new TextEncoder().encode(text); const hash=await crypto.subtle.digest('SHA-256',enc); return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function setStatus(msg, ok=true){ const el=$('#status')||$('#loginStatus'); if(el){ el.textContent=msg; el.className=ok?'status-ok':'status-bad'; } }
function token(){ return $('#token').value.trim() || localStorage.getItem('ef_github_token') || ''; }
function repoApi(path){ return `https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${path}`; }
async function ghGet(path){
  const res=await fetch(repoApi(path)+`?ref=${cfg.branch}`,{headers:{Authorization:`Bearer ${token()}`,Accept:'application/vnd.github+json'}});
  if(!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}
async function ghPut(path, content, message, sha){
  const body={message,content:btoa(unescape(encodeURIComponent(content))),branch:cfg.branch};
  if(sha) body.sha=sha;
  const res=await fetch(repoApi(path),{method:'PUT',headers:{Authorization:`Bearer ${token()}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}
function esc(v=''){ return String(v ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function val(id){ return document.getElementById(id)?.value ?? ''; }
function checked(id){ return document.getElementById(id)?.checked ?? false; }
function pageOptions(selectedId=''){
  return `<option value="">— keine —</option>` + (data.pages||[]).map(p=>`<option value="${esc(p.id)}" ${p.id===selectedId?'selected':''}>${esc(p.title)} (${esc(p.id)})</option>`).join('');
}
function factionOptions(selectedId=''){
  const factions = (data.pages||[]).filter(p=>['faction','group'].includes(p.type));
  return `<option value="">— wählen —</option>` + factions.map(p=>`<option value="${esc(p.id)}" ${p.id===selectedId?'selected':''}>${esc(p.title)} (${esc(p.id)})</option>`).join('');
}

async function login(){
  const h=await sha256($('#password').value);
  if(h===cfg.passwordHash){
    sessionStorage.setItem('ef_admin','1');
    $('#loginBox').style.display='none'; $('#cmsBox').style.display='block';
    $('#token').value=localStorage.getItem('ef_github_token')||'';
    setStatus('Login erfolgreich.');
  } else { $('#loginStatus').textContent='Falsches Passwort.'; $('#loginStatus').className='status-bad'; }
}
async function loadContent(){
  try{
    if(!token()) throw new Error('GitHub Token fehlt.');
    const file=await ghGet(cfg.contentPath);
    currentSha=file.sha;
    data=JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g,'')))));
    $('#editorArea').style.display='block';
    renderTab();
    setStatus('Inhalte geladen.');
  }catch(e){ setStatus('Fehler beim Laden: '+e.message,false); }
}
async function saveGithub(){
  try{
    if(!data) throw new Error('Keine Inhalte geladen.');
    const formatted=JSON.stringify(data,null,2);
    if(!currentSha){ const file=await ghGet(cfg.contentPath); currentSha=file.sha; }
    const res=await ghPut(cfg.contentPath, formatted, 'Eisenfels CMS Inhalte aktualisiert', currentSha);
    currentSha=res.content.sha;
    setStatus('Gespeichert. Website nach kurzer Zeit mit STRG+F5 neu laden.');
  }catch(e){ setStatus('Fehler beim Speichern: '+e.message,false); }
}

function renderTab(){
  $$('.cms-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
  const map={pages:renderPages,laws:renderLaws,events:()=>renderItems('events','Termin'),trainings:()=>renderItems('trainings','Ausbildung'),prices:renderPrices,departments:renderDepartments,contacts:renderContacts,settings:renderSettings,password:renderPassword};
  $('#tabContent').innerHTML = map[activeTab]();
  bindTab();
}
function listLayout(title, addText, listHtml, formHtml){
  return `<h2>${title}</h2><div class="admin-actions"><button id="addItem">${addText}</button></div><div class="cms-layout"><div class="cms-list">${listHtml}</div><div class="cms-form">${formHtml}</div></div>`;
}
function selectedIndex(arrName){ return selected[arrName] ?? 0; }
function renderPages(){
  const arr=data.pages||[];
  const idx=selectedIndex('pages');
  const p=arr[idx]||{};
  const list=arr.map((p,i)=>`<button data-sel="${i}" class="${i===idx?'active':''}">${esc(p.title)}<br><span class="cms-small">${esc(p.slug)} · ${esc(p.type)}</span></button>`).join('');
  const form=p.id?`
    <div class="cms-row"><div><label>Titel</label><input id="p_title" value="${esc(p.title)}"></div><div><label>ID</label><input id="p_id" value="${esc(p.id)}"></div></div>
    <div class="cms-row"><div><label>URL / Slug</label><input id="p_slug" value="${esc(p.slug)}"></div><div><label>Übergeordnete Seite</label><select id="p_parent">${pageOptions(p.parentId)}</select></div></div>
    <div class="cms-row"><div><label>Typ</label><select id="p_type">${['page','group','faction','laws-index','departments','price-list','events-list','trainings-list','contact'].map(t=>`<option ${p.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div><label>Fraktions-ID</label><input id="p_faction" value="${esc(p.factionId||'')}"></div></div>
    <div class="cms-row"><div><label>Reihenfolge</label><input id="p_order" type="number" value="${esc(p.order||0)}"></div><div><label>Akzentfarbe</label><select id="p_accent">${['red','orange','blue'].map(c=>`<option ${p.accent===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
    <label><input id="p_show" type="checkbox" ${p.showInSidebar!==false?'checked':''}> In Seitenleiste anzeigen</label>
    <div class="cms-row"><div><label>Logo/Wappen URL</label><input id="p_logo" value="${esc(p.logo||'')}"></div><div><label>Banner URL</label><input id="p_banner" value="${esc(p.banner||'')}"></div></div>
    <label>Inhalt</label><textarea id="p_body">${esc(p.body||'')}</textarea>
    <label>Medien (eine Zeile pro Medium: image|URL|Beschriftung oder video|URL|Beschriftung)</label><textarea id="p_media">${esc((p.media||[]).map(m=>`${m.type||'image'}|${m.url||''}|${m.caption||''}`).join('\n'))}</textarea>
    <div class="admin-actions"><button id="savePage">Seite übernehmen</button><button class="cms-danger" id="deletePage">Seite löschen</button></div>`:'<p>Keine Seite ausgewählt.</p>';
  return listLayout('Seiten & Unterseiten','Neue Seite',list,form);
}
function bindPages(){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected.pages=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{data.pages.push({id:uid('seite'),slug:'neue-seite',title:'Neue Seite',parentId:'',order:10,showInSidebar:true,type:'page',accent:'orange',body:'# Neue Seite'});selected.pages=data.pages.length-1;renderTab();};
  $('#savePage')&&( $('#savePage').onclick=()=>{
    const i=selected.pages,p=data.pages[i];
    Object.assign(p,{title:val('p_title'),id:val('p_id'),slug:val('p_slug'),parentId:val('p_parent'),type:val('p_type'),factionId:val('p_faction'),order:+val('p_order'),accent:val('p_accent'),showInSidebar:checked('p_show'),logo:val('p_logo'),banner:val('p_banner'),body:val('p_body'),media:parseMedia(val('p_media'))});
    renderTab(); setStatus('Seite übernommen. Danach Alle Änderungen speichern klicken.');
  });
  $('#deletePage')&&( $('#deletePage').onclick=()=>{ if(confirm('Seite wirklich löschen?')){data.pages.splice(selected.pages,1);selected.pages=0;renderTab();} });
}
function parseMedia(text){ return text.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const [type,url,...cap]=l.split('|');return {type:type||'image',url:url||'',caption:cap.join('|')||''};}); }

function renderLaws(){
  const groups=data.lawGroups||[]; let gi=selected.lawGroup??0, li=selected.law??0; const g=groups[gi]||{}, law=(g.laws||[])[li]||{};
  const list=groups.map((g,i)=>`<button data-g="${i}" class="${i===gi?'active':''}">${esc(g.title)}<br><span class="cms-small">${(g.laws||[]).length} Gesetze</span></button>`).join('');
  const laws=(g.laws||[]).map((l,i)=>`<button data-l="${i}" class="${i===li?'active':''}">§ ${esc(l.title)}</button>`).join('');
  const form=`
    <h3>Gruppe</h3>
    <div class="cms-row"><div><label>Gruppentitel</label><input id="g_title" value="${esc(g.title||'')}"></div><div><label>Gruppen-ID</label><input id="g_id" value="${esc(g.id||'')}"></div></div>
    <div class="admin-actions"><button id="saveGroup">Gruppe übernehmen</button><button id="addLaw">Neues Gesetz in Gruppe</button><button class="cms-danger" id="deleteGroup">Gruppe löschen</button></div>
    <h3>Gesetze dieser Gruppe</h3><div class="cms-list">${laws}</div>
    ${law.slug?`<h3>Gesetz bearbeiten</h3><div class="cms-row"><div><label>Titel</label><input id="l_title" value="${esc(law.title)}"></div><div><label>Slug</label><input id="l_slug" value="${esc(law.slug)}"></div></div><label>Inhalt</label><textarea id="l_body">${esc(law.body||'')}</textarea><label>Medien</label><textarea id="l_media">${esc((law.media||[]).map(m=>`${m.type||'image'}|${m.url||''}|${m.caption||''}`).join('\n'))}</textarea><div class="admin-actions"><button id="saveLaw">Gesetz übernehmen</button><button class="cms-danger" id="deleteLaw">Gesetz löschen</button></div>`:'<p>Kein Gesetz ausgewählt.</p>'}`;
  return listLayout('Gesetzbücher nach Gruppen','Neue Gesetzesgruppe',list,form);
}
function bindLaws(){
  $$('.cms-list button[data-g]').forEach(b=>b.onclick=()=>{selected.lawGroup=+b.dataset.g;selected.law=0;renderTab();});
  $$('.cms-list button[data-l]').forEach(b=>b.onclick=()=>{selected.law=+b.dataset.l;renderTab();});
  $('#addItem').onclick=()=>{data.lawGroups.push({id:uid('gruppe'),title:'Neue Gruppe',laws:[]});selected.lawGroup=data.lawGroups.length-1;selected.law=0;renderTab();};
  $('#saveGroup').onclick=()=>{const g=data.lawGroups[selected.lawGroup];g.title=val('g_title');g.id=val('g_id');renderTab();setStatus('Gruppe übernommen.');};
  $('#addLaw').onclick=()=>{const g=data.lawGroups[selected.lawGroup];g.laws=g.laws||[];g.laws.push({slug:'neues-gesetz',title:'Neues Gesetz',body:'# Neues Gesetz',media:[]});selected.law=g.laws.length-1;renderTab();};
  $('#saveLaw')&&($('#saveLaw').onclick=()=>{const l=data.lawGroups[selected.lawGroup].laws[selected.law];l.title=val('l_title');l.slug=val('l_slug');l.body=val('l_body');l.media=parseMedia(val('l_media'));renderTab();setStatus('Gesetz übernommen.');});
  $('#deleteLaw')&&($('#deleteLaw').onclick=()=>{if(confirm('Gesetz löschen?')){data.lawGroups[selected.lawGroup].laws.splice(selected.law,1);selected.law=0;renderTab();}});
  $('#deleteGroup').onclick=()=>{if(confirm('Gruppe inkl. Gesetze löschen?')){data.lawGroups.splice(selected.lawGroup,1);selected.lawGroup=0;selected.law=0;renderTab();}};
}

function renderItems(kind,label){
  const arr=data[kind]||[]; const idx=selected[kind]??0; const it=arr[idx]||{};
  const list=arr.map((x,i)=>`<button data-sel="${i}" class="${i===idx?'active':''}">${esc(x.title)}<br><span class="cms-small">${esc(x.factionId)} · ${esc(x.date||'')}</span></button>`).join('');
  const form=it.slug?`
    <div class="cms-row"><div><label>Titel</label><input id="i_title" value="${esc(it.title)}"></div><div><label>Slug</label><input id="i_slug" value="${esc(it.slug)}"></div></div>
    <div class="cms-row"><div><label>Fraktion</label><select id="i_faction">${factionOptions(it.factionId)}</select></div><div><label>Ort</label><input id="i_location" value="${esc(it.location||'')}"></div></div>
    <div class="cms-row"><div><label>Datum</label><input id="i_date" value="${esc(it.date||'')}"></div><div><label>Uhrzeit</label><input id="i_time" value="${esc(it.time||'')}"></div></div>
    <label>Kurztext</label><textarea id="i_summary">${esc(it.summary||'')}</textarea>
    <label>Detailtext</label><textarea id="i_body">${esc(it.body||'')}</textarea>
    <div class="admin-actions"><button id="saveItem">Übernehmen</button><button class="cms-danger" id="deleteItem">Löschen</button></div>`:'<p>Kein Eintrag ausgewählt.</p>';
  return listLayout(label+' verwalten','Neu: '+label,list,form);
}
function bindItems(kind){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected[kind]=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{data[kind].push({factionId:'rettungsdienst',slug:uid(kind),title:'Neuer Eintrag',date:'2026-01-01',time:'20:00',location:'',summary:'',body:''});selected[kind]=data[kind].length-1;renderTab();};
  $('#saveItem')&&($('#saveItem').onclick=()=>{const it=data[kind][selected[kind]];Object.assign(it,{title:val('i_title'),slug:val('i_slug'),factionId:val('i_faction'),location:val('i_location'),date:val('i_date'),time:val('i_time'),summary:val('i_summary'),body:val('i_body')});renderTab();setStatus('Eintrag übernommen.');});
  $('#deleteItem')&&($('#deleteItem').onclick=()=>{if(confirm('Eintrag löschen?')){data[kind].splice(selected[kind],1);selected[kind]=0;renderTab();}});
}

function renderPrices(){
  const arr=data.priceLists||[]; const idx=selected.prices??0; const pl=arr[idx]||{};
  const list=arr.map((x,i)=>`<button data-sel="${i}" class="${i===idx?'active':''}">${esc(x.title)}<br><span class="cms-small">${esc(x.factionId)}</span></button>`).join('');
  const itemText=(pl.items||[]).map(i=>`${i.name}|${i.price}|${i.note||''}`).join('\n');
  const form=pl.title?`<div class="cms-row"><div><label>Titel</label><input id="pr_title" value="${esc(pl.title)}"></div><div><label>Fraktion</label><select id="pr_faction">${factionOptions(pl.factionId)}</select></div></div><label>Positionen (Leistung|Preis|Hinweis)</label><textarea id="pr_items">${esc(itemText)}</textarea><div class="admin-actions"><button id="savePrice">Preisliste übernehmen</button><button class="cms-danger" id="deletePrice">Löschen</button></div>`:'<p>Keine Preisliste ausgewählt.</p>';
  return listLayout('Preislisten','Neue Preisliste',list,form);
}
function bindPrices(){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected.prices=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{data.priceLists.push({factionId:'rettungsdienst',title:'Neue Preisliste',items:[]});selected.prices=data.priceLists.length-1;renderTab();};
  $('#savePrice')&&($('#savePrice').onclick=()=>{const p=data.priceLists[selected.prices];p.title=val('pr_title');p.factionId=val('pr_faction');p.items=val('pr_items').split('\n').filter(Boolean).map(l=>{const [name,price,...note]=l.split('|');return {name:name||'',price:price||'',note:note.join('|')||''};});renderTab();setStatus('Preisliste übernommen.');});
  $('#deletePrice')&&($('#deletePrice').onclick=()=>{if(confirm('Preisliste löschen?')){data.priceLists.splice(selected.prices,1);selected.prices=0;renderTab();}});
}

function renderDepartments(){return renderSimpleList('departments','Fachabteilungen',['factionId','name','description','logo','banner']);}
function renderContacts(){return renderSimpleList('contacts','Kontakte',['factionId','name','role','discord','email','note']);}
function renderSimpleList(kind,title,fields){
  const arr=data[kind]||[]; const idx=selected[kind]??0; const it=arr[idx]||{};
  const list=arr.map((x,i)=>`<button data-sel="${i}" class="${i===idx?'active':''}">${esc(x.name||x.title||'Eintrag')}<br><span class="cms-small">${esc(x.factionId||'')}</span></button>`).join('');
  const form=fields.map(f=>`<label>${f}</label>${f==='description'||f==='note'?`<textarea id="s_${f}">${esc(it[f]||'')}</textarea>`:`<input id="s_${f}" value="${esc(it[f]||'')}">`}`).join('') + `<div class="admin-actions"><button id="saveSimple">Übernehmen</button><button class="cms-danger" id="deleteSimple">Löschen</button></div>`;
  return listLayout(title,'Neuer Eintrag',list,form);
}
function bindSimple(kind,fields){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected[kind]=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{const o={};fields.forEach(f=>o[f]='');o.name='Neuer Eintrag';o.factionId='justiz';data[kind].push(o);selected[kind]=data[kind].length-1;renderTab();};
  $('#saveSimple')&&($('#saveSimple').onclick=()=>{const it=data[kind][selected[kind]];fields.forEach(f=>it[f]=val('s_'+f));renderTab();setStatus('Eintrag übernommen.');});
  $('#deleteSimple')&&($('#deleteSimple').onclick=()=>{if(confirm('Eintrag löschen?')){data[kind].splice(selected[kind],1);selected[kind]=0;renderTab();}});
}
function renderSettings(){
  const s=data.settings||{};
  return `<h2>Einstellungen</h2><div class="cms-form"><label>Servername</label><input id="set_serverName" value="${esc(s.serverName||'')}"><label>Discord-Link</label><input id="set_discordUrl" value="${esc(s.discordUrl||'')}"><label>Logo URL</label><input id="set_logo" value="${esc(s.logo||'')}"><label>Disclaimer</label><textarea id="set_disclaimer">${esc(s.disclaimer||'')}</textarea><div class="admin-actions"><button id="saveSettings">Einstellungen übernehmen</button></div></div>`;
}
function bindSettings(){
  $('#saveSettings').onclick=()=>{data.settings.serverName=val('set_serverName');data.settings.discordUrl=val('set_discordUrl');data.settings.logo=val('set_logo');data.settings.disclaimer=val('set_disclaimer');setStatus('Einstellungen übernommen.');};
}
function renderPassword(){
  return `<h2>Passwort ändern</h2><div class="cms-form"><p class="admin-note">Wenn du es vergisst, kannst du /MephMK/admin-config.js im Repo ersetzen oder die ZIP erneut hochladen.</p><label>Neues Passwort</label><input id="newPassword" type="password"><div class="admin-actions"><button id="changePassword">Passwort auf GitHub ändern</button></div></div>`;
}
function bindPassword(){
  $('#changePassword').onclick=async()=>{try{const pw=val('newPassword');if(!pw||pw.length<8)throw new Error('Mindestens 8 Zeichen.');const h=await sha256(pw);const text=`window.EISENFELS_ADMIN_CONFIG = {\n  passwordHash: "${h}",\n  repoOwner: "${cfg.repoOwner}",\n  repoName: "${cfg.repoName}",\n  branch: "${cfg.branch}",\n  contentPath: "${cfg.contentPath}"\n};\n`;const file=await ghGet('MephMK/admin-config.js');await ghPut('MephMK/admin-config.js',text,'Admin Passwort geändert',file.sha);setStatus('Passwort geändert. Neu laden und mit neuem Passwort einloggen.');}catch(e){setStatus('Fehler: '+e.message,false);}};
}
function bindTab(){
  if(activeTab==='pages') bindPages();
  if(activeTab==='laws') bindLaws();
  if(activeTab==='events') bindItems('events');
  if(activeTab==='trainings') bindItems('trainings');
  if(activeTab==='prices') bindPrices();
  if(activeTab==='departments') bindSimple('departments',['factionId','name','description','logo','banner']);
  if(activeTab==='contacts') bindSimple('contacts',['factionId','name','role','discord','email','note']);
  if(activeTab==='settings') bindSettings();
  if(activeTab==='password') bindPassword();
}
$$('.cms-tab').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;renderTab();});
$('#loginBtn').onclick=login;
$('#password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
$('#saveToken').onclick=()=>{localStorage.setItem('ef_github_token',$('#token').value.trim());setStatus('Token lokal gespeichert.');};
$('#loadContent').onclick=loadContent;
$('#saveGithub').onclick=saveGithub;
$('#logout').onclick=()=>{sessionStorage.removeItem('ef_admin');location.reload();};
if(sessionStorage.getItem('ef_admin')==='1'){ $('#loginBox').style.display='none'; $('#cmsBox').style.display='block'; $('#token').value=localStorage.getItem('ef_github_token')||''; }
