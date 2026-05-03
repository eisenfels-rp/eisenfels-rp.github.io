
/* Eisenfels V12: Gesetzbücher mit Paragraphen-Karten */
(function(){
  function moneyText(min, max){
    min = String(min || "").trim();
    max = String(max || "").trim();
    if(min && max) return min + " – " + max;
    if(min) return min;
    if(max) return max;
    return "";
  }

  function renderLawCards(law){
    const desc = law.description || law.body || "";
    const paragraphs = law.paragraphs || [];
    let html = "";

    if(desc){
      html += '<div class="card law-description"><h2>Allgemeine Beschreibung</h2><p>' + String(desc).replace(/\n/g, "<br>") + '</p></div>';
    }

    if(!paragraphs.length){
      html += '<div class="card">Noch keine Paragraphen eingetragen.</div>';
      return html;
    }

    html += '<div class="law-grid">';
    html += paragraphs.map(function(p){
      const fine = moneyText(p.minFine, p.maxFine);
      return '<div class="card law-card">'
        + '<div class="law-topline"><span class="badge">'+(p.paragraph || "§")+'</span>'+(p.points ? '<span class="law-points">'+p.points+' Punkt(e)</span>' : '')+'</div>'
        + '<h3>'+ (p.title || "Ohne Titel") +'</h3>'
        + (p.description ? '<p>'+String(p.description).replace(/\n/g,"<br>")+'</p>' : '')
        + '<div class="law-meta">'
        + (fine ? '<div><strong>Geldstrafe:</strong><br>'+fine+'</div>' : '')
        + (p.jailMinutes ? '<div><strong>Haft:</strong><br>'+p.jailMinutes+' Minuten</div>' : '')
        + '</div>'
        + '</div>';
    }).join("");
    html += '</div>';
    return html;
  }

  function patch(){
    try{
      if(typeof renderLaw === "function"){
        renderLaw = function(slug){
          for(const g of DATA.lawGroups){
            const law = g.laws.find(l=>l.slug===slug);
            if(law){
              header(law.title, g.title);
              const tools = '<div class="page-tools"><button class="back-btn" id="backBtn">← Zurück</button><div class="breadcrumbs"><a href="#/startseite">Startseite</a> › <a href="#/gesetzbuecher">Gesetzbücher</a> › <span>'+law.title+'</span></div></div>';
              const top = typeof renderMediaByPosition === "function" ? renderMediaByPosition(law.media || [], "top") : "";
              const bottom = typeof renderMediaByPosition === "function" ? renderMediaByPosition(law.media || [], "bottom") : (typeof renderMedia === "function" ? renderMedia(law.media || []) : "");
              document.querySelector('#content').innerHTML = tools + top + renderLawCards(law) + bottom;
              const btn = document.querySelector('#backBtn');
              if(btn) btn.onclick = function(){ location.hash = '#/gesetzbuecher'; };
              return;
            }
          }
          if(typeof notFound === "function") notFound();
        };
      }
    }catch(e){
      console.error("Eisenfels V12 Gesetz-Patch Fehler", e);
    }
  }

  const timer = setInterval(function(){
    if(typeof DATA !== "undefined" && typeof renderLaw === "function"){
      patch();
      clearInterval(timer);
      if(location.hash && location.hash.indexOf("#/gesetz/") === 0){
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    }
  },100);
})();
