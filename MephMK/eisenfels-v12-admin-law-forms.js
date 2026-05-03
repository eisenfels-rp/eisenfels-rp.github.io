
/* Eisenfels V12 Admin Patch: Gesetzbücher mit echten Formularfeldern */
(function(){
  let selectedParagraph = 0;

  function waitForCms(){
    if(typeof renderTab === "function" && typeof data !== "undefined"){
      patchAdmin();
      return;
    }
    setTimeout(waitForCms, 150);
  }

  function esc2(value){
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }

  function val2(id){
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function uid2(prefix){
    return String(prefix || "id") + "-" + Math.random().toString(36).slice(2,8);
  }

  function mediaText(media){
    if(typeof mediaToText === "function") return mediaToText(media);
    return (media || []).map(function(m){
      return [m.type || "image", m.url || "", m.caption || "", m.position || "bottom"].join("|");
    }).join("\n");
  }

  function parseMediaSafe(text){
    if(typeof parseMedia === "function") return parseMedia(text);
    return String(text || "").split(/\r?\n/).map(function(line){ return line.trim(); }).filter(Boolean).map(function(line){
      const parts = line.split("|");
      return {type:parts[0] || "image", url:parts[1] || "", caption:parts[2] || "", position:parts[3] || "bottom"};
    });
  }

  function patchAdmin(){
    try{
      window.renderLaws = renderLawsV12;
      window.bindLaws = bindLawsV12;
    }catch(e){
      console.error("Eisenfels V12 Admin Patch Fehler", e);
    }
  }

  function renderLawsV12(){
    const groups=data.lawGroups||[];
    const gi=selected.lawGroup||0;
    const li=selected.law||0;
    const g=groups[gi]||{laws:[]};
    const law=(g.laws||[])[li]||{};
    const paragraphs = law.paragraphs || [];
    if(selectedParagraph >= paragraphs.length) selectedParagraph = 0;
    const p = paragraphs[selectedParagraph] || {};

    const groupList=groups.map(function(group,i){
      return '<button type="button" data-g="'+i+'" class="'+(i===gi?'active':'')+'">'
        + esc2(group.title)
        + '<br><span class="cms-small">'+((group.laws||[]).length)+' Gesetze</span></button>';
    }).join('');

    const lawList=(g.laws||[]).map(function(item,i){
      return '<button type="button" data-l="'+i+'" class="'+(i===li?'active':'')+'">§ '+esc2(item.title)+'</button>';
    }).join('');

    const paragraphList=paragraphs.map(function(item,i){
      return '<button type="button" data-p="'+i+'" class="'+(i===selectedParagraph?'active':'')+'">'
        + esc2(item.paragraph || "§")
        + ' ' + esc2(item.title || "Ohne Titel")
        + '<br><span class="cms-small">'
        + (item.minFine || item.maxFine || item.jailMinutes || item.points ? 'Sanktionen eingetragen' : 'keine Sanktionen')
        + '</span></button>';
    }).join('');

    const paragraphForm = law.slug ? [
      '<h3>Paragraphen</h3>',
      '<div class="admin-actions"><button id="addParagraph" type="button">Neuer Paragraph</button></div>',
      '<div class="paragraph-editor">',
      '<div class="paragraph-list">'+(paragraphList || '<p class="cms-small">Noch keine Paragraphen.</p>')+'</div>',
      '<div class="paragraph-form">',
      paragraphs.length ? [
        '<div class="cms-row">',
        '<div><label>Paragraph</label><input id="para_paragraph" value="'+esc2(p.paragraph || '')+'" placeholder="§1"></div>',
        '<div><label>Titel</label><input id="para_title" value="'+esc2(p.title || '')+'" placeholder="Körperverletzung"></div>',
        '</div>',
        '<label>Beschreibung</label><textarea id="para_description">'+esc2(p.description || '')+'</textarea>',
        '<div class="cms-row">',
        '<div><label>Mindestgeldstrafe</label><input id="para_minFine" value="'+esc2(p.minFine || '')+'" placeholder="€500"></div>',
        '<div><label>Maximalgeldstrafe</label><input id="para_maxFine" value="'+esc2(p.maxFine || '')+'" placeholder="€2.000"></div>',
        '</div>',
        '<div class="cms-row">',
        '<div><label>Haftminuten</label><input id="para_jailMinutes" value="'+esc2(p.jailMinutes || '')+'" placeholder="15"></div>',
        '<div><label>Führerscheinpunkte</label><input id="para_points" value="'+esc2(p.points || '')+'" placeholder="nur bei Verkehr"></div>',
        '</div>',
        '<div class="admin-actions">',
        '<button id="saveParagraph" type="button">Paragraph übernehmen</button>',
        '<button class="cms-danger" id="deleteParagraph" type="button">Paragraph löschen</button>',
        '</div>'
      ].join('') : '<p>Lege zuerst einen Paragraphen an.</p>',
      '</div>',
      '</div>'
    ].join('') : '';

    const lawForm = law.slug ? [
      '<h3>Gesetzbuch bearbeiten</h3>',
      '<div class="cms-row">',
      '<div><label>Titel</label><input id="l_title" value="'+esc2(law.title)+'"></div>',
      '<div><label>Slug</label><input id="l_slug" value="'+esc2(law.slug)+'"></div>',
      '</div>',
      '<label>Allgemeine Beschreibung des Gesetzbuches</label>',
      '<textarea id="l_description">'+esc2(law.description || law.body || '')+'</textarea>',
      '<label>Medien</label>',
      '<textarea id="l_media">'+esc2(mediaText(law.media))+'</textarea>',
      '<div class="admin-actions">',
      '<button id="saveLaw" type="button">Gesetzbuch übernehmen</button>',
      '<button class="cms-danger" id="deleteLaw" type="button">Gesetzbuch löschen</button>',
      '</div>',
      paragraphForm
    ].join('') : '<p>Kein Gesetzbuch ausgewählt.</p>';

    const form=[
      '<h3>Gruppe</h3>',
      '<div class="cms-row">',
      '<div><label>Gruppentitel</label><input id="g_title" value="'+esc2(g.title||'')+'"></div>',
      '<div><label>Gruppen-ID</label><input id="g_id" value="'+esc2(g.id||'')+'"></div>',
      '</div>',
      '<div class="admin-actions">',
      '<button id="saveGroup" type="button">Gruppe übernehmen</button>',
      '<button id="addLaw" type="button">Neues Gesetzbuch</button>',
      '</div>',
      '<h3>Gesetzbücher dieser Gruppe</h3>',
      '<div class="cms-list">'+lawList+'</div>',
      lawForm
    ].join('');

    return listLayout('Gesetzbücher nach Gruppen','Neue Gesetzesgruppe',groupList,form);
  }

  function bindLawsV12(){
    document.querySelectorAll('.cms-list button[data-g]').forEach(function(button){
      button.onclick=function(){
        selected.lawGroup=Number(button.dataset.g);
        selected.law=0;
        selectedParagraph=0;
        renderTab();
      };
    });

    document.querySelectorAll('.cms-list button[data-l]').forEach(function(button){
      button.onclick=function(){
        selected.law=Number(button.dataset.l);
        selectedParagraph=0;
        renderTab();
      };
    });

    document.querySelectorAll('.paragraph-list button[data-p]').forEach(function(button){
      button.onclick=function(){
        selectedParagraph=Number(button.dataset.p);
        renderTab();
      };
    });

    document.getElementById('addItem').onclick=function(){
      data.lawGroups.push({id:uid2('gruppe'),title:'Neue Gruppe',laws:[]});
      selected.lawGroup=data.lawGroups.length-1;
      selected.law=0;
      selectedParagraph=0;
      renderTab();
    };

    document.getElementById('saveGroup').onclick=function(){
      const g=data.lawGroups[selected.lawGroup||0];
      g.title=val2('g_title');
      g.id=val2('g_id');
      renderTab();
      if(typeof setStatus === "function") setStatus('Gruppe übernommen.');
    };

    document.getElementById('addLaw').onclick=function(){
      const g=data.lawGroups[selected.lawGroup||0];
      g.laws=g.laws||[];
      g.laws.push({
        slug:'neues-gesetzbuch',
        title:'Neues Gesetzbuch',
        description:'',
        paragraphs:[],
        media:[]
      });
      selected.law=g.laws.length-1;
      selectedParagraph=0;
      renderTab();
    };

    const saveLaw=document.getElementById('saveLaw');
    if(saveLaw){
      saveLaw.onclick=function(){
        const law=data.lawGroups[selected.lawGroup||0].laws[selected.law||0];
        law.title=val2('l_title');
        law.slug=val2('l_slug');
        law.description=val2('l_description');
        law.body='';
        law.media=parseMediaSafe(val2('l_media'));
        law.paragraphs=law.paragraphs || [];
        renderTab();
        if(typeof setStatus === "function") setStatus('Gesetzbuch übernommen. Danach alle Änderungen speichern.');
      };
    }

    const deleteLaw=document.getElementById('deleteLaw');
    if(deleteLaw){
      deleteLaw.onclick=function(){
        if(confirm('Gesetzbuch löschen?')){
          data.lawGroups[selected.lawGroup||0].laws.splice(selected.law||0,1);
          selected.law=0;
          selectedParagraph=0;
          renderTab();
        }
      };
    }

    const addParagraph=document.getElementById('addParagraph');
    if(addParagraph){
      addParagraph.onclick=function(){
        const law=data.lawGroups[selected.lawGroup||0].laws[selected.law||0];
        law.paragraphs=law.paragraphs || [];
        law.paragraphs.push({
          paragraph:'§',
          title:'Neuer Paragraph',
          description:'',
          minFine:'',
          maxFine:'',
          jailMinutes:'',
          points:''
        });
        selectedParagraph=law.paragraphs.length-1;
        renderTab();
      };
    }

    const saveParagraph=document.getElementById('saveParagraph');
    if(saveParagraph){
      saveParagraph.onclick=function(){
        const law=data.lawGroups[selected.lawGroup||0].laws[selected.law||0];
        const p=law.paragraphs[selectedParagraph||0];
        p.paragraph=val2('para_paragraph');
        p.title=val2('para_title');
        p.description=val2('para_description');
        p.minFine=val2('para_minFine');
        p.maxFine=val2('para_maxFine');
        p.jailMinutes=val2('para_jailMinutes');
        p.points=val2('para_points');
        renderTab();
        if(typeof setStatus === "function") setStatus('Paragraph übernommen. Danach alle Änderungen speichern.');
      };
    }

    const deleteParagraph=document.getElementById('deleteParagraph');
    if(deleteParagraph){
      deleteParagraph.onclick=function(){
        if(confirm('Paragraph löschen?')){
          const law=data.lawGroups[selected.lawGroup||0].laws[selected.law||0];
          law.paragraphs.splice(selectedParagraph||0,1);
          selectedParagraph=0;
          renderTab();
        }
      };
    }
  }

  waitForCms();
})();
