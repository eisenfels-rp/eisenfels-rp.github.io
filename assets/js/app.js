
let DATA=null;

const $ = (s)=>document.querySelector(s);
const hash = ()=>decodeURIComponent(location.hash.replace(/^#\/?/,'') || 'startseite');

async function init(){
  DATA = await fetch('/content/content.json', {cache:'no-store'}).then(r=>r.json());
  renderShell();
  render();
  window.addEventListener('hashchange', render);
  $('#search').addEventListener('input', renderSidebar);
}
function md(text=''){
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.*)$/gm,'<h3>$1</h3>')
    .replace(/^## (.*)$/gm,'<h2>$1</h2>')
    .replace(/^# (.*)$/gm,'<h1>$1</h1>')
    .replace(/^> (.*)$/gm,'<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/\n/g,'<br>');
  return '<p>'+html+'</p>';
}
function renderShell(){
  $('#brandLogo').src = DATA.settings.logo;
  $('#brandTitle').textContent = DATA.settings.serverName;
  $('#discordMain').href = DATA.settings.discordUrl;
  $('#discordFloat').href = DATA.settings.discordUrl;
  renderSidebar();
}
function visiblePages(){
  return DATA.pages.filter(p=>p.showInSidebar !== false).sort((a,b)=>(a.order||0)-(b.order||0));
}
function renderSidebar(){
  const q = ($('#search')?.value || '').toLowerCase().trim();
  const allPages = visiblePages();
  const pages = allPages.filter(p=>!q || p.title.toLowerCase().includes(q) || (p.body||'').toLowerCase().includes(q));
  const byParent = {};
  pages.forEach(p => (byParent[p.parentId||''] ||= []).push(p));
  const current = hash();
  const currentPage = pageBySlug(current);
  const activeIds = new Set();
  let p = currentPage;
  while(p){ activeIds.add(p.id); p = pageById(p.parentId); }

  function isOpen(id){
    const saved = localStorage.getItem('tree-open-'+id);
    if(saved !== null) return saved === '1';
    return activeIds.has(id) || id === 'staat' || id === '';
  }

  function branch(parent){
    return `<ul>${(byParent[parent]||[]).map(p=>{
      const children = byParent[p.id] || [];
      const hasChildren = children.length > 0;
      const open = isOpen(p.id);
      const cls = `${current===p.slug?'active':''} ${activeIds.has(p.id)?'active-branch':''} ${!open?'collapsed':''}`;
      if(hasChildren){
        return `<li class="${cls}">
          <button class="tree-toggle" data-id="${p.id}" data-slug="${p.slug}" title="${p.title}">
            <span class="chev">${open?'▾':'▸'}</span><span>${p.title}</span>
          </button>
          ${branch(p.id)}
        </li>`;
      }
      return `<li class="${cls}"><a class="${current===p.slug?'active':''}" href="#/${p.slug}">${p.title}</a></li>`;
    }).join('')}</ul>`;
  }

  $('#tree').innerHTML = branch('');

  document.querySelectorAll('.tree-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.id;
      const slug = btn.dataset.slug;
      const li = btn.closest('li');
      const willOpen = li.classList.contains('collapsed');

      // Ein Klick macht beides:
      // 1. Seite öffnen
      // 2. Unterseiten auf-/zuklappen
      localStorage.setItem('tree-open-'+id, willOpen ? '1' : '0');
      li.classList.toggle('collapsed', !willOpen);
      const chev = btn.querySelector('.chev');
      if(chev) chev.textContent = willOpen ? '▾' : '▸';
      location.hash = '#/' + slug;
    });
  });
}
function pageBySlug(slug){ return DATA.pages.find(p=>p.slug===slug); }
function pageById(id){ return DATA.pages.find(p=>p.id===id); }

function render(){
  const route = hash();
  renderSidebar();
  if(route.startsWith('gesetz/')) return renderLaw(route.split('/')[1]);
  if(route.startsWith('termin/')) return renderDetail('events', route.split('/')[1]);
  if(route.startsWith('ausbildung/')) return renderDetail('trainings', route.split('/')[1]);

  const page = pageBySlug(route) || pageBySlug('startseite');
  renderPage(page);
}
function header(title, subtitle='', logo=''){
  $('#pageHeader').innerHTML = `<img src="${logo || DATA.settings.logo}" alt=""><div><h2>${title}</h2><p>${subtitle || DATA.settings.disclaimer}</p></div>`;
}

function ancestors(page){
  const arr=[];
  let p=page;
  while(p){ arr.unshift(p); p=pageById(p.parentId); }
  return arr;
}
function renderTools(page){
  const crumbs = ancestors(page).map((p,i,arr)=>{
    if(i===arr.length-1) return `<span>${p.title}</span>`;
    return `<a href="#/${p.slug}">${p.title}</a>`;
  }).join(' › ');
  return `<div class="page-tools"><button class="back-btn" id="backBtn">← Zurück</button><div class="breadcrumbs">${crumbs}</div></div>`;
}
function attachBack(page){
  const btn = $('#backBtn');
  if(!btn) return;
  btn.onclick = ()=>{
    if(history.length > 1) history.back();
    else if(page.parentId){
      const parent = pageById(page.parentId);
      if(parent) location.hash = '#/' + parent.slug;
    } else location.hash = '#/startseite';
  };
}

function renderPage(page){
  header(page.title, page.type==='faction'?'Fraktion / Behörde Eisenfels RP':'Eisenfels RP Portal', page.logo);
  let body = renderTools(page) + md(page.body||'');

  if(page.type==='laws-index') body += renderLawGroups();
  if(page.type==='departments') body += renderDepartments(page.factionId);
  if(page.type==='price-list') body += renderPrices(page.factionId);
  if(page.type==='events-list') body += renderItems('events', page.factionId, 'termin');
  if(page.type==='trainings-list') body += renderItems('trainings', page.factionId, 'ausbildung');
  if(page.type==='contact') body += renderContacts(page.factionId);

  body += renderMedia(page.media||[]);
  $('#content').innerHTML = body;
  attachBack(page);
}
function renderLawGroups(){
  return `<div class="grid">${DATA.lawGroups.map(g=>`<div class="card"><span class="badge">Gesetzesgruppe</span><h3>${g.title}</h3>${g.laws.map(l=>`<p><a href="#/gesetz/${l.slug}">§ ${l.title}</a></p>`).join('')}</div>`).join('')}</div>`;
}
function renderLaw(slug){
  for(const g of DATA.lawGroups){
    const law = g.laws.find(l=>l.slug===slug);
    if(law){
      header(law.title, g.title);
      $('#content').innerHTML = `<div class="page-tools"><button class="back-btn" id="backBtn">← Zurück</button><div class="breadcrumbs"><a href="#/startseite">Startseite</a> › <a href="#/gesetzbuecher">Gesetzbücher</a> › <span>${law.title}</span></div></div>` + md(law.body||'') + renderMedia(law.media||[]);
      $('#backBtn').onclick = ()=>{ location.hash = '#/gesetzbuecher'; };
      return;
    }
  }
  notFound();
}
function renderDepartments(fid){
  const items=DATA.departments.filter(d=>d.factionId===fid);
  if(!items.length) return `<div class="card">Noch keine Fachabteilungen eingetragen.</div>`;
  return `<div class="grid">${items.map(d=>`<div class="card">${d.logo?`<img src="${d.logo}" style="max-height:70px">`:''}<h3>${d.name}</h3><p>${d.description||''}</p></div>`).join('')}</div>`;
}
function renderPrices(fid){
  const lists=DATA.priceLists.filter(p=>p.factionId===fid);
  if(!lists.length) return `<div class="card">Noch keine Preisliste eingetragen.</div>`;
  return lists.map(list=>`<h2>${list.title}</h2>${list.items.map(i=>`<div class="price"><div><strong>${i.name}</strong><br><span style="color:var(--muted)">${i.note||''}</span></div><strong>${i.price}</strong></div>`).join('')}`).join('');
}
function renderItems(kind, fid, route){
  const items=DATA[kind].filter(i=>i.factionId===fid).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(!items.length) return `<div class="card">Noch keine Einträge vorhanden.</div>`;
  return `<div class="grid">${items.map(i=>`<div class="card"><span class="badge">${i.date||''} ${i.time||''}</span><h3>${i.title}</h3><p>${i.summary||''}</p><p><strong>Ort:</strong> ${i.location||'folgt'}</p><a href="#/${route}/${i.slug}">Details öffnen</a></div>`).join('')}</div>`;
}
function renderDetail(kind, slug){
  const item=DATA[kind].find(i=>i.slug===slug);
  if(!item) return notFound();
  const faction=pageById(item.factionId);
  header(item.title, `${faction?.title || 'Eisenfels'} · ${item.date||''} ${item.time||''}`);
  $('#content').innerHTML = `<div class="page-tools"><button class="back-btn" id="backBtn">← Zurück</button><div class="breadcrumbs"><a href="#/startseite">Startseite</a> › <span>${item.title}</span></div></div><p><strong>Ort:</strong> ${item.location||'folgt'}</p>` + md(item.body||item.summary||'') + renderMedia(item.media||[]);
  $('#backBtn').onclick = ()=>history.length>1?history.back():location.hash='#/startseite';
}
function renderContacts(fid){
  const items=DATA.contacts.filter(c=>c.factionId===fid);
  return `<div class="grid">${items.map(c=>`<div class="card"><h3>${c.name}</h3><p>${c.role||''}</p><p>${c.discord||''}</p><p>${c.email||''}</p><p>${c.note||''}</p></div>`).join('')}</div>`;
}
function renderMedia(media){
  if(!media || !media.length) return '';
  return media.map(m=>{
    if(m.type==='video') return `<div class="media"><iframe height="420" src="${m.url}" frameborder="0" allowfullscreen></iframe></div><p>${m.caption||''}</p>`;
    return `<div class="media"><img src="${m.url}" alt="${m.caption||''}"></div><p>${m.caption||''}</p>`;
  }).join('');
}
function notFound(){
  header('404','Seite nicht gefunden');
  $('#content').innerHTML='<p>Diese Seite existiert nicht.</p>';
}
init();
