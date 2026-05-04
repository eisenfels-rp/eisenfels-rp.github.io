
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
  let finalLogo = '';

  // 🔥 immer zuerst Seiten-Logo nehmen
  if(logo && logo.trim() !== ''){
    finalLogo = logo;
  }
  // fallback nur wenn wirklich nichts da ist
  else if(DATA.settings && DATA.settings.logo){
    finalLogo = DATA.settings.logo;
  }

  $('#pageHeader').innerHTML = `
    <img src="${finalLogo}" alt="">
    <div>
      <h2>${title}</h2>
      <p>${subtitle || DATA.settings.disclaimer}</p>
    </div>
  `;
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


function toEmbedUrl(url){
  if(!url) return "";
  try{
    const u = new URL(url);
    if(u.hostname.includes("youtube.com")){
      if(u.pathname === "/watch" && u.searchParams.get("v")) return "https://www.youtube.com/embed/" + u.searchParams.get("v");
      if(u.pathname.startsWith("/shorts/")) return "https://www.youtube.com/embed/" + u.pathname.split("/shorts/")[1].split("/")[0];
      if(u.pathname.startsWith("/embed/")) return "https://www.youtube.com/embed/" + u.pathname.split("/embed/")[1].split(/[?#]/)[0];
    }
    if(u.hostname.includes("youtu.be")) return "https://www.youtube.com/embed/" + u.pathname.replace("/","");
    return url;
  }catch(e){ return url; }
}
function renderMediaByPosition(media, position){
  if(!media || !media.length) return '';
  return media
    .filter(m => (m.position || 'bottom') === position)
    .map(m=>{
      if(m.type==='video'){
        return `<div class="media"><iframe height="420" src="${toEmbedUrl(m.url)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><p>${m.caption||''}</p>`;
      }
      return `<div class="media"><img src="${m.url}" alt="${m.caption||''}"></div><p>${m.caption||''}</p>`;
    }).join('');
}
function pageExistsBySlug(slug){
  return !!slug && (DATA.pages || []).some(p => p.slug === slug);
}

function renderPage(page){
  header(page.title, page.type==='faction'?'Fraktion / Behörde Eisenfels RP':'Eisenfels RP Portal', page.logo);
  let body = '';
  if(typeof renderTools === 'function') body += renderTools(page);
  body += renderMediaByPosition(page.media||[], 'top');
  if(page.banner){
  body += `<div class="media"><img src="${page.banner}" alt="${page.title} Banner"></div>`;
}
  
  body += md(page.body||'');

  if(page.type==='laws-index') body += renderLawGroups();
  if(page.type==='departments') body += renderDepartments(page.factionId);
  if(page.type==='price-list') body += renderPrices(page.factionId);
  if(page.type==='events-list') body += renderItems('events', page.factionId, 'termin');
  if(page.type==='trainings-list') body += renderItems('trainings', page.factionId, 'ausbildung');
  if(page.type==='contact') body += renderContacts(page.factionId);

  body += renderMediaByPosition(page.media||[], 'bottom');
  $('#content').innerHTML = body;
  if(typeof attachBack === 'function') attachBack(page);
}
function renderLawGroups(){
  return `<div class="grid">${DATA.lawGroups.map(g=>`<div class="card"><span class="badge">Gesetzesgruppe</span><h3>${g.title}</h3>${g.laws.map(l=>`<p><a href="#/gesetz/${l.slug}">§ ${l.title}</a></p>`).join('')}</div>`).join('')}</div>`;
}

function renderLaw(slug){
  function paragraphSortValue(value){
    const raw = String(value || '').replace('§','').trim().toLowerCase();
    const match = raw.match(/^(\d+)\s*([a-z]*)/i);
    if(!match) return { num: 999999, suffix: raw };
    return { num: parseInt(match[1], 10), suffix: match[2] || '' };
  }

  function sortParagraphs(paragraphs){
    return [...(paragraphs || [])].sort((a,b)=>{
      const pa = paragraphSortValue(a.paragraph);
      const pb = paragraphSortValue(b.paragraph);
      if(pa.num !== pb.num) return pa.num - pb.num;
      return pa.suffix.localeCompare(pb.suffix, 'de');
    });
  }

  function moneyText(min, max){
    min = String(min || '').trim();
    max = String(max || '').trim();
    if(min && max) return min + ' – ' + max;
    if(min) return min;
    if(max) return max;
    return '';
  }

  function lawCard(p){
    const fine = moneyText(p.minFine, p.maxFine);

    return `
      <div class="card law-card" data-search="${[
        p.paragraph,
        p.title,
        p.description,
        p.minFine,
        p.maxFine,
        p.jailMinutes,
        p.points
      ].join(' ').toLowerCase()}">
        <div class="law-topline">
          <span class="badge">${p.paragraph || '§'}</span>
          ${p.points ? `<span class="law-points">${p.points} Punkt(e)</span>` : ''}
        </div>
        <h3>${p.title || 'Ohne Titel'}</h3>
        ${p.description ? `<p>${String(p.description).replace(/\n/g,'<br>')}</p>` : ''}
        <div class="law-meta">
          ${fine ? `<div><strong>Geldstrafe:</strong><br>${fine}</div>` : ''}
          ${p.jailMinutes ? `<div><strong>Haft:</strong><br>${p.jailMinutes} Minuten</div>` : ''}
        </div>
      </div>
    `;
  }

  for(const g of DATA.lawGroups){
    const law = g.laws.find(l=>l.slug===slug);
    if(law){
      header(law.title, g.title, law.logo || DATA.settings.logo);

      const paragraphs = sortParagraphs(law.paragraphs || []);

      let html = `
        <div class="page-tools">
          <button class="back-btn" id="backBtn">← Zurück</button>
          <div class="breadcrumbs">
            <a href="#/startseite">Startseite</a> ›
            <a href="#/gesetzbuecher">Gesetzbücher</a> ›
            <span>${law.title}</span>
          </div>
        </div>
      `;

      if(typeof renderMediaByPosition === 'function'){
        html += renderMediaByPosition(law.media || [], 'top');
      }

      if(law.description || law.body){
        html += `
          <div class="card law-description">
            <h2>Allgemeine Beschreibung</h2>
            <p>${String(law.description || law.body || '').replace(/\n/g,'<br>')}</p>
          </div>
        `;
      }

      html += `
        <div class="law-search-wrap">
          <input id="lawSearch" class="law-search" placeholder="Paragraph, Titel, Text, Strafe, Haft oder Punkte suchen...">
        </div>
      `;

      if(!paragraphs.length){
        html += `<div class="card">Noch keine Paragraphen vorhanden.</div>`;
      } else {
        html += `<div id="lawGrid" class="law-grid">`;
        html += paragraphs.map(lawCard).join('');
        html += `</div>`;
        html += `<div id="lawNoResults" class="card" style="display:none">Keine passenden Paragraphen gefunden.</div>`;
      }

      if(typeof renderMediaByPosition === 'function'){
        html += renderMediaByPosition(law.media || [], 'bottom');
      } else if(typeof renderMedia === 'function'){
        html += renderMedia(law.media || []);
      }

      $('#content').innerHTML = html;

      const backBtn = $('#backBtn');
      if(backBtn) backBtn.onclick = ()=>{ location.hash = '#/gesetzbuecher'; };

      const search = $('#lawSearch');
      if(search){
        search.addEventListener('input', ()=>{
          const q = search.value.trim().toLowerCase();
          const cards = Array.from(document.querySelectorAll('.law-card'));
          let visible = 0;

          cards.forEach(card=>{
            const haystack = card.dataset.search || '';
            const match = !q || haystack.includes(q);
            card.style.display = match ? '' : 'none';
            if(match) visible++;
          });

          const noResults = $('#lawNoResults');
          if(noResults) noResults.style.display = visible ? 'none' : '';
        });
      }

      return;
    }
  }

  notFound();
}

function renderDepartments(fid){
  const items=DATA.departments.filter(d=>d.factionId===fid);
  if(!items.length) return `<div class="card">Noch keine Fachabteilungen eingetragen.</div>`;
  return `<div class="grid">${items.map(d=>{
    const hasPage = pageExistsBySlug(d.slug);
    return `<div class="card department-card">
      ${d.icon ? `<div class="department-icon">${d.icon}</div>` : ''}
      ${d.logo ? `<img src="${d.logo}" class="department-logo" alt="">` : ''}
      <h3>${d.name}</h3>
      <p>${d.description||''}</p>
      ${hasPage ? `<p><a class="details-btn" href="#/${d.slug}">Details öffnen</a></p>` : ''}
    </div>`;
  }).join('')}</div>`;
}
function renderPrices(fid){
  const lists=DATA.priceLists.filter(p=>p.factionId===fid);
  if(!lists.length) return `<div class="card">Noch keine Preisliste eingetragen.</div>`;
  return lists.map(list=>`<h2>${list.title}</h2>${list.items.map(i=>`<div class="price"><div><strong>${i.name}</strong><br><span style="color:var(--muted)">${i.note||''}</span></div><strong>${i.price}</strong></div>`).join('')}`).join('');
}
function renderItems(kind, fid, route){
  const items=DATA[kind].filter(i=>i.factionId===fid).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(!items.length) return `<div class="card">Noch keine Einträge vorhanden.</div>`;
  const isTraining = kind === 'trainings';
  return `<div class="grid">${items.map(i=>`
    <div class="card event-card">
      <span class="badge">${isTraining ? 'Ausbildung' : 'Termin'}</span>
      <h3>${i.title}</h3>
      <p><strong>Datum:</strong> ${i.date || 'folgt'} ${i.time ? '· ' + i.time : ''}</p>
      <p><strong>Ort:</strong> ${i.location || 'folgt'}</p>
      ${isTraining && i.duration ? `<p><strong>Dauer:</strong> ${i.duration}</p>` : ''}
      ${isTraining && i.requirements ? `<p><strong>Voraussetzungen:</strong> ${i.requirements}</p>` : ''}
      ${isTraining && i.lead ? `<p><strong>Leitung:</strong> ${i.lead}</p>` : ''}
      <p>${i.summary || ''}</p>
      <p><a class="details-btn" href="#/${route}/${i.slug}">Details öffnen</a></p>
    </div>`).join('')}</div>`;
}
function renderDetail(kind, slug){
  const item=DATA[kind].find(i=>i.slug===slug);
  if(!item) return notFound();
  const faction=pageById(item.factionId);
  const isTraining = kind === 'trainings';
  header(item.title, `${faction?.title || 'Eisenfels'} · ${isTraining ? 'Ausbildung' : 'Termin'} · ${item.date||''} ${item.time||''}`);
  $('#content').innerHTML = `
    <div class="page-tools">
      <button class="back-btn" id="backBtn">← Zurück</button>
      <div class="breadcrumbs">
        <a href="#/startseite">Startseite</a> ›
        ${faction ? `<a href="#/${faction.slug}">${faction.title}</a> ›` : ''}
        <span>${item.title}</span>
      </div>
    </div>
    ${renderMediaByPosition(item.media||[], 'top')}
    <div class="card">
      <span class="badge">${isTraining ? 'Ausbildung' : 'Termin'}</span>
      <h2>${item.title}</h2>
      <p><strong>Datum:</strong> ${item.date || 'folgt'} ${item.time ? '· ' + item.time : ''}</p>
      <p><strong>Ort:</strong> ${item.location || 'folgt'}</p>
      ${isTraining && item.duration ? `<p><strong>Dauer:</strong> ${item.duration}</p>` : ''}
      ${isTraining && item.requirements ? `<p><strong>Voraussetzungen:</strong> ${item.requirements}</p>` : ''}
      ${isTraining && item.lead ? `<p><strong>Leitung:</strong> ${item.lead}</p>` : ''}
    </div>
  ` + md(item.body||item.summary||'') + renderMediaByPosition(item.media||[], 'bottom');
  $('#backBtn').onclick = ()=>history.length>1?history.back():location.hash=(faction ? '#/'+faction.slug : '#/startseite');
}
function renderContacts(fid){
  const items=DATA.contacts.filter(c=>c.factionId===fid);
  return `<div class="grid">${items.map(c=>`<div class="card"><h3>${c.name}</h3><p>${c.role||''}</p><p>${c.discord||''}</p><p>${c.email||''}</p><p>${c.note||''}</p></div>`).join('')}</div>`;
}
function renderMedia(media){
  return renderMediaByPosition(media, 'bottom');
}
function notFound(){
  header('404','Seite nicht gefunden');
  $('#content').innerHTML='<p>Diese Seite existiert nicht.</p>';
}
init();
