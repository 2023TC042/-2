const WEEKDAYS = ['月','火','水','木','金'];
const PERIODS = 6; 
const STORAGE_KEY = 'timetable-data-v1';

const timetableEl = document.getElementById('timetable');
const toggleBtn = document.getElementById('toggle-edit');

const modalEdit = document.getElementById('modal-edit');
const backdropEdit = document.getElementById('modal-edit-backdrop');
const form = document.getElementById('edit-form');
const subjectInput = document.getElementById('subject');
const roomInput = document.getElementById('room');
const timeStartHour = document.getElementById('time-start-hour');
const timeStartMin = document.getElementById('time-start-min');
const timeEndHour = document.getElementById('time-end-hour');
const timeEndMin = document.getElementById('time-end-min');
const deleteBtn = document.getElementById('delete-btn');
const cancelBtn = document.getElementById('cancel-btn');

const modalView = document.getElementById('modal-view');
const backdropView = document.getElementById('modal-view-backdrop');
const viewSubject = document.getElementById('view-subject');
const viewRoom = document.getElementById('view-room');
const viewTime = document.getElementById('view-time');
const reportsGrid = document.getElementById('reports-grid');
const viewSaveBtn = document.getElementById('view-save');
const viewCloseBtn = document.getElementById('view-close');

let editing = false;
let data = {}; // { "月-1": {subject, room, time, reports: [bool x15]}, ... }
let activeKey = null;
const REPORT_COUNT = 15;

function pad2(n){ return String(n).padStart(2,'0'); }

function populateTimeSelects(){
  if(timeStartHour.options.length > 0) return;
  const emptyOpt = (t)=>{ const o = document.createElement('option'); o.value = ''; o.textContent = t; return o; };
  timeStartHour.appendChild(emptyOpt('')); timeEndHour.appendChild(emptyOpt(''));
  for(let h=1;h<=12;h++){
    const o1 = document.createElement('option'); o1.value = String(h); o1.textContent = String(h);
    const o2 = o1.cloneNode(true);
    timeStartHour.appendChild(o1);
    timeEndHour.appendChild(o2);
  }
  timeStartMin.appendChild(document.createElement('option')).value = '';
  timeEndMin.appendChild(document.createElement('option')).value = '';
  timeStartMin.options[0].textContent = '';
  timeEndMin.options[0].textContent = '';
  for(let m=0;m<60;m++){
    const txt = pad2(m);
    const o1 = document.createElement('option'); o1.value = txt; o1.textContent = txt;
    const o2 = o1.cloneNode(true);
    timeStartMin.appendChild(o1);
    timeEndMin.appendChild(o2);
  }
}

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? JSON.parse(raw) : {};
  }catch(e){
    data = {};
  }
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function isVerticalLayout(){
  return window.matchMedia('(max-width: 760px), (orientation: portrait)').matches;
}

function buildGrid(){
  // clear
  timetableEl.innerHTML = '';

  const vertical = isVerticalLayout();

  if(!vertical){
    const corner = document.createElement('div');
    corner.className = 'header-cell corner';
    corner.textContent = '時限／曜日';
    timetableEl.appendChild(corner);

  WEEKDAYS.forEach(d=>{
    const h = document.createElement('div');
    h.className = 'header-cell';
    h.textContent = d;
    timetableEl.appendChild(h);
  });

  for(let p=1;p<=PERIODS;p++){
    const label = document.createElement('div');
    label.className = 'period-cell';
    label.textContent = `${p}限`;
    timetableEl.appendChild(label);

    WEEKDAYS.forEach(d=>{
      const key = `${d}-${p}`;
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.key = key;
      // add day/period attributes for responsive CSS
      slot.dataset.day = d;
      slot.dataset.period = p;

      const item = data[key];
      if(item && (item.subject || item.room || item.time)){
        const subj = document.createElement('div');
        subj.className = 'subject';
        subj.textContent = item.subject || '';
        slot.appendChild(subj);

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `${item.room || ''}${item.room && item.time ? ' · ' : ''}${item.time || ''}`;
        slot.appendChild(meta);
      }else{
        const placeholder = document.createElement('div');
        placeholder.style.color = '#bbb';
        placeholder.textContent = '（空）';
        slot.appendChild(placeholder);
      }

      slot.addEventListener('click', (e)=>{
        if(editing){
          openEditor(key);
        }else{
          openViewer(key);
        }
      });

      timetableEl.appendChild(slot);
    });
  }

  updateEditingState();
}
function setEditing(flag){
  editing = flag;
  updateEditingState();
  toggleBtn.textContent = `編集モード: ${editing ? 'ON' : 'OFF'}`;
}
function updateEditingState(){
  if(editing){
    timetableEl.classList.add('editing');
    timetableEl.querySelectorAll('.slot').forEach(s=>s.classList.add('editable'));
  }else{
    timetableEl.classList.remove('editing');
    timetableEl.querySelectorAll('.slot').forEach(s=>s.classList.remove('editable'));
  }
}
function parseTimeRange(str){
  if(!str || typeof str !== 'string') return null;
  const m = str.match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if(!m) return null;
  return {
    sh: String(Number(m[1])), // remove leading zero if any -> stores values as 1..12 possibly
    sm: pad2(Number(m[2])),
    eh: String(Number(m[3])),
    em: pad2(Number(m[4]))
  };
}

function openEditor(key){
  populateTimeSelects(); 
  activeKey = key;
  const item = data[key] || {};
  subjectInput.value = item.subject || '';
  roomInput.value = item.room || '';
  const parsed = parseTimeRange(item.time);
  if(parsed){
    timeStartHour.value = parsed.sh;
    timeStartMin.value = parsed.sm;
    timeEndHour.value = parsed.eh;
    timeEndMin.value = parsed.em;
  }else{
    timeStartHour.value = '';
    timeStartMin.value = '';
    timeEndHour.value = '';
    timeEndMin.value = '';
  }
  modalEdit.setAttribute('aria-hidden','false');
  modalEdit.style.display = 'flex';
  subjectInput.focus();
}
function closeEditor(){
  activeKey = null;
  modalEdit.setAttribute('aria-hidden','true');
  modalEdit.style.display = 'none';
  form.reset();
}

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  if(!activeKey) return;
  const subject = subjectInput.value.trim();
  const room = roomInput.value.trim();
   let time = '';
  const sh = timeStartHour.value;
  const sm = timeStartMin.value;
  const eh = timeEndHour.value;
  const em = timeEndMin.value;
  if(sh || sm || eh || em){
    const sHour = sh ? pad2(Number(sh)) : '01';
    const sMin = sm ? pad2(Number(sm)) : '00';
    const eHour = eh ? pad2(Number(eh)) : sHour;
    const eMin = em ? pad2(Number(em)) : '00';
    time = `${sHour}:${sMin}-${eHour}:${eMin}`;
  }
  if(!subject && !room && !time){

    delete data[activeKey];
  }else{
    const prev = data[activeKey] && data[activeKey].reports ? data[activeKey].reports : null;
    data[activeKey] = {subject, room, time};
    if(prev) data[activeKey].reports = prev;
  }
  saveData();
  buildGrid();
  closeEditor();
});

deleteBtn.addEventListener('click', ()=>{
  if(!activeKey) return;
  delete data[activeKey];
  saveData();
  buildGrid();
  closeEditor();
});

cancelBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  closeEditor();
});
backdropEdit.addEventListener('click', closeEditor);

function openViewer(key){
  activeKey = key;
  const item = data[key] || {};
  viewSubject.textContent = item.subject || '（未設定）';
  viewRoom.textContent = item.room || '（未設定）';
  viewTime.textContent = item.time || '（未設定）';

  reportsGrid.innerHTML = '';
  const reports = Array.isArray(item.reports) ? item.reports : Array(REPORT_COUNT).fill(false);
  for(let i=0;i<REPORT_COUNT;i++){
    const idx = i + 1;
    const div = document.createElement('label');
    div.className = 'report-item';
    div.title = `第${idx}回`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.index = i;
    cb.checked = !!reports[i];
    const span = document.createElement('span');
    span.textContent = `第${idx}回`;
    div.appendChild(cb);
    div.appendChild(span);
    reportsGrid.appendChild(div);
  }

  modalView.setAttribute('aria-hidden','false');
  modalView.style.display = 'flex';
}
function closeViewer(){
  activeKey = null;
  modalView.setAttribute('aria-hidden','true');
  modalView.style.display = 'none';
  reportsGrid.innerHTML = '';
}

viewSaveBtn.addEventListener('click', ()=>{
  if(!activeKey) return;
  const boxes = Array.from(reportsGrid.querySelectorAll('input[type="checkbox"]'));
  const reports = boxes.map(b => !!b.checked);
  if(!data[activeKey]) data[activeKey] = {};
  data[activeKey].reports = reports;
  saveData();
  closeViewer();
});

viewCloseBtn.addEventListener('click', ()=>{
  closeViewer();
});
backdropView.addEventListener('click', closeViewer);

toggleBtn.addEventListener('click', ()=>{
  setEditing(!editing);
});

loadData();
buildGrid();
setEditing(false);

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    if(modalEdit.getAttribute('aria-hidden') === 'false'){
      closeEditor();
    }else if(modalView.getAttribute('aria-hidden') === 'false'){
      closeViewer();
    }else if(editing){
      setEditing(false);
    }
  }
});
