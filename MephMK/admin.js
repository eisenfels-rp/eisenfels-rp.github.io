
const cfg = window.EISENFELS_ADMIN_CONFIG;
const $ = s => document.querySelector(s);
let currentSha = null;

async function sha256(text){
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function setStatus(msg, ok=true){
  const el = $('#status') || $('#loginStatus');
  if(el){ el.textContent = msg; el.className = ok ? 'status-ok' : 'status-bad'; }
}
function token(){ return $('#token').value.trim() || localStorage.getItem('ef_github_token') || ''; }
function repoApi(path){
  return `https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${path}`;
}
async function ghGet(path){
  const res = await fetch(repoApi(path) + `?ref=${cfg.branch}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept:'application/vnd.github+json' }
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function ghPut(path, content, message, sha){
  const body = { message, content: btoa(unescape(encodeURIComponent(content))), branch: cfg.branch };
  if(sha) body.sha = sha;
  const res = await fetch(repoApi(path), {
    method:'PUT',
    headers: { Authorization: `Bearer ${token()}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function login(){
  const h = await sha256($('#password').value);
  if(h === cfg.passwordHash){
    sessionStorage.setItem('ef_admin','1');
    $('#loginBox').style.display='none';
    $('#cmsBox').style.display='block';
    $('#token').value = localStorage.getItem('ef_github_token') || '';
    setStatus('Login erfolgreich.');
  } else {
    $('#loginStatus').textContent='Falsches Passwort.';
    $('#loginStatus').className='status-bad';
  }
}
async function loadContent(){
  try{
    if(!token()) throw new Error('GitHub Token fehlt.');
    const data = await ghGet(cfg.contentPath);
    currentSha = data.sha;
    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g,''))));
    $('#editor').value = JSON.stringify(JSON.parse(decoded), null, 2);
    setStatus('Inhalte geladen.');
  }catch(e){ setStatus('Fehler beim Laden: '+e.message, false); }
}
async function saveGithub(){
  try{
    if(!token()) throw new Error('GitHub Token fehlt.');
    const parsed = JSON.parse($('#editor').value);
    const formatted = JSON.stringify(parsed, null, 2);
    if(!currentSha){
      const data = await ghGet(cfg.contentPath);
      currentSha = data.sha;
    }
    const res = await ghPut(cfg.contentPath, formatted, 'Website Inhalte aktualisiert', currentSha);
    currentSha = res.content.sha;
    $('#editor').value = formatted;
    setStatus('Gespeichert. Website nach kurzer Zeit neu laden.');
  }catch(e){ setStatus('Fehler beim Speichern: '+e.message, false); }
}
async function changePassword(){
  try{
    if(!token()) throw new Error('GitHub Token fehlt.');
    const pw = $('#newPassword').value;
    if(!pw || pw.length < 8) throw new Error('Passwort muss mindestens 8 Zeichen haben.');
    const newHash = await sha256(pw);
    const configText = `window.EISENFELS_ADMIN_CONFIG = {\n  passwordHash: "${newHash}",\n  repoOwner: "${cfg.repoOwner}",\n  repoName: "${cfg.repoName}",\n  branch: "${cfg.branch}",\n  contentPath: "${cfg.contentPath}"\n};\n`;
    const data = await ghGet('MephMK/admin-config.js');
    await ghPut('MephMK/admin-config.js', configText, 'Admin Passwort geändert', data.sha);
    setStatus('Passwort geändert. Seite neu laden und mit neuem Passwort einloggen.');
  }catch(e){ setStatus('Fehler beim Ändern: '+e.message, false); }
}
function downloadContent(){
  const blob = new Blob([$('#editor').value || '{}'], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'content.json';
  a.click();
}
function formatJson(){
  try{
    $('#editor').value = JSON.stringify(JSON.parse($('#editor').value), null, 2);
    setStatus('JSON ist gültig.');
  }catch(e){ setStatus('JSON Fehler: '+e.message, false); }
}
$('#loginBtn').onclick = login;
$('#password').addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
$('#saveToken').onclick = ()=>{ localStorage.setItem('ef_github_token', $('#token').value.trim()); setStatus('Token lokal gespeichert.'); };
$('#loadContent').onclick = loadContent;
$('#saveGithub').onclick = saveGithub;
$('#formatJson').onclick = formatJson;
$('#downloadContent').onclick = downloadContent;
$('#changePassword').onclick = changePassword;
$('#logout').onclick = ()=>{ sessionStorage.removeItem('ef_admin'); location.reload(); };
if(sessionStorage.getItem('ef_admin')==='1'){
  $('#loginBox').style.display='none';
  $('#cmsBox').style.display='block';
  $('#token').value = localStorage.getItem('ef_github_token') || '';
}
