
(function(){
'use strict';

function $(s){ return document.querySelector(s); }
function $$(s){ return Array.from(document.querySelectorAll(s)); }
function showError(err){
  const box = $('#errorBox');
  if(box){
    box.style.display='block';
    box.textContent = typeof err === 'string' ? err : (err && (err.stack || err.message)) || String(err);
  }
  console.error(err);
}
window.addEventListener('error', e => showError(e.error || e.message));
window.addEventListener('unhandledrejection', e => showError(e.reason || e));

let cfg, data = null, currentSha = null, activeTab = 'pages', selected = {};

function boot(){
  try{
    cfg = window.EISENFELS_ADMIN_CONFIG;
    if(!cfg) throw new Error('admin-config.js wurde nicht geladen. Prüfe /MephMK/admin-config.js');
    bindBaseButtons();
    const boot = $('#bootStatus');
    if(boot) boot.textContent = 'CMS geladen. Repo: ' + cfg.repoOwner + '/' + cfg.repoName;
    if(sessionStorage.getItem('ef_admin') === '1'){
      $('#loginBox').style.display='none';
      $('#cmsBox').style.display='block';
      $('#token').value = localStorage.getItem('ef_github_token') || '';
    }
  }catch(e){ showError(e); }
}

function uid(prefix){ return (prefix||'id') + '-' + Math.random().toString(36).slice(2,8); }
async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function setStatus(msg, ok){
  const el = $('#status') || $('#loginStatus');
  if(el){ el.textContent = msg; el.className = ok === false ? 'status-bad' : 'status-ok'; }
}
function token(){ return ($('#token')?.value || '').trim() || localStorage.getItem('ef_github_token') || ''; }
function repoApi(path){ return 'https://api.github.com/repos/' + cfg.repoOwner + '/' + cfg.repoName + '/contents/' + path; }
function b64DecodeUnicode(str){ return decodeURIComponent(Array.prototype.map.call(atob(str.replace(/\n/g,'')), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); }
function b64EncodeUnicode(str){ return btoa(unescape(encodeURIComponent(str))); }
async function ghGet(path){
  const res = await fetch(repoApi(path) + '?ref=' + cfg.branch, {headers:{Authorization:'Bearer ' + token(), Accept:'application/vnd.github+json'}});
  const txt = await res.text();
  if(!res.ok) throw new Error('GitHub GET Fehler ' + res.status + ':\n' + txt);
  return JSON.parse(txt);
}
async function ghPut(path, content, message, sha){
  const body = {message:message, content:b64EncodeUnicode(content), branch:cfg.branch};
  if(sha) body.sha = sha;
  const res = await fetch(repoApi(path), {method:'PUT', headers:{Authorization:'Bearer ' + token(), Accept:'application/vnd.github+json', 'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const txt = await res.text();
  if(!res.ok) throw new Error('GitHub PUT Fehler ' + res.status + ':\n' + txt);
  return JSON.parse(txt);
}
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function val(id){ return document.getElementById(id)?.value || ''; }
function checked(id){ return !!document.getElementById(id)?.checked; }
function parseMedia(text){
  return String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const parts = l.split('|');
    return {type:parts[0] || 'image', url:parts[1] || '', caption:parts.slice(2).join('|') || ''};
  });
}

async function login(){
  try{
    const hash = await sha256($('#password').value);
    if(hash === cfg.passwordHash){
      sessionStorage.setItem('ef_admin','1');
      $('#loginBox').style.display='none';
      $('#cmsBox').style.display='block';
      $('#token').value = localStorage.getItem('ef_github_token') || '';
      setStatus('Login erfolgreich.');
    }else{
      $('#loginStatus').textContent = 'Falsches Passwort.';
      $('#loginStatus').className = 'status-bad';
    }
  }catch(e){ showError(e); }
}
async function loadContent(){
  try{
    if(!token()) throw new Error('GitHub Token fehlt.');
    setStatus('Lade Inhalte…');
    const file = await ghGet(cfg.contentPath);
    currentSha = file.sha;
    data = JSON.parse(b64DecodeUnicode(file.content));
    $('#editorArea').style.display='block';
    activeTab = 'pages';
    renderTab();
    setStatus('Inhalte geladen.');
  }catch(e){ showError(e); setStatus('Fehler beim Laden. Details oben/Console.', false); }
}
async function saveGithub(){
  try{
    if(!data) throw new Error('Keine Inhalte geladen.');
    const formatted = JSON.stringify(data, null, 2);
    if(!currentSha){
      const file = await ghGet(cfg.contentPath);
      currentSha = file.sha;
    }
    const res = await ghPut(cfg.contentPath, formatted, 'Eisenfels CMS Inhalte aktualisiert', currentSha);
    currentSha = res.content.sha;
    setStatus('Gespeichert. Website mit STRG+F5 neu laden.');
  }catch(e){ showError(e); setStatus('Fehler beim Speichern. Details oben/Console.', false); }
}
function bindBaseButtons(){
  $('#loginBtn').addEventListener('click', login);
  $('#password').addEventListener('keydown', e => { if(e.key === 'Enter') login(); });
  $('#saveToken').addEventListener('click', () => { localStorage.setItem('ef_github_token', $('#token').value.trim()); setStatus('Token lokal gespeichert.'); });
  $('#loadContent').addEventListener('click', loadContent);
  $('#saveGithub').addEventListener('click', saveGithub);
  $('#logout').addEventListener('click', () => { sessionStorage.removeItem('ef_admin'); location.reload(); });
  $$('.cms-tab').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderTab(); }));
}

function pageOptions(selectedId){
  return '<option value="">— keine —</option>' + (data.pages||[]).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selectedId?'selected':'')+'>'+esc(p.title)+' ('+esc(p.id)+')</option>').join('');
}
function factionOptions(selectedId){
  return '<option value="">— wählen —</option>' + (data.pages||[]).filter(p=>['faction','group'].includes(p.type)).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selectedId?'selected':'')+'>'+esc(p.title)+' ('+esc(p.id)+')</option>').join('');
}
function listLayout(title, addText, listHtml, formHtml){
  return '<h2>'+title+'</h2><div class="admin-actions"><button id="addItem" type="button">'+addText+'</button></div><div class="cms-layout"><div class="cms-list">'+listHtml+'</div><div class="cms-form">'+formHtml+'</div></div>';
}
function renderTab(){
  try{
    $$('.cms-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab === activeTab));
    const renderers = {
      pages: renderPages, laws: renderLaws, events: () => renderItems('events','Termin'),
      trainings: () => renderItems('trainings','Ausbildung'), prices: renderPrices,
      departments: () => renderSimple('departments','Fachabteilungen',['factionId','name','description','logo','banner']),
      contacts: () => renderSimple('contacts','Kontakte',['factionId','name','role','discord','email','note']),
      settings: renderSettings, password: renderPassword
    };
    $('#tabContent').innerHTML = renderers[activeTab]();
    bindTab();
  }catch(e){ showError(e); }
}

function renderPages(){
  const arr = data.pages || []; const idx = selected.pages || 0; const p = arr[idx] || {};
  const list = arr.map((p,i)=>'<button type="button" data-sel="'+i+'" class="'+(i===idx?'active':'')+'">'+esc(p.title)+'<br><span class="cms-small">'+esc(p.slug)+' · '+esc(p.type)+'</span></button>').join('');
  const form = p.id ? `
    <div class="cms-row"><div><label>Titel</label><input id="p_title" value="${esc(p.title)}"></div><div><label>ID</label><input id="p_id" value="${esc(p.id)}"></div></div>
    <div class="cms-row"><div><label>URL / Slug</label><input id="p_slug" value="${esc(p.slug)}"></div><div><label>Übergeordnete Seite</label><select id="p_parent">${pageOptions(p.parentId)}</select></div></div>
    <div class="cms-row"><div><label>Typ</label><select id="p_type">${['page','group','faction','laws-index','departments','price-list','events-list','trainings-list','contact'].map(t=>`<option ${p.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div><label>Fraktions-ID</label><input id="p_faction" value="${esc(p.factionId||'')}"></div></div>
    <div class="cms-row"><div><label>Reihenfolge</label><input id="p_order" type="number" value="${esc(p.order||0)}"></div><div><label>Akzentfarbe</label><select id="p_accent">${['red','orange','blue'].map(c=>`<option ${p.accent===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
    <label><input id="p_show" type="checkbox" ${p.showInSidebar!==false?'checked':''}> In Seitenleiste anzeigen</label>
    <div class="cms-row"><div><label>Logo/Wappen URL</label><input id="p_logo" value="${esc(p.logo||'')}"></div><div><label>Banner URL</label><input id="p_banner" value="${esc(p.banner||'')}"></div></div>
    <label>Inhalt</label><textarea id="p_body">${esc(p.body||'')}</textarea>
    <label>Medien: image|URL|Beschriftung oder video|URL|Beschriftung</label><textarea id="p_media">${esc((p.media||[]).map(m=>`${m.type||'image'}|${m.url||''}|${m.caption||''}`).join('\n'))}</textarea>
    <div class="admin-actions"><button id="savePage" type="button">Seite übernehmen</button><button class="cms-danger" id="deletePage" type="button">Seite löschen</button></div>` : '<p>Keine Seite ausgewählt.</p>';
  return listLayout('Seiten & Unterseiten','Neue Seite',list,form);
}
function bindPages(){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected.pages=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{ data.pages.push({id:uid('seite'),slug:'neue-seite',title:'Neue Seite',parentId:'',order:10,showInSidebar:true,type:'page',accent:'orange',body:'# Neue Seite'}); selected.pages=data.pages.length-1; renderTab(); };
  if($('#savePage')) $('#savePage').onclick=()=>{ const p=data.pages[selected.pages||0]; Object.assign(p,{title:val('p_title'),id:val('p_id'),slug:val('p_slug'),parentId:val('p_parent'),type:val('p_type'),factionId:val('p_faction'),order:+val('p_order'),accent:val('p_accent'),showInSidebar:checked('p_show'),logo:val('p_logo'),banner:val('p_banner'),body:val('p_body'),media:parseMedia(val('p_media'))}); renderTab(); setStatus('Seite übernommen. Danach alle Änderungen speichern.'); };
  if($('#deletePage')) $('#deletePage').onclick=()=>{ if(confirm('Seite löschen?')){data.pages.splice(selected.pages||0,1);selected.pages=0;renderTab();} };
}

function renderLaws(){
  const groups=data.lawGroups||[]; const gi=selected.lawGroup||0; const li=selected.law||0; const g=groups[gi]||{laws:[]}; const law=(g.laws||[])[li]||{};
  const list=groups.map((g,i)=>'<button type="button" data-g="'+i+'" class="'+(i===gi?'active':'')+'">'+esc(g.title)+'<br><span class="cms-small">'+((g.laws||[]).length)+' Gesetze</span></button>').join('');
  const laws=(g.laws||[]).map((l,i)=>'<button type="button" data-l="'+i+'" class="'+(i===li?'active':'')+'">§ '+esc(l.title)+'</button>').join('');
  const form=`<h3>Gruppe</h3><div class="cms-row"><div><label>Gruppentitel</label><input id="g_title" value="${esc(g.title||'')}"></div><div><label>Gruppen-ID</label><input id="g_id" value="${esc(g.id||'')}"></div></div><div class="admin-actions"><button id="saveGroup" type="button">Gruppe übernehmen</button><button id="addLaw" type="button">Neues Gesetz</button></div><h3>Gesetze dieser Gruppe</h3><div class="cms-list">${laws}</div>${law.slug?`<h3>Gesetz bearbeiten</h3><div class="cms-row"><div><label>Titel</label><input id="l_title" value="${esc(law.title)}"></div><div><label>Slug</label><input id="l_slug" value="${esc(law.slug)}"></div></div><label>Inhalt</label><textarea id="l_body">${esc(law.body||'')}</textarea><label>Medien</label><textarea id="l_media">${esc((law.media||[]).map(m=>`${m.type||'image'}|${m.url||''}|${m.caption||''}`).join('\n'))}</textarea><div class="admin-actions"><button id="saveLaw" type="button">Gesetz übernehmen</button><button class="cms-danger" id="deleteLaw" type="button">Gesetz löschen</button></div>`:'<p>Kein Gesetz ausgewählt.</p>'}`;
  return listLayout('Gesetzbücher nach Gruppen','Neue Gesetzesgruppe',list,form);
}
function bindLaws(){
  $$('.cms-list button[data-g]').forEach(b=>b.onclick=()=>{selected.lawGroup=+b.dataset.g;selected.law=0;renderTab();});
  $$('.cms-list button[data-l]').forEach(b=>b.onclick=()=>{selected.law=+b.dataset.l;renderTab();});
  $('#addItem').onclick=()=>{data.lawGroups.push({id:uid('gruppe'),title:'Neue Gruppe',laws:[]});selected.lawGroup=data.lawGroups.length-1;renderTab();};
  $('#saveGroup').onclick=()=>{const g=data.lawGroups[selected.lawGroup||0];g.title=val('g_title');g.id=val('g_id');renderTab();};
  $('#addLaw').onclick=()=>{const g=data.lawGroups[selected.lawGroup||0];g.laws=g.laws||[];g.laws.push({slug:'neues-gesetz',title:'Neues Gesetz',body:'# Neues Gesetz',media:[]});selected.law=g.laws.length-1;renderTab();};
  if($('#saveLaw')) $('#saveLaw').onclick=()=>{const l=data.lawGroups[selected.lawGroup||0].laws[selected.law||0];l.title=val('l_title');l.slug=val('l_slug');l.body=val('l_body');l.media=parseMedia(val('l_media'));renderTab();};
  if($('#deleteLaw')) $('#deleteLaw').onclick=()=>{if(confirm('Gesetz löschen?')){data.lawGroups[selected.lawGroup||0].laws.splice(selected.law||0,1);selected.law=0;renderTab();}};
}

function renderItems(kind,label){
  const arr=data[kind]||[]; const idx=selected[kind]||0; const it=arr[idx]||{};
  const list=arr.map((x,i)=>'<button type="button" data-sel="'+i+'" class="'+(i===idx?'active':'')+'">'+esc(x.title)+'<br><span class="cms-small">'+esc(x.factionId)+' · '+esc(x.date||'')+'</span></button>').join('');
  const form=it.slug?`<div class="cms-row"><div><label>Titel</label><input id="i_title" value="${esc(it.title)}"></div><div><label>Slug</label><input id="i_slug" value="${esc(it.slug)}"></div></div><div class="cms-row"><div><label>Fraktion</label><select id="i_faction">${factionOptions(it.factionId)}</select></div><div><label>Ort</label><input id="i_location" value="${esc(it.location||'')}"></div></div><div class="cms-row"><div><label>Datum</label><input id="i_date" value="${esc(it.date||'')}"></div><div><label>Uhrzeit</label><input id="i_time" value="${esc(it.time||'')}"></div></div><label>Kurztext</label><textarea id="i_summary">${esc(it.summary||'')}</textarea><label>Detailtext</label><textarea id="i_body">${esc(it.body||'')}</textarea><div class="admin-actions"><button id="saveItem" type="button">Übernehmen</button><button class="cms-danger" id="deleteItem" type="button">Löschen</button></div>`:'<p>Kein Eintrag ausgewählt.</p>';
  return listLayout(label+' verwalten','Neu: '+label,list,form);
}
function bindItems(kind){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected[kind]=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{data[kind].push({factionId:'rettungsdienst',slug:uid(kind),title:'Neuer Eintrag',date:'2026-01-01',time:'20:00',location:'',summary:'',body:''});selected[kind]=data[kind].length-1;renderTab();};
  if($('#saveItem')) $('#saveItem').onclick=()=>{const it=data[kind][selected[kind]||0];Object.assign(it,{title:val('i_title'),slug:val('i_slug'),factionId:val('i_faction'),location:val('i_location'),date:val('i_date'),time:val('i_time'),summary:val('i_summary'),body:val('i_body')});renderTab();};
  if($('#deleteItem')) $('#deleteItem').onclick=()=>{if(confirm('Eintrag löschen?')){data[kind].splice(selected[kind]||0,1);selected[kind]=0;renderTab();}};
}

function renderPrices(){
  const arr=data.priceLists||[]; const idx=selected.prices||0; const pl=arr[idx]||{};
  const list=arr.map((x,i)=>'<button type="button" data-sel="'+i+'" class="'+(i===idx?'active':'')+'">'+esc(x.title)+'<br><span class="cms-small">'+esc(x.factionId)+'</span></button>').join('');
  const itemText=(pl.items||[]).map(i=>`${i.name}|${i.price}|${i.note||''}`).join('\n');
  const form=pl.title?`<div class="cms-row"><div><label>Titel</label><input id="pr_title" value="${esc(pl.title)}"></div><div><label>Fraktion</label><select id="pr_faction">${factionOptions(pl.factionId)}</select></div></div><label>Positionen (Leistung|Preis|Hinweis)</label><textarea id="pr_items">${esc(itemText)}</textarea><div class="admin-actions"><button id="savePrice" type="button">Preisliste übernehmen</button></div>`:'<p>Keine Preisliste ausgewählt.</p>';
  return listLayout('Preislisten','Neue Preisliste',list,form);
}
function bindPrices(){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected.prices=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{data.priceLists.push({factionId:'rettungsdienst',title:'Neue Preisliste',items:[]});selected.prices=data.priceLists.length-1;renderTab();};
  if($('#savePrice')) $('#savePrice').onclick=()=>{const p=data.priceLists[selected.prices||0];p.title=val('pr_title');p.factionId=val('pr_faction');p.items=val('pr_items').split('\n').filter(Boolean).map(l=>{const parts=l.split('|');return {name:parts[0]||'',price:parts[1]||'',note:parts.slice(2).join('|')||''};});renderTab();};
}

function renderSimple(kind,title,fields){
  const arr=data[kind]||[]; const idx=selected[kind]||0; const it=arr[idx]||{};
  const list=arr.map((x,i)=>'<button type="button" data-sel="'+i+'" class="'+(i===idx?'active':'')+'">'+esc(x.name||x.title||'Eintrag')+'<br><span class="cms-small">'+esc(x.factionId||'')+'</span></button>').join('');
  const form=fields.map(f=>'<label>'+f+'</label>'+(f==='description'||f==='note'?'<textarea id="s_'+f+'">'+esc(it[f]||'')+'</textarea>':'<input id="s_'+f+'" value="'+esc(it[f]||'')+'">')).join('')+'<div class="admin-actions"><button id="saveSimple" type="button">Übernehmen</button></div>';
  return listLayout(title,'Neuer Eintrag',list,form);
}
function bindSimple(kind,fields){
  $$('.cms-list button[data-sel]').forEach(b=>b.onclick=()=>{selected[kind]=+b.dataset.sel;renderTab();});
  $('#addItem').onclick=()=>{const o={};fields.forEach(f=>o[f]='');o.name='Neuer Eintrag';o.factionId='justiz';data[kind].push(o);selected[kind]=data[kind].length-1;renderTab();};
  if($('#saveSimple')) $('#saveSimple').onclick=()=>{const it=data[kind][selected[kind]||0];fields.forEach(f=>it[f]=val('s_'+f));renderTab();};
}
function renderSettings(){
  const s=data.settings||{};
  return `<h2>Einstellungen</h2><div class="cms-form"><label>Servername</label><input id="set_serverName" value="${esc(s.serverName||'')}"><label>Discord-Link</label><input id="set_discordUrl" value="${esc(s.discordUrl||'')}"><label>Logo URL</label><input id="set_logo" value="${esc(s.logo||'')}"><label>Disclaimer</label><textarea id="set_disclaimer">${esc(s.disclaimer||'')}</textarea><div class="admin-actions"><button id="saveSettings" type="button">Einstellungen übernehmen</button></div></div>`;
}
function bindSettings(){ $('#saveSettings').onclick=()=>{data.settings.serverName=val('set_serverName');data.settings.discordUrl=val('set_discordUrl');data.settings.logo=val('set_logo');data.settings.disclaimer=val('set_disclaimer');setStatus('Einstellungen übernommen.');}; }
function renderPassword(){ return `<h2>Passwort ändern</h2><div class="cms-form"><label>Neues Passwort</label><input id="newPassword" type="password"><div class="admin-actions"><button id="changePassword" type="button">Passwort auf GitHub ändern</button></div></div>`; }
function bindPassword(){
  $('#changePassword').onclick=async()=>{try{const pw=val('newPassword');if(!pw||pw.length<8)throw new Error('Mindestens 8 Zeichen.');const h=await sha256(pw);const text=`window.EISENFELS_ADMIN_CONFIG = {\n  passwordHash: "${h}",\n  repoOwner: "${cfg.repoOwner}",\n  repoName: "${cfg.repoName}",\n  branch: "${cfg.branch}",\n  contentPath: "${cfg.contentPath}"\n};\n`;const file=await ghGet('MephMK/admin-config.js');await ghPut('MephMK/admin-config.js',text,'Admin Passwort geändert',file.sha);setStatus('Passwort geändert. Neu laden und mit neuem Passwort einloggen.');}catch(e){showError(e);setStatus('Fehler beim Passwort ändern.',false);}};
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
document.addEventListener('DOMContentLoaded', boot);
})();
