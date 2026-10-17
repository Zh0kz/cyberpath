(() => {
  'use strict';

  const { MODULES, MISSIONS, REVIEW_BANK, BOSSES, PLACEMENT, GLOSSARY, ACHIEVEMENTS } = window.CYBER_DATA;
  const STORAGE_KEY = 'cyberpath:v2:state';
  const V1_KEY = 'cyberpath:v1:state';
  const AI_CONFIG_KEY = 'cyberpath:v2:ai-config';
  const AI_KEY_LOCAL = 'cyberpath:v2:openrouter-key';
  const AI_KEY_SESSION = 'cyberpath:v2:openrouter-key-session';
  const DAILY_GOAL = 25;
  const MAX_MISSION_HINTS = 3;
  const REVIEW_INTERVALS = [1,3,7,14,30];
  const BOSS_MASTERY_REQ = {
    foundations:50, networking:60, linux:60, recon:60, web:60, websec:62, privesc:62, pentest:65
  };
  const RANKS = [
    [null,'Rookie'],
    ['boss-foundations','Foundation Operator'],
    ['boss-networking','Network Operator'],
    ['boss-linux','Linux Operator'],
    ['boss-recon','Recon Scout'],
    ['boss-web','Web Analyst'],
    ['boss-websec','Web Hunter'],
    ['boss-privesc','Privilege Investigator'],
    ['boss-final','Junior Pentester']
  ];

  let currentModuleFilter = 'All';
  let currentTypeFilter = 'All';
  let currentJournalTab = 'notes';
  let deferredInstallPrompt = null;
  let missionOpenedAt = null;
  let missionTimer = null;
  let focusSeconds = 0;

  const defaultState = () => ({
    version: 2,
    playerName: 'Player',
    totalXp: 0,
    studyMinutes: 0,
    xpByDate: {},
    completed: [],
    placedOut: [],
    mastery: {},
    bosses: [],
    bossHints: {},
    missionHints: {},
    missionReveals: {},
    missionAttempts: {},
    missionAppeals: {},
    learnedAnswers: {},
    gradingDisagreements: [],
    mistakes: {},
    review: {},
    reviewCorrect: 0,
    reviewWrong: 0,
    notes: {},
    freeNotes: [],
    placement: null,
    createdAt: new Date().toISOString(),
    migratedFromV1: false
  });

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const p = JSON.parse(raw);
        return normalizeState({...defaultState(),...p});
      }
      const s = defaultState();
      const v1raw = localStorage.getItem(V1_KEY);
      if(v1raw){
        try{
          const v1 = JSON.parse(v1raw);
          s.playerName = v1.playerName || 'Player';
          s.studyMinutes = Number(v1.studyMinutes)||0;
          s.xpByDate = v1.xpByDate || {};
          // V1 XP is retained as activity only, not as knowledge/mastery.
          s.totalXp = Math.min(Number(v1.totalXp)||0, 1200);
          s.migratedFromV1 = true;
        }catch{}
      }
      return s;
    }catch{return defaultState();}
  }

  function normalizeState(s){
    s.xpByDate = s.xpByDate && typeof s.xpByDate==='object' ? s.xpByDate : {};
    s.completed = Array.isArray(s.completed) ? s.completed : [];
    s.placedOut = Array.isArray(s.placedOut) ? s.placedOut : [];
    s.mastery = s.mastery && typeof s.mastery==='object' ? s.mastery : {};
    s.bosses = Array.isArray(s.bosses) ? s.bosses : [];
    s.bossHints = s.bossHints && typeof s.bossHints==='object' ? s.bossHints : {};
    s.missionHints = s.missionHints && typeof s.missionHints==='object' ? s.missionHints : {};
    for(const id of Object.keys(s.missionHints)) s.missionHints[id]=Math.max(0,Math.min(MAX_MISSION_HINTS,Number(s.missionHints[id])||0));
    s.missionReveals = s.missionReveals && typeof s.missionReveals==='object' ? s.missionReveals : {};
    s.missionAttempts = s.missionAttempts && typeof s.missionAttempts==='object' ? s.missionAttempts : {};
    s.missionAppeals = s.missionAppeals && typeof s.missionAppeals==='object' ? s.missionAppeals : {};
    s.learnedAnswers = s.learnedAnswers && typeof s.learnedAnswers==='object' ? s.learnedAnswers : {};
    s.gradingDisagreements = Array.isArray(s.gradingDisagreements) ? s.gradingDisagreements : [];
    s.mistakes = s.mistakes && typeof s.mistakes==='object' ? s.mistakes : {};
    s.review = s.review && typeof s.review==='object' ? s.review : {};
    s.notes = s.notes && typeof s.notes==='object' ? s.notes : {};
    s.freeNotes = Array.isArray(s.freeNotes) ? s.freeNotes : [];
    s.totalXp = Number(s.totalXp)||0;
    s.studyMinutes = Number(s.studyMinutes)||0;
    s.reviewCorrect = Number(s.reviewCorrect)||0;
    s.reviewWrong = Number(s.reviewWrong)||0;
    s.version = 2;
    return s;
  }

  let state = loadState();

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const RESOURCE_LIBRARY = {
    foundations:[
      ['MDN: Network Monitor','https://developer.mozilla.org/en-US/docs/Tools/Network_Monitor'],
      ['Microsoft: Windows commands','https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/windows-commands']
    ],
    networking:[
      ['Cloudflare Learning: Networking','https://www.cloudflare.com/learning/network-layer/what-is-a-computer-port/'],
      ['Cloudflare Learning: DNS','https://www.cloudflare.com/learning/dns/what-is-dns/']
    ],
    linux:[
      ['Linux man-pages','https://man7.org/linux/man-pages/'],
      ['GNU Coreutils manual','https://www.gnu.org/software/coreutils/manual/coreutils.html']
    ],
    recon:[
      ['Nmap Reference Guide','https://nmap.org/book/man.html'],
      ['Nmap Book: Host Discovery','https://nmap.org/book/man-host-discovery.html']
    ],
    web:[
      ['MDN: HTTP overview','https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview'],
      ['PortSwigger: HTTP basics','https://portswigger.net/web-security/learning-paths']
    ],
    websec:[
      ['PortSwigger Web Security Academy','https://portswigger.net/web-security'],
      ['OWASP Web Security Testing Guide','https://owasp.org/www-project-web-security-testing-guide/']
    ],
    privesc:[
      ['Linux sudo manual','https://man7.org/linux/man-pages/man8/sudo.8.html'],
      ['Linux permissions (chmod)','https://man7.org/linux/man-pages/man1/chmod.1.html']
    ],
    pentest:[
      ['OWASP Web Security Testing Guide','https://owasp.org/www-project-web-security-testing-guide/'],
      ['NIST Technical Guide to Security Testing','https://csrc.nist.gov/publications/detail/sp/800-115/final']
    ]
  };

  function missionResources(m){
    const out=[];
    if(m.resource) out.push(['Mission training resource',m.resource]);
    for(const x of (RESOURCE_LIBRARY[m.module]||[])) if(!out.some(y=>y[1]===x[1])) out.push(x);
    return out.slice(0,3);
  }

  function loadAiConfig(){
    let cfg={model:'openrouter/free',remember:false,aiGrading:true,freeOnly:true};
    try{ cfg={...cfg,...JSON.parse(localStorage.getItem(AI_CONFIG_KEY)||'{}')}; }catch{}
    return cfg;
  }
  let aiConfig=loadAiConfig();
  function getAiKey(){ return sessionStorage.getItem(AI_KEY_SESSION)||localStorage.getItem(AI_KEY_LOCAL)||''; }
  function setAiKey(key,remember){
    sessionStorage.removeItem(AI_KEY_SESSION); localStorage.removeItem(AI_KEY_LOCAL);
    if(!key) return;
    if(remember) localStorage.setItem(AI_KEY_LOCAL,key); else sessionStorage.setItem(AI_KEY_SESSION,key);
  }
  function saveAiConfig(){ localStorage.setItem(AI_CONFIG_KEY,JSON.stringify(aiConfig)); renderAiStatus(); }
  function aiReady(){ return !!getAiKey(); }
  function renderAiStatus(){
    const b=document.getElementById('aiBtn'); if(b){b.classList.toggle('ai-ready',aiReady());b.title=aiReady()?'AI Judge connected':'Configure AI Judge & Coach';}
    const s=document.getElementById('aiStatusText'); if(s)s.textContent=aiReady()?`Connected • ${aiConfig.freeOnly!==false?'openrouter/free':aiConfig.model}`:'Not configured';
  }
  async function callOpenRouter(messages,{maxTokens=350,temperature=.25}={}){
    const key=getAiKey(); if(!key) throw new Error('OpenRouter API key is not configured.');
    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${key}`,
        'Content-Type':'application/json',
        'HTTP-Referer':location.origin,
        'X-OpenRouter-Title':'CyberPath'
      },
      body:JSON.stringify({model:aiConfig.freeOnly!==false?'openrouter/free':(aiConfig.model||'openrouter/free'),messages,temperature,max_tokens:maxTokens})
    });
    let data={}; try{data=await res.json();}catch{}
    if(!res.ok) throw new Error(data?.error?.message||`OpenRouter error ${res.status}`);
    const text=data?.choices?.[0]?.message?.content;
    if(!text) throw new Error('AI returned an empty response.');
    return String(text).trim();
  }
  function cyberCoachSystem(mode='coach'){
    return `You are CyberPath AI, a concise cybersecurity tutor and grading judge for a beginner. Reply primarily in Russian, keeping English technical terms when useful. The learner may only practice on their own devices, CTFs, intentionally vulnerable labs, or explicitly authorized systems. Never encourage testing random real targets. In GRADING mode evaluate understanding rather than exact wording. In APPEAL mode act as an independent judge: decide whether the submitted answer is semantically correct, almost correct, or incorrect. Never reveal the complete correct answer when the verdict is almost_correct or incorrect; give only a targeted clue about what is wrong or missing. Mode: ${mode}.`;
  }
  function missionQuestionText(m){
    const c=m.check||{};
    if(c.kind==='mcq') return `${c.question}\nOptions: ${(c.options||[]).map((x,i)=>`${i+1}) ${x}`).join(' | ')}`;
    return c.question||'Complete the mission.';
  }
  function getMissionAnswer(m,root){
    const c=m.check||{};
    if(c.kind==='mcq'){
      const checked=root.querySelector('input[name="missionAnswer"]:checked');
      if(!checked) return {empty:true,text:'',raw:'',index:null};
      const index=Number(checked.value);
      const text=String(c.options?.[index]??'').trim();
      return {empty:!text,text,raw:text,index};
    }
    const raw=String(root.querySelector('[data-answer]')?.value||'').trim();
    return {empty:!raw,text:raw,raw,index:null};
  }
  function missionRubric(m){
    const c=m.check||{};
    if(c.kind==='mcq') return `Correct option (instructor-only): ${c.options?.[c.correct]??''}`;
    if(c.kind==='short') return `Accepted meanings/examples (instructor-only): ${(c.answers||[]).join(' | ')}`;
    if(c.kind==='keywords') return `Required concepts (instructor-only): ${(c.keywords||[]).join(', ')}. Need at least ${c.need||1}.`;
    if(c.kind==='explain') return `Expected concepts (instructor-only): ${(c.keywords||[]).join(', ')}. Minimum useful length ${c.minChars||80}. Instructor notes: ${(m.body||[]).join(' | ')}`;
    if(c.kind==='report') return `Report should be coherent and at least ${c.minChars||180} characters. Instructor notes: ${(m.body||[]).join(' | ')}`;
    return `Instructor notes: ${(m.body||[]).join(' | ')}`;
  }
  function appealFingerprint(m,root){
    const answer=getMissionAnswer(m,root);
    if(answer.empty) return '';
    return `${m.check?.kind||'none'}:${window.CYBER_VALIDATOR?.fingerprint(answer.text)||answer.text.toLowerCase()}`;
  }
  function appealAlreadyUsed(m,fingerprint){
    return Array.isArray(state.missionAppeals[m.id]) && state.missionAppeals[m.id].includes(fingerprint);
  }
  function recordAppealUse(m,fingerprint){
    if(!Array.isArray(state.missionAppeals[m.id])) state.missionAppeals[m.id]=[];
    if(!state.missionAppeals[m.id].includes(fingerprint)) state.missionAppeals[m.id].push(fingerprint);
  }
  function rememberAcceptedAnswer(m,answer){
    if(m.check?.kind==='mcq' || !answer) return;
    const canonical=window.CYBER_VALIDATOR?.canonicalize(answer)||normalizeText(answer);
    if(!canonical) return;
    if(!Array.isArray(state.learnedAnswers[m.id])) state.learnedAnswers[m.id]=[];
    if(!state.learnedAnswers[m.id].includes(canonical)) state.learnedAnswers[m.id].push(canonical);
  }
  function extractJson(text){
    const clean=String(text).replace(/```json/gi,'').replace(/```/g,'').trim();
    const a=clean.indexOf('{'),b=clean.lastIndexOf('}');
    if(a<0||b<a) return null;
    try{return JSON.parse(clean.slice(a,b+1));}catch{return null;}
  }
  async function aiGradeMission(m,root){
    if(!aiReady()||!aiConfig.aiGrading||!['explain','report','keywords'].includes(m.check?.kind)) return null;
    const val=String(root.querySelector('[data-answer]')?.value||'').trim(); if(!val)return null;
    try{
      showInlineCheck(root,'✨ AI проверяет смысл ответа…',true);
      const raw=await callOpenRouter([
        {role:'system',content:cyberCoachSystem('GRADING')+' Return ONLY JSON: {"pass":boolean,"score":0-100,"feedback":"short feedback","next_hint":"one clue without the final answer"}.'},
        {role:'user',content:`Mission: ${m.title}\nSkill: ${skillName(m.skill)}\nQuestion: ${missionQuestionText(m)}\n${missionRubric(m)}\nLearner response:\n${val}\nEvaluate whether the learner demonstrates the required concept. Do not demand exact wording. If wrong, do not reveal the complete answer.`}
      ],{maxTokens:280,temperature:.1});
      const j=extractJson(raw); if(!j) throw new Error('Could not parse AI grading response.');
      return {ok:!!j.pass,msg:`AI semantic check: ${String(j.feedback||'Response reviewed.')}`,hint:String(j.next_hint||''),score:Number(j.score)||0,source:'ai-semantic'};
    }catch(e){return {fallback:true,error:e.message};}
  }

  async function challengeGrading(m,root){
    const area=root.querySelector('[data-appeal-area]');
    const answer=getMissionAnswer(m,root);
    if(answer.empty){toast('Сначала введи ответ');return;}
    const fingerprint=appealFingerprint(m,root);
    if(!fingerprint){toast('Не удалось прочитать ответ');return;}
    if(root.dataset.lastRejectedFingerprint!==fingerprint){toast('Сначала нажми Verify для этого ответа');return;}
    if(appealAlreadyUsed(m,fingerprint)){
      if(area) area.innerHTML='<div class="appeal-note">⚖️ Этот exact answer уже был оспорен. Измени ответ и снова нажми Verify.</div>';
      return;
    }
    if(!aiReady()){openAiDialog();toast('Добавь OpenRouter API key для оспаривания');return;}
    const btn=area?.querySelector('[data-challenge-grading]');
    if(btn){btn.disabled=true;btn.textContent='⚖️ AI judging…';}
    try{
      const raw=await callOpenRouter([
        {role:'system',content:cyberCoachSystem('APPEAL')+' Return ONLY JSON: {"verdict":"correct|almost_correct|incorrect","score":0-100,"feedback":"short Russian feedback","retry_hint":"one targeted clue; empty when verdict is correct"}.'},
        {role:'user',content:`A local validator rejected this answer. Act as an independent grading judge.\nMission: ${m.title}\nSkill: ${skillName(m.skill)}\nQuestion: ${missionQuestionText(m)}\n${missionRubric(m)}\nSubmitted answer:\n${answer.text}\n\nJudge the meaning, tolerate harmless formatting/case/separators, but do not forgive a technical error. A typo that changes a protocol keyword (for example ACK -> ACT) should normally be almost_correct, not correct. If verdict is almost_correct or incorrect, do NOT reveal the full correct answer.`}
      ],{maxTokens:300,temperature:0});
      const j=extractJson(raw);
      if(!j || !['correct','almost_correct','incorrect'].includes(String(j.verdict))) throw new Error('Could not parse AI appeal response.');
      recordAppealUse(m,fingerprint);
      const verdict=String(j.verdict);
      const score=Math.max(0,Math.min(100,Number(j.score)||0));
      state.gradingDisagreements.push({mission:m.id,date:new Date().toISOString(),answer:answer.text.slice(0,500),verdict,score});
      if(state.gradingDisagreements.length>100) state.gradingDisagreements=state.gradingDisagreements.slice(-100);
      saveState();

      if(verdict==='correct'){
        rememberAcceptedAnswer(m,answer.text);
        rollbackLastWrong(root,m.skill);
        if(area) area.innerHTML=`<div class="appeal-result accepted"><b>⚖️ Appeal accepted</b><br>${escapeHtml(String(j.feedback||'Ответ корректен по смыслу.'))}<br><small>CyberPath запомнил этот вариант ответа на этом устройстве.</small></div>`;
        await finalizeMission(m,root,{gradingSource:'appeal'});
        return;
      }

      const title=verdict==='almost_correct'?'🟡 Almost correct':'❌ Appeal rejected';
      const hint=String(j.retry_hint||'').trim();
      if(area) area.innerHTML=`<div class="appeal-result ${verdict==='almost_correct'?'almost':'rejected'}"><b>${title}</b><br>${escapeHtml(String(j.feedback||'Ответ нужно исправить.'))}${hint?`<div class="appeal-clue"><b>Что проверить:</b> ${escapeHtml(hint)}</div>`:''}<small>Измени ответ → Verify. Новый ответ можно оспорить снова.</small></div>`;
      saveState();
    }catch(e){
      if(area) area.innerHTML=`<div class="appeal-result rejected"><b>AI appeal unavailable</b><br>${escapeHtml(e.message)}</div>`;
    }
  }
  async function askGeneralCoach(){
    const q=document.getElementById('aiCoachQuestion')?.value?.trim(); const out=document.getElementById('aiCoachOutput');
    if(!q){toast('Write a question first');return;} if(!aiReady()){toast('Save an API key first');return;}
    out.innerHTML='<div class="ai-loading">Thinking…</div>';
    try{
      const text=await callOpenRouter([{role:'system',content:cyberCoachSystem('COACH')},{role:'user',content:q}],{maxTokens:500,temperature:.25});
      out.innerHTML=`<div class="ai-answer">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
    }catch(e){out.innerHTML=`<div class="check-result bad">${escapeHtml(e.message)}</div>`;}
  }
  function openAiDialog(){
    const d=document.getElementById('aiDialog');
    document.getElementById('aiKeyInput').value=getAiKey();
    document.getElementById('aiModelInput').value=aiConfig.model||'openrouter/free';
    document.getElementById('aiFreeOnly').checked=aiConfig.freeOnly!==false;
    document.getElementById('aiModelInput').disabled=aiConfig.freeOnly!==false;
    document.getElementById('aiRemember').checked=!!aiConfig.remember;
    document.getElementById('aiGrading').checked=aiConfig.aiGrading!==false;
    renderAiStatus(); d.showModal();
  }

  function localDate(d=new Date()){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function dateOffset(base,offset){ const d=new Date(base); d.setHours(12,0,0,0); d.setDate(d.getDate()+offset); return localDate(d); }
  function today(){ return localDate(); }
  function xpToday(){ return Number(state.xpByDate[today()]||0); }
  function addXp(amount){
    amount=Math.max(0,Math.round(amount));
    state.totalXp += amount;
    state.xpByDate[today()] = (state.xpByDate[today()]||0)+amount;
  }
  function addStudy(minutes){ state.studyMinutes += Math.max(1,Math.round(minutes)); }

  function getStreaks(){
    const active = Object.entries(state.xpByDate).filter(([,xp])=>Number(xp)>=DAILY_GOAL).map(([d])=>d).sort();
    if(!active.length) return {current:0,longest:0};
    const set=new Set(active);
    let longest=0,run=0,prev=null;
    for(const d of active){
      if(prev && dateOffset(new Date(`${prev}T12:00:00`),1)===d) run++; else run=1;
      longest=Math.max(longest,run); prev=d;
    }
    let cursor=today();
    if(!set.has(cursor)){
      const y=dateOffset(new Date(),-1);
      if(set.has(y)) cursor=y; else return {current:0,longest};
    }
    let current=0;
    while(set.has(cursor)){ current++; cursor=dateOffset(new Date(`${cursor}T12:00:00`),-1); }
    return {current,longest};
  }

  function levelInfo(){
    let level=1, spent=state.totalXp, need=140;
    while(level<50 && spent>=need){ spent-=need; level++; need=140+(level-1)*35; }
    return {level,current:spent,next:need,pct:Math.min(100,Math.round(spent/need*100))};
  }

  function rankInfo(){
    let rank='Rookie';
    for(const [boss,name] of RANKS){ if(!boss || state.bosses.includes(boss)) rank=name; }
    return rank;
  }

  function allSkillIds(){ return MODULES.flatMap(m=>m.skills.map(s=>s[0])); }
  function skillName(skillId){
    for(const m of MODULES){ const s=m.skills.find(x=>x[0]===skillId); if(s) return s[1]; }
    return skillId;
  }
  function skillMastery(skillId){ return Math.max(0,Math.min(100,Math.round(Number(state.mastery[skillId]||0)))); }
  function setMastery(skillId,value){ state.mastery[skillId]=Math.max(0,Math.min(100,Math.round(value))); }
  function addMastery(skillId,amount){ setMastery(skillId,skillMastery(skillId)+amount); }
  function moduleById(id){ return MODULES.find(m=>m.id===id); }
  function moduleMastery(moduleId){
    const m=moduleById(moduleId); if(!m) return 0;
    const vals=m.skills.map(s=>skillMastery(s[0]));
    return Math.round(vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length));
  }
  function overallMastery(){
    const vals=allSkillIds().map(skillMastery).filter(v=>v>0);
    return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
  }

  function moduleUnlocked(moduleId){
    const m=moduleById(moduleId); if(!m) return false;
    if(!m.requires) return true;
    return state.bosses.includes(m.requires.boss) && moduleMastery(m.requires.module)>=m.requires.mastery;
  }

  function completedRecord(id){ return state.completed.find(c=>c.id===id); }
  function missionDone(id){ return !!completedRecord(id) || state.placedOut.includes(id); }
  function missionById(id){ return MISSIONS.find(m=>m.id===id); }

  function missionUnlocked(m){
    if(!moduleUnlocked(m.module)) return false;
    if(missionDone(m.id)) return true;
    const list=MISSIONS.filter(x=>x.module===m.module);
    const idx=list.findIndex(x=>x.id===m.id);
    if(idx<=1) return true;
    if(m.type==='project'){
      const nonProjects=list.filter(x=>x.type!=='project');
      const done=nonProjects.filter(x=>missionDone(x.id)).length;
      return done>=Math.ceil(nonProjects.length*.55);
    }
    // Progressive prerequisites: each cluster opens after enough earlier work.
    const earlier=list.slice(0,idx);
    const needed=Math.min(idx, Math.max(1, Math.floor(idx*.6)));
    const done=earlier.filter(x=>missionDone(x.id)).length;
    return done>=needed;
  }

  function recordAnswer(skill,correct){
    if(!state.mistakes[skill]) state.mistakes[skill]={wrong:0,correct:0};
    if(correct) state.mistakes[skill].correct++; else state.mistakes[skill].wrong++;
  }
  function weaknessScore(skill){
    const x=state.mistakes[skill]||{wrong:0,correct:0};
    return Math.max(0,x.wrong*2-x.correct*.35)+(100-skillMastery(skill))/30;
  }
  function weakestSkills(limit=4){
    return allSkillIds().filter(s=>skillMastery(s)>0 || state.mistakes[s]).sort((a,b)=>weaknessScore(b)-weaknessScore(a)).slice(0,limit);
  }

  function normalizeText(v){
    return window.CYBER_VALIDATOR?.canonicalize(v) || String(v||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[“”"'`]/g,'');
  }
  function learnedAnswerMatches(m,value){
    const learned=Array.isArray(state.learnedAnswers[m.id])?state.learnedAnswers[m.id]:[];
    const canonical=normalizeText(value);
    return !!canonical && learned.includes(canonical);
  }
  function checkMissionAnswer(m,root){
    const c=m.check;
    if(!c) return {ok:true,source:'local'};
    if(c.kind==='mcq'){
      const checked=root.querySelector('input[name="missionAnswer"]:checked');
      if(!checked) return {ok:false,empty:true,msg:'Выбери ответ.',source:'local'};
      const ok=Number(checked.value)===c.correct;
      return {ok,msg:ok?'Верно.':'Пока нет. Проверь логику вопроса и попробуй ещё раз.',source:'local'};
    }
    const input=root.querySelector('[data-answer]');
    const val=String(input?.value||'').trim();
    if(!val) return {ok:false,empty:true,msg:'Сначала введи ответ.',source:'local'};
    const n=normalizeText(val);
    if(learnedAnswerMatches(m,val)) return {ok:true,msg:'Верно — этот эквивалентный вариант уже был подтверждён.',source:'learned'};
    if(c.kind==='short'){
      const ok=window.CYBER_VALIDATOR?.shortMatches(val,c.answers||[]) ?? (c.answers||[]).some(a=>n===normalizeText(a) || n.includes(normalizeText(a)));
      return {ok,msg:ok?'Верно.':'Ответ пока не принят. Если уверен, что смысл правильный, можешь оспорить проверку.',source:'local'};
    }
    if(c.kind==='keywords'){
      const hits=(c.keywords||[]).filter(k=>n.includes(normalizeText(k))).length;
      const ok=hits>=(c.need||1);
      return {ok,msg:ok?'Достаточно ключевых идей.':`Нужно отразить ещё ключевые идеи (${hits}/${c.need||1}).`,source:'local'};
    }
    if(c.kind==='explain'){
      const hits=(c.keywords||[]).filter(k=>n.includes(normalizeText(k))).length;
      const ok=val.length>=(c.minChars||80) && hits>=(c.need||0);
      return {ok,msg:ok?'Локальная проверка пройдена.':'Ответ пока слишком короткий или не покрывает ключевые идеи.',source:'local'};
    }
    if(c.kind==='report'){
      const ok=val.length>=(c.minChars||180);
      return {ok,msg:ok?'Локальная проверка отчёта пройдена.':`Нужно минимум ${c.minChars||180} символов.`,source:'local'};
    }
    return {ok:true,source:'local'};
  }

  function rollbackLastWrong(root,skill){
    if(root?.dataset?.wrongRecorded!=='1') return;
    const x=state.mistakes[skill];
    if(x && Number(x.wrong)>0) x.wrong--;
    root.dataset.wrongRecorded='0';
  }

  function addReviewCardForSkill(skill,due=today()){
    const candidates=REVIEW_BANK.filter(r=>r.skill===skill);
    if(!candidates.length) return;
    const existing=new Set(Object.keys(state.review));
    const next=candidates.find(c=>!existing.has(c.id)) || candidates[0];
    if(!state.review[next.id]) state.review[next.id]={stage:0,due,last:null};
    if(state.review[next.id].due>due) state.review[next.id].due=due;
  }

  function scheduleReviewsForMission(m){
    addReviewCardForSkill(m.skill,dateOffset(new Date(),1));
  }

  function clearAppealArea(root){
    const area=root.querySelector('[data-appeal-area]');
    if(area) area.innerHTML='';
    if(root?.dataset) delete root.dataset.lastRejectedFingerprint;
  }

  function showAppealOption(m,root,result){
    const area=root.querySelector('[data-appeal-area]');
    if(!area) return;
    const fp=appealFingerprint(m,root);
    if(!fp){area.innerHTML='';return;}
    const used=appealAlreadyUsed(m,fp);
    root.dataset.lastRejectedFingerprint=fp;
    const source=result?.source==='ai-semantic'?'AI semantic check':'local validator';
    area.innerHTML=`<div class="appeal-box"><div><b>Думаешь, проверка ошиблась?</b><br><span class="muted small">Оспаривание относится только к этому exact answer. AI увидит вопрос, rubric и твой ответ. Источник отказа: ${escapeHtml(source)}.</span></div><button type="button" class="secondary-btn appeal-btn" data-challenge-grading ${used?'disabled':''}>${used?'⚖️ Appeal used':'⚖️ Challenge grading'}</button></div>`;
    area.querySelector('[data-challenge-grading]')?.addEventListener('click',()=>challengeGrading(m,root));
  }

  async function finalizeMission(m,root,{gradingSource='local'}={}){
    if(missionDone(m.id)) return;
    recordAnswer(m.skill,true);
    root.dataset.wrongRecorded='0';
    const elapsed=missionOpenedAt?Math.max(1,Math.round((Date.now()-missionOpenedAt)/60000)):1;
    const study=Math.min(m.duration,Math.max(1,focusSeconds?Math.round(focusSeconds/60):elapsed));
    state.completed.push({id:m.id,date:today(),xp:m.xp,module:m.module,skill:m.skill,type:m.type,gradingSource});
    addXp(m.xp);
    const usedHints=Math.min(MAX_MISSION_HINTS,Number(state.missionHints[m.id]||0));
    const answerRevealed=!!state.missionReveals[m.id];
    let hintMultiplier=usedHints===0?1:usedHints===1?.85:usedHints===2?.70:.55;
    if(answerRevealed) hintMultiplier=Math.min(hintMultiplier,.25);
    const masteryGain=Math.max(1,Math.round(m.mastery*3*hintMultiplier));
    addMastery(m.skill,masteryGain);
    addStudy(study);
    scheduleReviewsForMission(m);
    if(answerRevealed) addReviewCardForSkill(m.skill,dateOffset(new Date(),1));
    const note=root.querySelector('[data-mission-note]')?.value?.trim();
    if(note) state.notes[m.id]=note;
    saveState();
    stopMissionTimer();
    clearAppealArea(root);
    const detail=[usedHints?`${usedHints}/${MAX_MISSION_HINTS} hints`:null,answerRevealed?'answer revealed':null,gradingSource==='appeal'?'AI appeal accepted':null].filter(Boolean).join(' • ');
    showInlineCheck(root,`Mission complete • +${m.xp} XP • +${masteryGain} mastery${detail?` • ${detail}`:''}`,true);
    revealStudyNotes(m,root,true);
    const btn=root.querySelector('[data-complete-mission]'); if(btn){btn.disabled=true;btn.textContent='Completed ✓';}
    root.querySelector('[data-local-hint]')?.setAttribute('disabled','');
    root.querySelector('[data-show-answer]')?.setAttribute('disabled','');
    renderAll();
    toast(`+${m.xp} XP • ${skillName(m.skill)} +${masteryGain} mastery`);
  }

  async function completeMission(m,root){
    if(missionDone(m.id)){ toast('Mission already completed'); return; }
    clearAppealArea(root);
    let result=checkMissionAnswer(m,root);
    if(result.empty){
      showInlineCheck(root,result.msg||'Сначала дай ответ.',false);
      return;
    }
    state.missionAttempts[m.id]=(state.missionAttempts[m.id]||0)+1;
    saveState();

    if(result.ok){
      const aiResult=await aiGradeMission(m,root);
      if(aiResult && !aiResult.fallback) result=aiResult;
      else if(aiResult?.fallback) toast(`AI grading fallback: ${aiResult.error}`);
    }

    if(!result.ok){
      recordAnswer(m.skill,false);
      root.dataset.wrongRecorded='1';
      addReviewCardForSkill(m.skill,today());
      saveState();
      showInlineCheck(root,result.msg||'Пока нет. Попробуй ещё раз.',false);
      if(result.hint){
        const feedback=root.querySelector('[data-feedback-area]');
        if(feedback) feedback.innerHTML=`<div class="feedback-clue"><b>Что проверить:</b> ${escapeHtml(result.hint)}</div>`;
      }
      showAppealOption(m,root,result);
      updateHintButtons(m,root);
      renderWeakSkills();
      return;
    }

    await finalizeMission(m,root,{gradingSource:result.source||'local'});
  }

  function showInlineCheck(root,msg,good){
    let box=root.querySelector('.check-result');
    if(!box){box=document.createElement('div');box.className='check-result';root.querySelector('.mission-check')?.appendChild(box);}
    box.className=`check-result ${good?'good':'bad'}`; box.textContent=msg;
  }

  function startMissionTimer(){
    stopMissionTimer(); focusSeconds=0; missionOpenedAt=Date.now();
    const el=document.querySelector('[data-focus-timer]');
    missionTimer=setInterval(()=>{focusSeconds++;if(el)el.textContent=formatSeconds(focusSeconds);},1000);
  }
  function stopMissionTimer(){ if(missionTimer){clearInterval(missionTimer);missionTimer=null;} }
  function formatSeconds(s){ const m=Math.floor(s/60),sec=String(s%60).padStart(2,'0');return `${String(m).padStart(2,'0')}:${sec}`; }

  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  let toastTimer;
  function toast(msg){ const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }

  function missionTypeLabel(t){return ({learn:'📖 Learn',quiz:'🧠 Quiz',lab:'⌨️ Lab',investigation:'🔎 Investigation',explain:'🗣️ Explain',report:'📝 Report',project:'🧰 Project'})[t]||t;}

  function missionCard(m){
    const done=missionDone(m.id), placed=state.placedOut.includes(m.id), unlocked=missionUnlocked(m);
    const el=document.createElement('article');
    el.className=`mission-card ${done?'done':''} ${unlocked?'':'locked'}`;
    el.innerHTML=`<div><div class="mission-title">${escapeHtml(m.title)}</div><p class="muted mission-desc">${escapeHtml(m.briefing)}</p><div class="quest-meta"><span class="tag">${escapeHtml(moduleById(m.module)?.title||m.module)}</span><span class="tag type-tag">${missionTypeLabel(m.type)}</span><span class="tag xp-tag">+${m.xp} XP</span><span class="tag">≈ ${m.duration} min</span>${m.type==='lab'?'<span class="tag safe-tag">AUTHORIZED LAB ONLY</span>':''}</div></div>`;
    const btn=document.createElement('button');btn.className='mission-action';btn.type='button';
    if(placed){btn.textContent='Placed out';btn.disabled=true;}
    else if(completedRecord(m.id)){btn.textContent='Review';btn.onclick=()=>openMission(m,true);}
    else if(!unlocked){btn.textContent='Locked';btn.disabled=true;}
    else{btn.textContent='Start';btn.onclick=()=>openMission(m,false);}
    el.appendChild(btn);return el;
  }

  function renderMissionCheck(m){
    const c=m.check;
    if(!c) return '';
    if(c.kind==='mcq'){
      return `<h4>${escapeHtml(c.question)}</h4>${c.options.map((o,i)=>`<label class="option"><input type="radio" name="missionAnswer" value="${i}"><span>${escapeHtml(o)}</span></label>`).join('')}`;
    }
    const rows=(c.kind==='report'||c.kind==='explain')?7:3;
    return `<h4>${escapeHtml(c.question)}</h4><textarea class="answer-input" data-answer rows="${rows}" placeholder="Твой ответ..."></textarea>`;
  }

  const MISSION_HINT_OVERRIDES = {
    'n-tcp':[
      'Представь начало разговора: клиент первым просит установить соединение. Как называется флаг синхронизации?',
      'Ответ сервера делает две вещи одновременно: подтверждает первый запрос и отправляет собственный запрос синхронизации.',
      'Финальное сообщение клиента уже не начинает новую синхронизацию — оно подтверждает ответ сервера.'
    ],
    'n-subnet24':[
      'В /24 первые 24 бита относятся к network part. Сколько бит остаётся?',
      'Количество адресов считается как 2 в степени количества host bits.',
      'Здесь спрашивают все адреса subnet, а не только usable hosts.'
    ],
    'f-ports':[
      'Вспомни стандартный remote shell protocol, который заменил небезопасный Telnet.',
      'Его default port находится в первых 25 TCP ports.',
      'Не путай его с FTP 21 и DNS 53.'
    ]
  };

  function progressiveHints(m){
    if(MISSION_HINT_OVERRIDES[m.id]) return MISSION_HINT_OVERRIDES[m.id];
    const c=m.check||{};
    const skill=skillName(m.skill);
    if(c.kind==='mcq') return [
      `Сначала определи, какую именно идею навыка «${skill}» проверяет вопрос. Не выбирай вариант только по знакомому слову.`,
      'Отбрось варианты, которые относятся к другому протоколу, уровню или назначению. Обычно после этого остаётся 1–2 кандидата.',
      `Сравни оставшиеся варианты с целью миссии «${m.title}»: какой из них прямо решает описанную задачу?`
    ];
    if(c.kind==='short') return [
      `Здесь нужен короткий термин, последовательность или команда из навыка «${skill}». Вспомни не формулировку, а действие.`,
      `Посмотри на контекст миссии «${m.title}»: какая команда/последовательность использовалась бы именно на указанной платформе или протоколе?`,
      'Проверь порядок, написание технических сокращений и разделители. Смысл важнее регистра букв, но сами protocol keywords должны быть точными.'
    ];
    if(c.kind==='keywords'||c.kind==='explain') return [
      `Ответь своими словами на два вопроса: что это делает и зачем это нужно в теме «${skill}»?`,
      'Добавь контекст: где это происходит — на хосте, в локальной сети, между сетями или на уровне веб-приложения?',
      'Проверь, описал ли ты механизм, а не только дал определение. Одно предложение «что», второе — «как/почему».'
    ];
    if(c.kind==='report') return [
      'Структурируй ответ: observation → evidence → impact → recommendation.',
      'Не ограничивайся названием проблемы: укажи, что именно ты наблюдал и почему это важно.',
      'Заверши конкретным следующим шагом или remediation, не придумывая фактов, которых не видел.'
    ];
    return [
      `Сфокусируйся на навыке «${skill}» и сформулируй, что именно требуется получить в конце миссии.`,
      'Разбей задачу на input → действие → expected output. Это часто сразу показывает правильное направление.',
      'Сверь свой ответ с briefing: не добавляй лишних предположений и проверь ключевые технические термины.'
    ];
  }

  function localHintText(m,level){
    return progressiveHints(m)[Math.max(0,Math.min(MAX_MISSION_HINTS-1,level))];
  }
  function renderStoredHints(m){
    const used=Math.min(MAX_MISSION_HINTS,Number(state.missionHints[m.id]||0));
    return Array.from({length:used},(_,i)=>`<div class="hint-box"><b>Hint ${i+1}</b><br>${escapeHtml(localHintText(m,i))}</div>`).join('');
  }
  function addLocalHint(m,root){
    const used=Math.min(MAX_MISSION_HINTS,Number(state.missionHints[m.id]||0));
    if(used>=MAX_MISSION_HINTS){toast('Все 3 hints уже использованы');updateHintButtons(m,root);return;}
    state.missionHints[m.id]=used+1; saveState();
    const box=root.querySelector('[data-hints-area]');
    const h=document.createElement('div');h.className='hint-box';h.innerHTML=`<b>Hint ${used+1}</b><br>${escapeHtml(localHintText(m,used))}`;box?.appendChild(h);
    updateHintButtons(m,root);
  }
  function answerRevealHtml(m){
    const c=m.check||{};
    let answer='';
    if(c.kind==='mcq') answer=c.options?.[c.correct]||'';
    else if(c.kind==='short') answer=c.answers?.[0]||'';
    if(answer){
      return `<div class="answer-reveal"><div class="learning-label">ANSWER REVEALED</div><div class="revealed-answer">${escapeHtml(answer)}</div><p class="muted small">Mastery за эту попытку будет ограничен, потому что ответ уже был показан.</p><div class="learning-box compact"><div class="learning-label">WHY / NOTES</div><ul>${(m.body||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><button type="button" class="secondary-btn" data-quick-retry>Quick retry without looking</button></div>`;
    }
    return `<div class="answer-reveal"><div class="learning-label">EXPECTED CONCEPTS REVEALED</div><p class="muted">Для открытого ответа нет одной магической строки. Ниже — идеи, которые должен покрывать хороший ответ.</p><div class="learning-box compact"><ul>${(m.body||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><p class="muted small">Mastery за эту попытку будет ограничен, потому что rubric уже был показан.</p><button type="button" class="secondary-btn" data-quick-retry>Quick retry without looking</button></div>`;
  }
  function bindQuickRetry(m,root){
    root.querySelector('[data-quick-retry]')?.addEventListener('click',()=>{
      const notes=root.querySelector('[data-study-notes]'); if(notes){notes.classList.add('hidden');notes.innerHTML='';}
      root.querySelectorAll('input[name="missionAnswer"]').forEach(x=>x.checked=false);
      const input=root.querySelector('[data-answer]'); if(input){input.value='';input.focus();}
      showInlineCheck(root,'Quick retry: ответ скрыт. Попробуй восстановить его без подсказки.',true);
      clearAppealArea(root);
      updateHintButtons(m,root);
    });
  }
  function revealAnswer(m,root){
    if(Number(state.missionHints[m.id]||0)<MAX_MISSION_HINTS){toast('Сначала используй 3 hints');return;}
    state.missionReveals[m.id]=true;
    addReviewCardForSkill(m.skill,dateOffset(new Date(),1));
    saveState();
    const notes=root.querySelector('[data-study-notes]'); if(!notes)return;
    notes.classList.remove('hidden');notes.innerHTML=answerRevealHtml(m);bindQuickRetry(m,root);updateHintButtons(m,root);
  }
  function revealStudyNotes(m,root,completed=false){
    const notes=root.querySelector('[data-study-notes]'); if(!notes)return;
    notes.classList.remove('hidden');
    notes.innerHTML=`<div class="learning-box"><div class="learning-label">${completed?'POST-MISSION NOTES':'STUDY NOTES'}</div><ul>${(m.body||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`;
  }
  function updateHintButtons(m,root){
    const attempts=Number(state.missionAttempts[m.id]||0),hints=Math.min(MAX_MISSION_HINTS,Number(state.missionHints[m.id]||0));
    const dots='●'.repeat(hints)+'○'.repeat(MAX_MISSION_HINTS-hints);
    const meta=root.querySelector('[data-hint-meta]');if(meta)meta.textContent=`Hints ${dots} ${hints}/${MAX_MISSION_HINTS} • Attempts: ${attempts}`;
    const hintBtn=root.querySelector('[data-local-hint]');
    if(hintBtn){hintBtn.disabled=hints>=MAX_MISSION_HINTS;hintBtn.textContent=hints>=MAX_MISSION_HINTS?'Hints exhausted':`💡 Hint ${hints}/${MAX_MISSION_HINTS}`;}
    const show=root.querySelector('[data-show-answer]');
    if(show){show.classList.toggle('hidden',hints<MAX_MISSION_HINTS);show.textContent=state.missionReveals[m.id]?'Show answer again':'👁 Show answer';}
  }
  function renderResources(m){
    const list=missionResources(m).slice(0,2); if(!list.length)return '';
    return `<div class="resource-panel"><div class="learning-label">LEARN MORE</div>${list.map(([name,url])=>`<a class="resource-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)} ↗</a>`).join('')}</div>`;
  }
  function renderGuidance(m,reviewOnly){
    if(reviewOnly||m.type==='learn') return `<div data-study-notes><div class="learning-box"><div class="learning-label">${reviewOnly?'REVIEW NOTES':'LEARNING NOTES'}</div><ul>${(m.body||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div></div>`;
    const hints=Math.min(MAX_MISSION_HINTS,Number(state.missionHints[m.id]||0));
    const revealed=!!state.missionReveals[m.id];
    return `<div class="guidance-shell"><div class="guidance-head"><div><div class="learning-label">HELP SYSTEM</div><p class="muted">До 3 progressive hints. После 3/3 можно сознательно открыть ответ. AI Hint удалён — AI используется как grading judge.</p></div><span class="chip" data-hint-meta>Hints ${'●'.repeat(hints)}${'○'.repeat(MAX_MISSION_HINTS-hints)} ${hints}/${MAX_MISSION_HINTS} • Attempts: ${Number(state.missionAttempts[m.id]||0)}</span></div><div data-hints-area class="hints-area">${renderStoredHints(m)}</div><div class="button-row hint-actions"><button type="button" class="secondary-btn" data-local-hint>💡 Hint ${hints}/${MAX_MISSION_HINTS}</button><button type="button" class="text-btn ${hints>=MAX_MISSION_HINTS?'':'hidden'}" data-show-answer>${revealed?'Show answer again':'👁 Show answer'}</button></div><div data-study-notes class="${revealed?'':'hidden'}">${revealed?answerRevealHtml(m):''}</div></div>`;
  }

  function openMission(m,reviewOnly=false){
    stopMissionTimer();
    const content=document.getElementById('missionDialogContent');
    const savedNote=state.notes[m.id]||'';
    content.innerHTML=`
      <p class="muted tiny">${reviewOnly?'MISSION REVIEW':'MISSION BRIEFING'} • ${escapeHtml(moduleById(m.module)?.title||m.module)}</p>
      <h2>${escapeHtml(m.title)}</h2>
      <div class="quest-meta"><span class="tag type-tag">${missionTypeLabel(m.type)}</span><span class="tag">${escapeHtml(skillName(m.skill))}</span><span class="tag xp-tag">+${m.xp} XP</span><span class="tag">≈ ${m.duration} min</span>${aiReady()?'<span class="tag ai-tag">⚖️ AI judge ready</span>':''}</div>
      <div class="mission-brief"><p>${escapeHtml(m.briefing)}</p></div>
      ${renderGuidance(m,reviewOnly)}
      ${renderResources(m)}
      <div class="timer-row"><span class="muted">Focus timer</span><span class="focus-timer" data-focus-timer>00:00</span></div>
      <div class="mission-check">${reviewOnly?'<div class="check-result good">Mission already completed. Use this screen as a refresher.</div>':`${renderMissionCheck(m)}<div data-feedback-area></div><div data-appeal-area></div>`}</div>
      <label class="field-label" style="margin-top:14px">Mission note<textarea data-mission-note rows="4" placeholder="Что запомнить? Не сохраняй passwords/tokens/API keys.">${escapeHtml(savedNote)}</textarea></label>
      <div class="button-row" style="margin-top:10px"><button type="button" class="secondary-btn" data-save-note>Save note</button>${reviewOnly?'':`<button type="button" class="primary-btn" data-complete-mission>Verify & complete</button>`}</div>`;
    content.querySelector('[data-save-note]').onclick=()=>{state.notes[m.id]=content.querySelector('[data-mission-note]').value.trim();saveState();renderStats();toast('Note saved');};
    content.querySelector('[data-local-hint]')?.addEventListener('click',()=>addLocalHint(m,content));
    content.querySelector('[data-show-answer]')?.addEventListener('click',()=>revealAnswer(m,content));
    if(state.missionReveals[m.id]) bindQuickRetry(m,content);
    const complete=content.querySelector('[data-complete-mission]'); if(complete) complete.onclick=()=>completeMission(m,content);
    const onAnswerChanged=()=>{
      const last=content.dataset.lastRejectedFingerprint||'';
      if(last && appealFingerprint(m,content)!==last) clearAppealArea(content);
    };
    content.querySelector('[data-answer]')?.addEventListener('input',onAnswerChanged);
    content.querySelectorAll('input[name="missionAnswer"]').forEach(x=>x.addEventListener('change',onAnswerChanged));
    updateHintButtons(m,content);
    document.getElementById('missionDialog').showModal();
    if(!reviewOnly) startMissionTimer(); else {missionOpenedAt=null;focusSeconds=0;}
  }

  function availableIncompleteMissions(){ return MISSIONS.filter(m=>!missionDone(m.id)&&missionUnlocked(m)); }
  function dailyMissions(){
    const avail=availableIncompleteMissions();
    const weak=new Set(weakestSkills(3));
    const priority=avail.filter(m=>weak.has(m.skill));
    const result=[];
    for(const m of [...priority,...avail]){ if(!result.some(x=>x.id===m.id)) result.push(m); if(result.length>=2) break; }
    return result;
  }

  function renderDashboard(){
    const lvl=levelInfo(),streak=getStreaks();
    document.getElementById('playerName').textContent=state.playerName;
    document.getElementById('rankLabel').textContent=`${rankInfo()} • Level ${lvl.level}`;
    document.getElementById('streakCount').textContent=streak.current;
    document.getElementById('xpLabel').textContent=`${lvl.current} / ${lvl.next} XP to next level`;
    document.getElementById('xpPercent').textContent=`${lvl.pct}%`;
    document.getElementById('xpBar').style.width=`${lvl.pct}%`;
    document.getElementById('totalXp').textContent=state.totalXp;
    document.getElementById('overallMastery').textContent=`${overallMastery()}%`;
    document.getElementById('questCount').textContent=state.completed.length;
    document.getElementById('studyTime').textContent=formatMinutes(state.studyMinutes);
    document.getElementById('dailyXp').textContent=xpToday();document.getElementById('dailyGoal').textContent=DAILY_GOAL;
    document.getElementById('dailyCompleteBanner').classList.toggle('hidden',xpToday()<DAILY_GOAL);
    const placement=document.getElementById('placementBanner');
    placement.classList.toggle('hidden',!!state.placement?.finished);

    const daily=document.getElementById('dailyPlan');daily.innerHTML='';
    const due=getDueReviewCards();
    if(due.length){
      const r=document.createElement('article');r.className='mission-card';r.innerHTML=`<div><div class="mission-title">↻ Review due</div><p class="muted mission-desc">${due.length} карточ${due.length===1?'ка':'ек'} готово к повторению.</p><div class="quest-meta"><span class="tag type-tag">🧠 Spaced repetition</span></div></div>`;
      const b=document.createElement('button');b.className='mission-action';b.textContent='Review';b.onclick=()=>navigate('review');r.appendChild(b);daily.appendChild(r);
    }
    const dm=dailyMissions();dm.forEach((m,i)=>{const card=missionCard(m);const info=card.querySelector('div');if(info){const role=document.createElement('div');role.className='daily-role';role.textContent=i===0?'MAIN MISSION':'PRACTICE MISSION';info.prepend(role);}daily.appendChild(card);});
    if(!due.length&&!dm.length) daily.innerHTML='<div class="review-empty"><h3>🎉 Current unlocked missions complete</h3><p class="muted">Проверь Boss Exams или Review Mode, чтобы открыть следующий модуль.</p></div>';

    renderHomeMastery();renderWeakSkills();
  }

  function renderHomeMastery(){
    const wrap=document.getElementById('homeMastery');wrap.innerHTML='';
    MODULES.filter(m=>moduleUnlocked(m.id)||moduleMastery(m.id)>0).slice(-4).forEach(m=>wrap.appendChild(masteryRow(m)));
    if(!wrap.children.length) wrap.innerHTML='<p class="muted">Mastery появится после первых проверенных заданий.</p>';
  }
  function masteryRow(m){
    const pct=moduleMastery(m.id),el=document.createElement('div');el.className='mastery-row';
    el.innerHTML=`<div class="mastery-head"><b>${m.icon} ${escapeHtml(m.title)}</b><span>${pct}%</span></div><div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;return el;
  }
  function renderWeakSkills(){
    const w=document.getElementById('weakSkills');if(!w)return; const weak=weakestSkills(4);w.innerHTML='';
    if(!weak.length){w.innerHTML='<p class="muted" style="margin:0">Ошибок пока недостаточно для адаптивных рекомендаций.</p>';return;}
    const box=document.createElement('div');box.className='weak-tags';
    weak.forEach(s=>{const e=document.createElement('span');e.className='weak-chip';e.textContent=`⚠ ${skillName(s)} • ${skillMastery(s)}%`;box.appendChild(e);});w.appendChild(box);
  }

  function renderMissions(){
    const filters=document.getElementById('moduleFilters');filters.innerHTML='';
    const mods=[{id:'All',title:'All',icon:'◎'},...MODULES];
    mods.forEach(m=>{const b=document.createElement('button');b.className=`filter-btn ${currentModuleFilter===m.id?'active':''}`;b.textContent=`${m.icon||''} ${m.title}`;b.onclick=()=>{currentModuleFilter=m.id;renderMissions();};filters.appendChild(b);});
    const types=['All','learn','quiz','lab','investigation','explain','report','project'];
    const tf=document.getElementById('typeFilters');tf.innerHTML='';types.forEach(t=>{const b=document.createElement('button');b.className=`filter-btn ${currentTypeFilter===t?'active':''}`;b.textContent=t==='All'?'All types':missionTypeLabel(t);b.onclick=()=>{currentTypeFilter=t;renderMissions();};tf.appendChild(b);});
    const list=document.getElementById('missionList');list.innerHTML='';
    const filtered=MISSIONS.filter(m=>(currentModuleFilter==='All'||m.module===currentModuleFilter)&&(currentTypeFilter==='All'||m.type===currentTypeFilter));
    filtered.forEach(m=>list.appendChild(missionCard(m)));
    document.getElementById('missionCountChip').textContent=`${state.completed.length} completed • ${state.placedOut.length} placed out`;
  }

  function renderRoadmap(){
    const wrap=document.getElementById('roadmap');wrap.innerHTML='';
    MODULES.forEach(m=>{
      const unlocked=moduleUnlocked(m.id), mastery=moduleMastery(m.id), boss=BOSSES.find(b=>b.module===m.id), bossDone=boss&&state.bosses.includes(boss.id);
      const current=unlocked&&!bossDone;
      const el=document.createElement('article');el.className=`module-card ${unlocked?'':'locked'} ${current?'current':''}`;
      const status=bossDone?'✓ CHECKPOINT PASSED':unlocked?`${mastery}% MASTERY`:'🔒 LOCKED';
      el.innerHTML=`<div class="module-top"><div class="module-icon">${m.icon}</div><div><p class="muted tiny">MODULE ${m.order}</p><h3>${escapeHtml(m.title)}</h3><p class="muted" style="font-size:12px;margin:0">${escapeHtml(m.description)}</p></div><div class="module-status">${status}</div></div><div class="subskill-grid">${m.skills.map(([id,name])=>`<div class="subskill"><div><span>${escapeHtml(name)}</span><span>${skillMastery(id)}%</span></div><div class="progress"><div class="progress-fill" style="width:${skillMastery(id)}%"></div></div></div>`).join('')}</div><p class="unlock-note">${unlockText(m,boss,mastery,bossDone)}</p>`;
      wrap.appendChild(el);
    });
  }
  function unlockText(m,boss,mastery,bossDone){
    if(!m.requires){ return bossDone?'Foundations checkpoint passed.':`Boss unlock target: ${BOSS_MASTERY_REQ[m.id]}% module mastery.`; }
    if(!moduleUnlocked(m.id)) return `Requires ${m.requires.mastery}% ${moduleById(m.requires.module).title} mastery + ${BOSSES.find(b=>b.id===m.requires.boss)?.title||'previous boss'}.`;
    if(bossDone) return 'Module checkpoint passed.';
    return `Boss unlock target: ${BOSS_MASTERY_REQ[m.id]}% module mastery.`;
  }

  function getDueReviewCards(){
    return Object.entries(state.review).filter(([,v])=>v&&v.due<=today()).map(([id])=>REVIEW_BANK.find(r=>r.id===id)).filter(Boolean);
  }
  function practiceReviewCard(){
    const unlockedModules=new Set(MODULES.filter(m=>moduleUnlocked(m.id)).map(m=>m.id));
    const candidates=REVIEW_BANK.filter(r=>unlockedModules.has(r.module));
    return candidates[Math.floor(Math.random()*candidates.length)]||null;
  }

  function renderReview(){
    const due=getDueReviewCards();document.getElementById('reviewDueChip').textContent=`${due.length} due`;
    const area=document.getElementById('reviewArea');area.innerHTML='';
    let card=due[0];
    if(!card){
      area.innerHTML='<div class="review-empty"><div style="font-size:35px">🧠</div><h3>No reviews due</h3><p class="muted">Это хорошо: сегодня память ничего не требует. Можно сделать добровольную practice card.</p><button id="practiceReviewBtn" class="secondary-btn">Practice one card</button></div>';
      document.getElementById('practiceReviewBtn').onclick=()=>{const pool=REVIEW_BANK.filter(r=>moduleUnlocked(r.module));if(pool.length)renderReviewCard(pool[Math.floor(Math.random()*pool.length)],false);};return;
    }
    renderReviewCard(card,true);
  }
  function renderReviewCard(card,scheduled){
    const area=document.getElementById('reviewArea'); let attempts=0;
    area.innerHTML=`<div class="review-question"><p class="muted tiny">${scheduled?'DUE REVIEW':'PRACTICE'} • ${escapeHtml(skillName(card.skill))}</p><h3>${escapeHtml(card.q)}</h3>${card.options.map((o,i)=>`<label class="option"><input type="radio" name="reviewAnswer" value="${i}"><span>${escapeHtml(o)}</span></label>`).join('')}<div id="reviewHint"></div><div id="reviewResult"></div><div class="button-row"><button id="submitReview" class="primary-btn">Check answer</button><button id="reviewHintBtn" class="secondary-btn" type="button">Hint</button><button id="showReviewAnswer" class="text-btn hidden" type="button">Show answer</button></div></div>`;
    let reviewHintUsed=false;
    const hint=()=>{
      if(reviewHintUsed)return;
      reviewHintUsed=true;
      const correct=card.options[card.correct];const clue=correct.length<=3?`Подумай о базовом определении навыка «${skillName(card.skill)}».`:`Сфокусируйся на назначении термина в навыке «${skillName(card.skill)}», а не на знакомом звучании варианта.`;
      area.querySelector('#reviewHint').innerHTML=`<div class="hint-box"><b>Review hint 1/1</b><br>${escapeHtml(clue)}</div>`;
      const btn=area.querySelector('#reviewHintBtn');btn.disabled=true;btn.textContent='Hint used';
    };
    area.querySelector('#reviewHintBtn').onclick=hint;
    area.querySelector('#showReviewAnswer').onclick=()=>{area.querySelector('#reviewResult').innerHTML=`<div class="review-result bad">Ответ: <b>${escapeHtml(card.options[card.correct])}</b>. Карточка вернётся завтра.</div>`;if(scheduled){const r=state.review[card.id]||{stage:0};r.stage=0;r.due=dateOffset(new Date(),1);r.last=today();state.review[card.id]=r;}saveState();};
    area.querySelector('#submitReview').onclick=()=>{
      const checked=area.querySelector('input[name="reviewAnswer"]:checked');if(!checked){toast('Выбери ответ');return;}
      const ok=Number(checked.value)===card.correct;recordAnswer(card.skill,ok);
      if(ok){
        state.reviewCorrect++;addMastery(card.skill,1);
        if(scheduled){const r=state.review[card.id];r.stage=Math.min(REVIEW_INTERVALS.length-1,(r.stage||0)+1);r.due=dateOffset(new Date(),REVIEW_INTERVALS[r.stage]);r.last=today();}
        area.querySelector('#reviewResult').innerHTML='<div class="review-result good">✓ Верно. Карточка уйдёт дальше по интервалу.</div>';
        saveState();renderStats();renderWeakSkills();setTimeout(renderReview,750);
      }else{
        attempts++;state.reviewWrong++;
        if(!state.review[card.id])state.review[card.id]={stage:0,due:dateOffset(new Date(),1),last:today()};
        else{state.review[card.id].stage=0;state.review[card.id].due=dateOffset(new Date(),1);state.review[card.id].last=today();}
        area.querySelector('#reviewResult').innerHTML=`<div class="review-result bad">Пока нет. Ответ не показываю — сначала попробуй ещё раз или возьми hint.</div>`;
        if(attempts>=2)area.querySelector('#showReviewAnswer').classList.remove('hidden');
        saveState();renderStats();renderWeakSkills();
      }
    };
  }

  function bossReady(b){
    if(!moduleUnlocked(b.module)) return false;
    if(moduleMastery(b.module)<BOSS_MASTERY_REQ[b.module]) return false;
    if(b.id==='boss-final'){
      const projects=state.completed.filter(c=>missionById(c.id)?.type==='project').length;
      if(projects<2) return false;
    }
    return true;
  }
  function bossLockReason(b){
    if(!moduleUnlocked(b.module)) return 'Complete previous checkpoint first.';
    const need=BOSS_MASTERY_REQ[b.module],have=moduleMastery(b.module);
    if(have<need) return `Need ${need}% module mastery • current ${have}%.`;
    if(b.id==='boss-final'){
      const p=state.completed.filter(c=>missionById(c.id)?.type==='project').length;
      if(p<2)return `Complete at least 2 projects • current ${p}.`;
    }
    return 'Ready.';
  }
  function renderBosses(){
    const wrap=document.getElementById('bossList');wrap.innerHTML='';
    BOSSES.forEach(b=>{
      const defeated=state.bosses.includes(b.id),ready=bossReady(b),used=state.bossHints[b.id]||0;
      const el=document.createElement('article');el.className=`boss-card ${defeated?'defeated':ready?'ready':'locked'}`;
      el.innerHTML=`<div class="boss-top"><div><p class="muted tiny">${defeated?'DEFEATED':ready?'BOSS READY':'LOCKED'}</p><h3>${b.icon} ${escapeHtml(b.title)}</h3></div><div class="boss-icon">${defeated?'🏆':'⚔️'}</div></div><p class="muted">${escapeHtml(b.intro)}</p><div class="quest-meta"><span class="tag">Mastery: ${moduleMastery(b.module)}%</span><span class="tag xp-tag">Reward: +${Math.round(b.reward*(1-used*.1))} XP max now</span>${b.id==='boss-final'?'<span class="tag">2 projects required</span>':''}</div><p class="unlock-note">${escapeHtml(bossLockReason(b))}</p><div class="boss-actions"></div>`;
      const btn=document.createElement('button');btn.className='boss-btn';btn.textContent=defeated?'Review exam':ready?'Enter arena':'Locked';btn.disabled=!ready&&!defeated;btn.onclick=()=>openBoss(b,defeated);el.querySelector('.boss-actions').appendChild(btn);wrap.appendChild(el);
    });
    document.getElementById('bossCountChip').textContent=`${state.bosses.length} defeated`;
  }

  function openBoss(b,reviewOnly=false){
    const content=document.getElementById('bossDialogContent');
    const hintsUsed=state.bossHints[b.id]||0;
    content.innerHTML=`<p class="muted tiny">BOSS EXAM • ${escapeHtml(moduleById(b.module).title)}</p><h2>${b.icon} ${escapeHtml(b.title)}</h2><p class="muted">${escapeHtml(b.intro)}</p><div class="quest-meta"><span class="tag">Pass: ${Math.round(b.pass*100)}%</span><span class="tag xp-tag">Base reward: +${b.reward} XP</span><span class="tag">Hints used: ${hintsUsed}/3</span></div><div id="bossHintsArea">${b.hints.slice(0,hintsUsed).map((h,i)=>`<div class="hint-box">Hint ${i+1}: ${escapeHtml(h)}</div>`).join('')}</div>${reviewOnly?'<div class="boss-result">🏆 This checkpoint is already defeated. Answers below are review-only.</div>':''}${b.questions.map((q,i)=>`<div class="boss-question"><p>${i+1}. ${escapeHtml(q.q)}</p>${q.options.map((o,j)=>`<label class="option"><input type="radio" name="bossq${i}" value="${j}" ${reviewOnly?'disabled':''}><span>${escapeHtml(o)}</span></label>`).join('')}</div>`).join('')}${b.reportPrompt?`<div class="boss-question"><p>${escapeHtml(b.reportPrompt)}</p><textarea id="bossReport" class="boss-report" rows="9" placeholder="Finding report..."></textarea><small class="muted">Minimum ${b.reportMin} characters.</small></div>`:''}<div id="bossResult"></div><div class="button-row" style="margin-top:12px">${!reviewOnly?'<button id="bossHintBtn" class="secondary-btn" type="button">Use hint (-10% reward)</button><button id="submitBoss" class="primary-btn" type="button">Submit exam</button>':'<button id="closeBossReview" class="secondary-btn" type="button">Close review</button>'}</div>`;
    if(reviewOnly){content.querySelector('#closeBossReview').onclick=()=>document.getElementById('bossDialog').close();document.getElementById('bossDialog').showModal();return;}
    const hintBtn=content.querySelector('#bossHintBtn');
    hintBtn.onclick=()=>{
      const used=state.bossHints[b.id]||0;if(used>=3){toast('All hints already used');return;}
      state.bossHints[b.id]=used+1;saveState();
      const h=document.createElement('div');h.className='hint-box';h.textContent=`Hint ${used+1}: ${b.hints[used]}`;content.querySelector('#bossHintsArea').appendChild(h);
      hintBtn.textContent=`Use hint (-10% reward) • ${used+1}/3`;renderBosses();
    };
    content.querySelector('#submitBoss').onclick=()=>{
      let answered=0,score=0;
      b.questions.forEach((q,i)=>{const x=content.querySelector(`input[name="bossq${i}"]:checked`);if(x){answered++;const ok=Number(x.value)===q.correct;if(ok)score++;recordAnswer(q.skill,ok);if(!ok)addReviewCardForSkill(q.skill,today());}});
      if(answered<b.questions.length){toast('Ответь на все вопросы');return;}
      if(b.reportPrompt){const text=content.querySelector('#bossReport').value.trim();if(text.length<(b.reportMin||0)){content.querySelector('#bossResult').innerHTML=`<div class="boss-result">Report too short: ${text.length}/${b.reportMin} characters.</div>`;return;}}
      const pct=score/b.questions.length;
      if(pct>=b.pass){
        const hints=state.bossHints[b.id]||0;const reward=Math.max(0,Math.round(b.reward*(1-hints*.1)));
        state.bosses.push(b.id);addXp(reward);addStudy(20);
        const mod=moduleById(b.module);mod.skills.forEach(([id])=>addMastery(id,5));
        saveState();
        content.querySelector('#bossResult').innerHTML=`<div class="boss-result">🏆 <b>BOSS DEFEATED</b><br>${score}/${b.questions.length} correct • +${reward} XP • rank progress verified.</div>`;
        content.querySelector('#submitBoss').disabled=true;hintBtn.disabled=true;renderAll();toast(`Boss defeated • +${reward} XP`);
      }else{
        content.querySelector('#bossResult').innerHTML=`<div class="boss-result">⚠ ${score}/${b.questions.length} correct. Need ${Math.ceil(b.questions.length*b.pass)}. Weak skills were added to Review Mode.</div>`;
        saveState();renderAll();
      }
    };
    document.getElementById('bossDialog').showModal();
  }

  function renderJournal(){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.jtab===currentJournalTab));
    document.querySelectorAll('.journal-tab').forEach(x=>x.classList.toggle('active',x.id===(currentJournalTab==='notes'?'journalNotes':'journalGlossary')));
    const list=document.getElementById('freeNotesList');list.innerHTML='';
    state.freeNotes.slice().reverse().forEach(n=>{const el=document.createElement('article');el.className='note-card';el.innerHTML=`<div class="note-meta"><span>${escapeHtml(new Date(n.createdAt).toLocaleString())}</span><button class="note-delete" data-note-id="${escapeHtml(n.id)}">Delete</button></div><div>${escapeHtml(n.text).replace(/\n/g,'<br>')}</div>`;list.appendChild(el);});
    list.querySelectorAll('[data-note-id]').forEach(b=>b.onclick=()=>{state.freeNotes=state.freeNotes.filter(n=>n.id!==b.dataset.noteId);saveState();renderJournal();});
    renderGlossary();
  }
  function renderGlossary(){
    const q=normalizeText(document.getElementById('glossarySearch')?.value||'');const list=document.getElementById('glossaryList');if(!list)return;list.innerHTML='';
    GLOSSARY.filter(g=>!q||normalizeText(g.term+' '+g.def).includes(q)).forEach(g=>{const e=document.createElement('div');e.className='glossary-item';e.innerHTML=`<b>${escapeHtml(g.term)}</b><div class="muted" style="margin-top:4px">${escapeHtml(g.def)}</div>`;list.appendChild(e);});
  }

  function formatMinutes(m){ const h=Math.floor(m/60),min=m%60;return h?`${h}h ${min}m`:`${min}m`; }
  function achievementState(){const st={...state,longestStreak:getStreaks().longest};return ACHIEVEMENTS.filter(a=>a.test(st));}
  function renderStats(){
    const streak=getStreaks();document.getElementById('statCurrentStreak').textContent=streak.current;document.getElementById('statLongestStreak').textContent=streak.longest;document.getElementById('statReview').textContent=state.reviewCorrect;document.getElementById('statBosses').textContent=state.bosses.length;
    const heat=document.getElementById('heatmap');heat.innerHTML='';for(let i=-34;i<=0;i++){const d=dateOffset(new Date(),i),xp=state.xpByDate[d]||0,l=xp===0?0:xp<25?1:xp<50?2:xp<90?3:4;const e=document.createElement('div');e.className=`heat-cell ${l?'l'+l:''}`;e.title=`${d}: ${xp} XP`;heat.appendChild(e);}
    const history=document.getElementById('historyList');history.innerHTML='';
    const dates=[...new Set([...Object.keys(state.xpByDate),...state.completed.map(c=>c.date)])].sort().reverse().slice(0,14);
    if(!dates.length) history.innerHTML='<p class="muted" style="margin:0">History появится после первой завершённой миссии.</p>';
    dates.forEach(d=>{const rows=state.completed.filter(c=>c.date===d);const det=document.createElement('details');det.innerHTML=`<summary><b>${escapeHtml(d)}</b><span>${state.xpByDate[d]||0} XP • ${rows.length} missions</span></summary><div class="history-items">${rows.length?rows.map(c=>{const m=missionById(c.id);return `<div class="history-item"><span>${escapeHtml(m?.title||c.id)}</span><span>+${c.xp||0} XP</span></div>`;}).join(''):'<div class="history-item"><span>Activity / boss / placement</span><span>XP recorded</span></div>'}</div>`;history.appendChild(det);});
    const ms=document.getElementById('moduleStats');ms.innerHTML='';MODULES.forEach(m=>ms.appendChild(masteryRow(m)));
    const unlocked=new Set(achievementState().map(a=>a.id));document.getElementById('achievementChip').textContent=`${unlocked.size}/${ACHIEVEMENTS.length} unlocked`;
    const grid=document.getElementById('achievementGrid');grid.innerHTML='';ACHIEVEMENTS.forEach(a=>{const e=document.createElement('article');e.className=`achievement ${unlocked.has(a.id)?'':'locked'}`;e.innerHTML=`<div class="badge">${a.icon}</div><div><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.desc)}</small></div>`;grid.appendChild(e);});
  }

  function renderPlacement(){
    const content=document.getElementById('placementContent');
    content.innerHTML=`<p class="muted tiny">PLACEMENT TEST • NO PENALTY</p><h2>Know what you already know</h2><p class="muted">Это диагностика, не экзамен. Ошибки просто попадут в Review Mode. Сильный результат может зачесть часть базовых теоретических миссий.</p>${PLACEMENT.map((q,i)=>`<div class="boss-question"><p>${i+1}. ${escapeHtml(q.q)}</p>${q.options.map((o,j)=>`<label class="option"><input type="radio" name="plq${i}" value="${j}"><span>${escapeHtml(o)}</span></label>`).join('')}</div>`).join('')}<div id="placementResult"></div><button id="submitPlacement" class="primary-btn full" type="button">Finish placement</button>`;
    content.querySelector('#submitPlacement').onclick=()=>{
      let answered=0,score=0;const byModule={};
      PLACEMENT.forEach((q,i)=>{const x=content.querySelector(`input[name="plq${i}"]:checked`);if(!x)return;answered++;const ok=Number(x.value)===q.correct;if(!byModule[q.module])byModule[q.module]={ok:0,total:0};byModule[q.module].total++;if(ok){score++;byModule[q.module].ok++;setMastery(q.skill,Math.max(skillMastery(q.skill),42));recordAnswer(q.skill,true);}else{setMastery(q.skill,Math.max(skillMastery(q.skill),5));recordAnswer(q.skill,false);addReviewCardForSkill(q.skill,today());}});
      if(answered<PLACEMENT.length){toast('Ответь на все placement questions');return;}
      const pct=Math.round(score/PLACEMENT.length*100);state.placement={finished:true,date:today(),score,total:PLACEMENT.length,percent:pct};
      // Fast-track obvious beginner theory only. Labs remain hands-on.
      Object.entries(byModule).forEach(([module,res])=>{
        if(res.total>=2 && res.ok/res.total>=.8){
          MISSIONS.filter(m=>m.module===module && ['learn','quiz'].includes(m.type)).slice(0,4).forEach(m=>{if(!state.placedOut.includes(m.id))state.placedOut.push(m.id);});
        }
      });
      const f=byModule.foundations;
      if(pct>=80 && f && f.ok/f.total>=.75){
        moduleById('foundations').skills.forEach(([id])=>setMastery(id,Math.max(skillMastery(id),60)));
        if(!state.bosses.includes('boss-foundations'))state.bosses.push('boss-foundations');
      }
      addXp(50);addStudy(12);saveState();
      content.querySelector('#placementResult').innerHTML=`<div class="boss-result"><div class="placement-score">${pct}%</div><b>${score}/${PLACEMENT.length}</b><br>${pct>=80?'Strong start. Beginner theory was partially fast-tracked.':'Good diagnostic. Weak areas are now visible in Review Mode.'}<br>+50 activity XP</div>`;
      content.querySelector('#submitPlacement').disabled=true;renderAll();toast(`Placement: ${pct}%`);
    };
    document.getElementById('placementDialog').showModal();
  }

  function exportProgress(){
    const payload={app:'CyberPath',version:2,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`cyberpath-backup-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exported');
  }
  async function importProgress(file){
    try{const text=await file.text();const p=JSON.parse(text);const incoming=p.state||p;if(Number(incoming.version)!==2)throw new Error('Not a V2 backup');if(!confirm('Replace current V2 progress with this backup?'))return;state=normalizeState({...defaultState(),...incoming});saveState();renderAll();toast('Backup imported');}catch(e){alert(`Import failed: ${e.message}`);}
  }

  function navigate(target){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===target));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===target));
    if(target==='review')renderReview();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderAll(){
    renderDashboard();renderMissions();renderRoadmap();renderReview();renderBosses();renderJournal();renderStats();renderAiStatus();
    document.getElementById('profileBtn').textContent=(state.playerName||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'CP';
  }

  function bindUI(){
    document.querySelectorAll('.nav-btn,.nav-jump').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.target)));
    document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{currentJournalTab=b.dataset.jtab;renderJournal();});
    document.getElementById('glossarySearch').addEventListener('input',renderGlossary);
    document.getElementById('placementBtn').onclick=renderPlacement;
    document.getElementById('aiBtn').onclick=openAiDialog;
    document.getElementById('saveAiBtn').onclick=()=>{const key=document.getElementById('aiKeyInput').value.trim();aiConfig.freeOnly=document.getElementById('aiFreeOnly').checked;aiConfig.model=aiConfig.freeOnly?'openrouter/free':(document.getElementById('aiModelInput').value.trim()||'openrouter/free');aiConfig.remember=document.getElementById('aiRemember').checked;aiConfig.aiGrading=document.getElementById('aiGrading').checked;setAiKey(key,aiConfig.remember);saveAiConfig();toast(key?'AI settings saved':'AI key cleared');};
    document.getElementById('aiFreeOnly').onchange=e=>{document.getElementById('aiModelInput').disabled=e.target.checked;if(e.target.checked)document.getElementById('aiModelInput').value='openrouter/free';};
    document.getElementById('testAiBtn').onclick=async()=>{document.getElementById('saveAiBtn').click();const out=document.getElementById('aiCoachOutput');out.innerHTML='<div class="ai-loading">Testing connection…</div>';try{const text=await callOpenRouter([{role:'system',content:'Reply with exactly: CyberPath AI online'},{role:'user',content:'Connection test'}],{maxTokens:20,temperature:0});out.innerHTML=`<div class="check-result good">${escapeHtml(text)}</div>`;}catch(e){out.innerHTML=`<div class="check-result bad">${escapeHtml(e.message)}</div>`;}};
    document.getElementById('askAiBtn').onclick=askGeneralCoach;
    const pd=document.getElementById('profileDialog');document.getElementById('profileBtn').onclick=()=>{document.getElementById('nameInput').value=state.playerName==='Player'?'':state.playerName;pd.showModal();};
    document.getElementById('profileForm').addEventListener('submit',e=>{e.preventDefault();const n=document.getElementById('nameInput').value.trim();if(n)state.playerName=n;saveState();pd.close();renderAll();});
    document.getElementById('missionDialog').addEventListener('close',stopMissionTimer);
    document.getElementById('addNoteBtn').onclick=()=>{const ta=document.getElementById('freeNote'),text=ta.value.trim();if(!text){toast('Write a note first');return;}state.freeNotes.push({id:`n-${Date.now()}`,text,createdAt:new Date().toISOString()});ta.value='';saveState();renderJournal();renderStats();toast('Note added');};
    document.getElementById('exportBtn').onclick=exportProgress;document.getElementById('importInput').onchange=e=>{if(e.target.files?.[0])importProgress(e.target.files[0]);e.target.value='';};
    document.getElementById('resetBtn').onclick=()=>{if(confirm('Delete all CyberPath V2 progress on this device?')){localStorage.removeItem(STORAGE_KEY);state=defaultState();saveState();renderAll();toast('V2 progress reset');}};
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
    document.getElementById('installBtn').onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}else if(/iphone|ipad|ipod/i.test(navigator.userAgent)){toast('Safari: Share → Add to Home Screen');}else toast('Browser menu → Install app / Add to Home screen');};
  }

  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}
  bindUI();renderAll();
  if(state.migratedFromV1 && !sessionStorage.getItem('cp-v2-migration-toast')){sessionStorage.setItem('cp-v2-migration-toast','1');setTimeout(()=>toast('V1 activity imported; knowledge mastery starts fresh'),700);}
})();
