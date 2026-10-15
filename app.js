(() => {
  'use strict';

  const { MODULES, MISSIONS, REVIEW_BANK, BOSSES, PLACEMENT, GLOSSARY, ACHIEVEMENTS } = window.CYBER_DATA;
  const STORAGE_KEY = 'cyberpath:v2:state';
  const V1_KEY = 'cyberpath:v1:state';
  const DAILY_GOAL = 25;
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

  function normalizeText(v){ return String(v||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[“”"'`]/g,''); }
  function checkMissionAnswer(m,root){
    const c=m.check;
    if(!c) return {ok:true};
    if(c.kind==='mcq'){
      const checked=root.querySelector('input[name="missionAnswer"]:checked');
      if(!checked) return {ok:false,empty:true,msg:'Выбери ответ.'};
      const ok=Number(checked.value)===c.correct;
      return {ok,msg:ok?'Верно.':'Пока нет. Перечитай briefing и попробуй ещё раз.'};
    }
    const input=root.querySelector('[data-answer]');
    const val=String(input?.value||'').trim();
    if(!val) return {ok:false,empty:true,msg:'Сначала введи ответ.'};
    const n=normalizeText(val);
    if(c.kind==='short'){
      const ok=(c.answers||[]).some(a=>n===normalizeText(a) || n.includes(normalizeText(a)));
      return {ok,msg:ok?'Верно.':'Ответ не совпал с ожидаемым. Проверь команду/термин.'};
    }
    if(c.kind==='keywords'){
      const hits=(c.keywords||[]).filter(k=>n.includes(normalizeText(k))).length;
      const ok=hits>=(c.need||1);
      return {ok,msg:ok?'Достаточно ключевых идей.':`Нужно отразить ещё ключевые идеи (${hits}/${c.need||1}).`};
    }
    if(c.kind==='explain'){
      const hits=(c.keywords||[]).filter(k=>n.includes(normalizeText(k))).length;
      const ok=val.length>=(c.minChars||80) && hits>=(c.need||0);
      return {ok,msg:ok?'Хорошее teach-back объяснение.':`Нужно минимум ${c.minChars||80} символов и больше ключевых идей.`};
    }
    if(c.kind==='report'){
      const ok=val.length>=(c.minChars||180);
      return {ok,msg:ok?'Report выглядит достаточно содержательным для фиксации результата.':`Нужно минимум ${c.minChars||180} символов.`};
    }
    return {ok:true};
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

  function completeMission(m,root){
    if(missionDone(m.id)){ toast('Mission already completed'); return; }
    const result=checkMissionAnswer(m,root);
    if(!result.ok){
      recordAnswer(m.skill,false);
      addReviewCardForSkill(m.skill,today());
      saveState();
      showInlineCheck(root,result.msg,false);
      renderWeakSkills();
      return;
    }
    recordAnswer(m.skill,true);
    const elapsed=missionOpenedAt?Math.max(1,Math.round((Date.now()-missionOpenedAt)/60000)):1;
    const study=Math.min(m.duration,Math.max(1,focusSeconds?Math.round(focusSeconds/60):elapsed));
    state.completed.push({id:m.id,date:today(),xp:m.xp,module:m.module,skill:m.skill,type:m.type});
    addXp(m.xp);
    const masteryGain=m.mastery*3;
    addMastery(m.skill,masteryGain);
    addStudy(study);
    scheduleReviewsForMission(m);
    const note=root.querySelector('[data-mission-note]')?.value?.trim();
    if(note) state.notes[m.id]=note;
    saveState();
    stopMissionTimer();
    showInlineCheck(root,`Mission complete • +${m.xp} XP • +${masteryGain} mastery`,true);
    const btn=root.querySelector('[data-complete-mission]'); if(btn){btn.disabled=true;btn.textContent='Completed ✓';}
    renderAll();
    toast(`+${m.xp} XP • ${skillName(m.skill)} +${masteryGain} mastery`);
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

  function openMission(m,reviewOnly=false){
    stopMissionTimer();
    const content=document.getElementById('missionDialogContent');
    const savedNote=state.notes[m.id]||'';
    content.innerHTML=`
      <p class="muted tiny">${reviewOnly?'MISSION REVIEW':'MISSION BRIEFING'} • ${escapeHtml(moduleById(m.module)?.title||m.module)}</p>
      <h2>${escapeHtml(m.title)}</h2>
      <div class="quest-meta"><span class="tag type-tag">${missionTypeLabel(m.type)}</span><span class="tag">${escapeHtml(skillName(m.skill))}</span><span class="tag xp-tag">+${m.xp} XP</span><span class="tag">≈ ${m.duration} min</span></div>
      <div class="mission-brief"><p>${escapeHtml(m.briefing)}</p></div>
      <div class="learning-box"><ul>${m.body.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
      ${m.resource?`<a class="resource-link" href="${escapeHtml(m.resource)}" target="_blank" rel="noopener noreferrer">Open official training resource ↗</a>`:''}
      <div class="timer-row"><span class="muted">Focus timer</span><span class="focus-timer" data-focus-timer>00:00</span></div>
      <div class="mission-check">${reviewOnly?'<div class="check-result good">Mission already completed. Use this screen as a refresher.</div>':renderMissionCheck(m)}</div>
      <label class="field-label" style="margin-top:14px">Mission note<textarea data-mission-note rows="4" placeholder="Что запомнить? Не сохраняй passwords/tokens.">${escapeHtml(savedNote)}</textarea></label>
      <div class="button-row" style="margin-top:10px"><button type="button" class="secondary-btn" data-save-note>Save note</button>${reviewOnly?'':`<button type="button" class="primary-btn" data-complete-mission>Verify & complete</button>`}</div>`;
    content.querySelector('[data-save-note]').onclick=()=>{state.notes[m.id]=content.querySelector('[data-mission-note]').value.trim();saveState();renderStats();toast('Note saved');};
    const complete=content.querySelector('[data-complete-mission]'); if(complete) complete.onclick=()=>completeMission(m,content);
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

  function renderReview(cardOverride=null){
    const due=getDueReviewCards();document.getElementById('reviewDueChip').textContent=`${due.length} due`;
    const area=document.getElementById('reviewArea');area.innerHTML='';
    const card=cardOverride||due[0];
    if(!card){
      area.innerHTML='<div class="review-empty"><div style="font-size:35px">🧠</div><h3>No reviews due</h3><p class="muted">Это хорошо: сегодня память ничего не требует. Можно сделать добровольную practice card.</p><button id="practiceReviewBtn" class="secondary-btn">Practice one card</button></div>';
      area.querySelector('#practiceReviewBtn').onclick=()=>{const p=practiceReviewCard();if(p)renderReview(p);else toast('Сначала открой учебный модуль');};
      return;
    }
    const scheduled=!!state.review[card.id];
    area.innerHTML=`<div class="review-question"><p class="muted tiny">${scheduled?'DUE REVIEW':'PRACTICE'} • ${escapeHtml(skillName(card.skill))}</p><h3>${escapeHtml(card.q)}</h3>${card.options.map((o,i)=>`<label class="option"><input type="radio" name="reviewAnswer" value="${i}"><span>${escapeHtml(o)}</span></label>`).join('')}<div id="reviewResult"></div><button id="submitReview" class="primary-btn full">Check answer</button></div>`;
    area.querySelector('#submitReview').onclick=()=>{
      const checked=area.querySelector('input[name="reviewAnswer"]:checked');if(!checked){toast('Выбери ответ');return;}
      const ok=Number(checked.value)===card.correct;recordAnswer(card.skill,ok);
      if(ok){
        state.reviewCorrect++;addMastery(card.skill,1);
        if(scheduled){const r=state.review[card.id];r.stage=Math.min(REVIEW_INTERVALS.length-1,(r.stage||0)+1);r.due=dateOffset(new Date(),REVIEW_INTERVALS[r.stage]);r.last=today();}
        area.querySelector('#reviewResult').innerHTML='<div class="review-result good">✓ Верно. Карточка уйдёт дальше по интервалу.</div>';
      }else{
        state.reviewWrong++;
        if(!state.review[card.id])state.review[card.id]={stage:0,due:dateOffset(new Date(),1),last:today()};
        else{state.review[card.id].stage=0;state.review[card.id].due=dateOffset(new Date(),1);state.review[card.id].last=today();}
        area.querySelector('#reviewResult').innerHTML=`<div class="review-result bad">Неверно. Правильный ответ: <b>${escapeHtml(card.options[card.correct])}</b>. Вернём карточку завтра.</div>`;
      }
      saveState();renderStats();renderWeakSkills();
      const btn=area.querySelector('#submitReview');btn.textContent='Next card';btn.onclick=()=>renderReview();
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
    renderDashboard();renderMissions();renderRoadmap();renderReview();renderBosses();renderJournal();renderStats();
    document.getElementById('profileBtn').textContent=(state.playerName||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'CP';
  }

  function bindUI(){
    document.querySelectorAll('.nav-btn,.nav-jump').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.target)));
    document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{currentJournalTab=b.dataset.jtab;renderJournal();});
    document.getElementById('glossarySearch').addEventListener('input',renderGlossary);
    document.getElementById('placementBtn').onclick=renderPlacement;
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
