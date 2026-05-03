
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

  function renderMediaSafe(media){
    if(!media || !media.length) return "";
    return media.map(function(m){
      if(m.type === "video"){
        const src = toEmbedUrl(m.url);
        return '<div class="media"><iframe height="420" src="'+src+'" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><p>'+(m.caption||"")+'</p>';
      }
      return '<div class="media"><img src="'+(m.url||"")+'" alt="'+(m.caption||"")+'"></div><p>'+(m.caption||"")+'</p>';
    }).join("");
  }

  function patch(){
    try{
      if(typeof renderMedia === "function") renderMedia = renderMediaSafe;

      if(typeof renderItems === "function"){
        renderItems = function(kind, fid, route){
          const items=(DATA[kind]||[]).filter(i=>i.factionId===fid).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
          if(!items.length) return '<div class="card">Noch keine Einträge vorhanden.</div>';
          const isTraining = kind === "trainings";
          return '<div class="grid">'+items.map(function(i){
            return '<div class="card event-card">'
              + '<span class="badge">'+(isTraining ? "Ausbildung" : "Termin")+'</span>'
              + '<h3>'+i.title+'</h3>'
              + '<p><strong>Datum:</strong> '+(i.date||"folgt")+(i.time ? " · "+i.time : "")+'</p>'
              + '<p><strong>Ort:</strong> '+(i.location||"folgt")+'</p>'
              + (isTraining && i.duration ? '<p><strong>Dauer:</strong> '+i.duration+'</p>' : '')
              + (isTraining && i.requirements ? '<p><strong>Voraussetzungen:</strong> '+i.requirements+'</p>' : '')
              + (isTraining && i.lead ? '<p><strong>Leitung:</strong> '+i.lead+'</p>' : '')
              + '<p>'+(i.summary||"")+'</p>'
              + '<p><a class="details-btn" href="#/'+route+'/'+i.slug+'">Details öffnen</a></p>'
              + '</div>';
          }).join("")+'</div>';
        };
      }
    }catch(e){ console.error("Eisenfels V8 Patch Fehler", e); }
  }

  const timer = setInterval(function(){
    if(typeof DATA !== "undefined" && typeof renderItems === "function"){
      patch();
      clearInterval(timer);
      if(location.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, 100);
})();
