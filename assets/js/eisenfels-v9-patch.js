
/* Eisenfels V9: Fachabteilungs-Buttons + Medienposition */
(function(){
  function toEmbedUrl(url){
    if(!url) return "";
    try{
      const u = new URL(url);
      if(u.hostname.includes("youtube.com")){
        if(u.pathname === "/watch" && u.searchParams.get("v")) return "https://www.youtube.com/embed/" + u.searchParams.get("v");
        if(u.pathname.startsWith("/shorts/")) return "https://www.youtube.com/embed/" + u.pathname.split("/shorts/")[1].split("/")[0];
        if(u.pathname.startsWith("/embed/")) return url;
      }
      if(u.hostname.includes("youtu.be")) return "https://www.youtube.com/embed/" + u.pathname.replace("/","");
      return url;
    }catch(e){ return url; }
  }

  function renderMediaByPosition(media, position){
    if(!media || !media.length) return "";
    return media
      .filter(function(m){ return (m.position || "bottom") === position; })
      .map(function(m){
        if(m.type === "video"){
          const src = toEmbedUrl(m.url);
          return '<div class="media"><iframe height="420" src="'+src+'" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><p>'+(m.caption||"")+'</p>';
        }
        return '<div class="media"><img src="'+(m.url||"")+'" alt="'+(m.caption||"")+'"></div><p>'+(m.caption||"")+'</p>';
      }).join("");
  }

  function pageExists(slug){
    return (DATA.pages || []).some(function(p){ return p.slug === slug; });
  }

  function patch(){
    try{
      if(typeof renderDepartments === "function"){
        renderDepartments = function(fid){
          const items=DATA.departments.filter(d=>d.factionId===fid);
          if(!items.length) return '<div class="card">Noch keine Fachabteilungen eingetragen.</div>';
          return '<div class="grid">'+items.map(function(d){
            const slug = d.slug || "";
            const hasPage = slug && pageExists(slug);
            return '<div class="card department-card">'
              + (d.icon ? '<div class="department-icon">'+d.icon+'</div>' : '')
              + (d.logo ? '<img src="'+d.logo+'" class="department-logo" alt="">' : '')
              + '<h3>'+d.name+'</h3>'
              + '<p>'+(d.description||"")+'</p>'
              + (hasPage ? '<p><a class="details-btn" href="#/'+slug+'">Details öffnen</a></p>' : '')
              + '</div>';
          }).join('')+'</div>';
        };
      }

      if(typeof renderPage === "function"){
        const oldRenderPage = renderPage;
        renderPage = function(page){
          header(page.title, page.type==='faction'?'Fraktion / Behörde Eisenfels RP':'Eisenfels RP Portal', page.logo);
          let body = '';
          if(typeof renderTools === "function") body += renderTools(page);
          body += renderMediaByPosition(page.media || [], "top");
          body += md(page.body||'');

          if(page.type==='laws-index') body += renderLawGroups();
          if(page.type==='departments') body += renderDepartments(page.factionId);
          if(page.type==='price-list') body += renderPrices(page.factionId);
          if(page.type==='events-list') body += renderItems('events', page.factionId, 'termin');
          if(page.type==='trainings-list') body += renderItems('trainings', page.factionId, 'ausbildung');
          if(page.type==='contact') body += renderContacts(page.factionId);

          body += renderMediaByPosition(page.media || [], "bottom");
          document.querySelector('#content').innerHTML = body;
          if(typeof attachBack === "function") attachBack(page);
        };
      }

      if(typeof renderMedia === "function"){
        renderMedia = function(media){ return renderMediaByPosition(media, "bottom"); };
      }
    }catch(e){
      console.error("Eisenfels V9 Patch Fehler", e);
    }
  }

  const timer = setInterval(function(){
    if(typeof DATA !== "undefined" && typeof renderDepartments === "function" && typeof renderPage === "function"){
      patch();
      clearInterval(timer);
      if(location.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  },100);
})();
