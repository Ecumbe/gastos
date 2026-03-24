
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════════════════
// ESTADOS LOCALES
// ══════════════════════════════════════════════════════
const KEY_AUTH = 'mf2_auth';
function loadAuth(){ try{ return JSON.parse(localStorage.getItem(KEY_AUTH)) || {user:'admin',pass:'1234'}; }catch{ return {user:'admin',pass:'1234'}; } }
function saveAuth(){ localStorage.setItem(KEY_AUTH, JSON.stringify(AUTH)); }

let AUTH = loadAuth();
let ME = null;

// Base de datos en memoria para el frontend
let DB_GASTOS = [];
let DB_INGRESOS = {}; 

// ══════════════════════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════════════════════
async function doLogin(){
  const u = $('li-user').value.trim(), p = $('li-pass').value;
  if(u === AUTH.user && p === AUTH.pass){
    ME = u;
    $('li-err').textContent='';
    $('s-login').classList.add('left');
    $('s-main').classList.remove('off');
    $('tb-user').textContent = ME;
    buildMonthSels();
    await fetchData(); 
  } else {
    $('li-err').textContent='Usuario o contraseña incorrectos';
  }
}

function doLogout(){
  ME=null; DB_GASTOS=[]; DB_INGRESOS={};
  $('s-login').classList.remove('left');
  $('s-main').classList.add('off');
  $('li-user').value=''; $('li-pass').value='';
}

function openChgPass(){
  $('pw-old').value=''; $('pw-new').value=''; $('pw-err').textContent='';
  openOv('ov-pw');
}

function savePass(){
  if($('pw-old').value !== AUTH.pass){ $('pw-err').textContent='Contraseña actual incorrecta'; return; }
  if(!$('pw-new').value){ $('pw-err').textContent='Escribe la nueva contraseña'; return; }
  AUTH.pass = $('pw-new').value; 
  saveAuth();
  closeOv('ov-pw'); alert('Contraseña actualizada ✓');
}

// ══════════════════════════════════════════════════════
// COMUNICACIÓN CON SUPABASE
// ══════════════════════════════════════════════════════
function showLoader(show) {
  if(show) $('loader').classList.add('show');
  else $('loader').classList.remove('show');
}

async function fetchData() {
  showLoader(true);
  try {
    const { data: gastosData, error: errG } = await supabaseClient.from('gastos').select('*').eq('usuario', ME);
    const { data: ingresosData, error: errI } = await supabaseClient.from('ingresos').select('*').eq('usuario', ME);

    if (errG || errI) throw new Error("Error leyendo base de datos");

    DB_GASTOS = gastosData || [];
    
    DB_INGRESOS = {};
    (ingresosData || []).forEach(i => {
      DB_INGRESOS[`${i.mes}_${i.periodo}`] = Number(i.monto);
    });

    await handleMonthChange(); // Lanza el motor de clonación al iniciar
  } catch(e) {
    alert('Error de conexión a internet o Supabase.');
    console.error(e);
  }
  showLoader(false);
}

// ══════════════════════════════════════════════════════
// EL MOTOR DE CLONACIÓN (AUTOMATIZACIÓN)
// ══════════════════════════════════════════════════════
async function runCloningEngine(currentMonth) {
  if (!ME) return;
  
  // Calcular el mes anterior (ej. si es 2026-04, sacar 2026-03)
  const [y, m] = currentMonth.split('-');
  const prevDate = new Date(y, parseInt(m) - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

  const currentExps = DB_GASTOS.filter(e => e.mes === currentMonth);
  const prevExps = DB_GASTOS.filter(e => e.mes === prevMonth);

  let toClone = [];

  prevExps.forEach(prevExp => {
    let shouldClone = false;
    let newCuotaActual = prevExp.cuota_actual;

    // Lógica para Cuotas (Avanza +1 si no ha terminado)
    if (prevExp.tiene_cuota && prevExp.cuota_actual < prevExp.cuota_total) {
      shouldClone = true;
      newCuotaActual++;
    } 
    // Lógica para Gastos Fijos (no tienen cuota)
    else if (!prevExp.tiene_cuota) {
      shouldClone = true;
    }

    if (shouldClone) {
      // Evitar duplicados si ya existe un gasto con el mismo nombre y periodo en este mes
      const alreadyExists = currentExps.some(c => c.nombre.toLowerCase() === prevExp.nombre.toLowerCase() && c.periodo === prevExp.periodo);
      
      if (!alreadyExists) {
        toClone.push({
          usuario: ME,
          nombre: prevExp.nombre,
          monto: prevExp.monto,
          periodo: prevExp.periodo,
          mes: currentMonth,
          estado: 'pending', // Siempre se clona como pendiente
          monto_pagado: 0,
          tiene_cuota: prevExp.tiene_cuota,
          cuota_actual: newCuotaActual,
          cuota_total: prevExp.cuota_total
        });
      }
    }
  });

  if (toClone.length > 0) {
    showLoader(true);
    const { data, error } = await supabaseClient.from('gastos').insert(toClone).select();
    if (!error && data) {
      DB_GASTOS.push(...data);
    }
    showLoader(false);
  }
}

async function handleMonthChange() {
  const m = selMonth();
  if(!m) return;
  await runCloningEngine(m);
  renderAll();
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
function $(id){ return document.getElementById(id); }
const MES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function mkKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function keyLabel(k){ const [y,m]=k.split('-'); return `${MES[+m-1]} ${y}`; }
function fmt(n){ return '$'+Math.abs(n).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function selMonth(){ return $('sel-month').value; }

function buildMonthSels(){
  const now=new Date(), cur=mkKey(now);
  const ids=['sel-month','f-month','fi-month'];
  ids.forEach(id=>{
    const s=$(id); s.innerHTML='';
    for(let i=-14;i<=6;i++){
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      const k=mkKey(d);
      const o=document.createElement('option');
      o.value=k; o.textContent=keyLabel(k);
      s.appendChild(o);
    }
    s.value=cur;
  });
}

// ══════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════
let curTab='resumen', curFilter='all';

function goTab(el){
  document.querySelectorAll('#nav-chips .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  activateTab(el.dataset.t);
  document.querySelectorAll('.ni').forEach(n=>n.classList.toggle('on',n.dataset.n===el.dataset.t));
}
function goTab2(el){
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  el.classList.add('on');
  activateTab(el.dataset.n);
  document.querySelectorAll('#nav-chips .chip').forEach(c=>c.classList.toggle('on',c.dataset.t===el.dataset.n));
}
function activateTab(t){
  curTab=t;
  ['resumen','gastos','historial','ajustes'].forEach(x=>$(('t-'+x)).style.display=x===t?'':'none');
  $('fab').style.display=(t==='resumen'||t==='gastos')?'':'none';
  renderAll();
}
function setFilter(el){
  document.querySelectorAll('#filter-chips .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  curFilter=el.dataset.f;
  renderGastos();
}

// ══════════════════════════════════════════════════════
// DATA CALCS
// ══════════════════════════════════════════════════════
function getInc(month,period){ return DB_INGRESOS[`${month}_${period}`]||0; }
function getExps(month){ return DB_GASTOS.filter(e=>e.mes===month); }

function calcPeriod(month,period){
  const income=getInc(month,period);
  const exps=getExps(month).filter(e=>e.periodo===period);
  let totalGasto=0;
  exps.forEach(e=>{
    if(e.estado==='paid') totalGasto += Number(e.monto);
    else if(e.estado==='partial') totalGasto += Number(e.monto_pagado||0);
    else totalGasto += Number(e.monto); 
  });
  return { income, totalGasto, balance:income-totalGasto, exps };
}

// ══════════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════════
function renderAll(){
  const m=selMonth();
  if(!m) return;
  if(curTab==='resumen'){ renderResumen(m); }
  if(curTab==='gastos')  { renderGastos(); }
  if(curTab==='historial'){ renderHistorial(); }
}

// ══════════════════════════════════════════════════════
// RESUMEN (DISEÑO SEPARADO)
// ══════════════════════════════════════════════════════
function renderResumen(month){
  const q = calcPeriod(month,'quincenal');
  const m = calcPeriod(month,'mensual');

  function renderSection(title, data, periodId) {
    const b = data.balance;
    const pos = b >= 0;
    const expsHtml = data.exps.length ? data.exps.map(expRowHTML).join('') : `<div style="text-align:center;color:var(--t3);font-size:12px;padding:10px">No hay gastos aquí</div>`;
    
    return `
      <div class="hero ${pos?'positive':'negative'}">
        <div class="hero-glow"></div>
        <div class="hero-label">${title}</div>
        <div class="hero-grid" onclick="openIncFor('${periodId}')" style="cursor:pointer">
          <div class="hg-item"><div class="hg-l">📥 Ingresos (toca para editar)</div><div class="hg-v pos">${fmt(data.income)}</div></div>
          <div class="hg-item"><div class="hg-l">💸 Total gastos</div><div class="hg-v neg">${fmt(data.totalGasto)}</div></div>
        </div>
        <hr class="hero-divider">
        <div class="hero-result">
          <span class="hr-label">${pos?'✅ Sobrante':'🔴 Faltante'}</span>
          <span class="hr-value ${pos?'pos':'neg'}">${pos?'+':'-'}${fmt(b)}</span>
        </div>
      </div>
      <div class="sh"><h3>Gastos de ${title.toLowerCase()}</h3></div>
      <div class="exp-list">${expsHtml}</div>
      <div style="height:20px"></div>
    `;
  }

  let html = '';
  html += renderSection('📅 Fin de Mes', m, 'mensual');
  html += renderSection('🌙 Quincena', q, 'quincenal');

  $('r-balance').innerHTML = html;
  $('r-incomes').innerHTML = ''; // Limpiamos ingresos arriba porque ahora están integrados
  $('r-explist').innerHTML = ''; // Limpiamos la lista general
  $('r-exp-count').textContent = '';
}

// ══════════════════════════════════════════════════════
// GASTOS TAB
// ══════════════════════════════════════════════════════
function renderGastos(){
  const month=selMonth();
  let exps=getExps(month);
  if(curFilter==='pending')   exps=exps.filter(e=>e.estado==='pending');
  else if(curFilter==='paid')     exps=exps.filter(e=>e.estado==='paid');
  else if(curFilter==='partial')  exps=exps.filter(e=>e.estado==='partial');
  else if(curFilter==='quincenal')exps=exps.filter(e=>e.periodo==='quincenal');
  else if(curFilter==='mensual')  exps=exps.filter(e=>e.periodo==='mensual');
  else if(curFilter==='cuotas')   exps=exps.filter(e=>e.tiene_cuota);
  $('g-explist').innerHTML=exps.length ? exps.map(expRowHTML).join('') : `<div class="empty"><div class="empty-ico">🔍</div><p>Nada en este filtro</p></div>`;
}

function expRowHTML(e){
  let ico='📦', bg='#181818';
  const n = e.nombre.toLowerCase();
  if(n.includes('arriendo')||n.includes('alquiler')){ ico='🏠'; bg='#0d2030';}
  else if(n.includes('agua')||n.includes('luz')||n.includes('internet')){ ico='💡'; bg='#0a1230';}
  else if(n.includes('carro')||n.includes('gas')||n.includes('bus')){ ico='🚗'; bg='#1f1a08';}
  else if(n.includes('mercado')||n.includes('comida')){ ico='🍔'; bg='#2a1010';}
  else if(n.includes('mel')||n.includes('yoma')||n.includes('prestamo')){ ico='💳'; bg='#1a0830';}

  const badge=e.estado==='paid'?'<span class="badge b-paid">✓ Pagado</span>':
               e.estado==='partial'?'<span class="badge b-partial">◑ Parcial</span>':
               '<span class="badge b-pending">⏳ Pendiente</span>';
  
  let cuotaHTML='';
  if(e.tiene_cuota && e.cuota_total>0){
    const pct=Math.min(100,Math.round((e.cuota_actual/e.cuota_total)*100));
    cuotaHTML=`<div style="margin-top:5px"><div style="font-size:10px;color:var(--purple);font-weight:700">Cuota ${e.cuota_actual}/${e.cuota_total}</div>
      <div class="cuota-bar"><div class="cuota-fill" style="width:${pct}%"></div></div></div>`;
  }
  
  let amtHTML='';
  const amtColor=e.estado==='paid'?'var(--accent)':e.estado==='partial'?'var(--warn)':'var(--danger)';
  if(e.estado==='partial'){
    amtHTML=`<div class="exp-amt" style="color:${amtColor}">${fmt(e.monto_pagado||0)}</div>
             <div style="font-size:10px;color:var(--t2);font-weight:600;margin-top:1px">de ${fmt(e.monto)}</div>`;
  } else {
    amtHTML=`<div class="exp-amt" style="color:${amtColor}">${fmt(e.monto)}</div>`;
  }

  // Quick Actions (Botones rápidos)
  const quickActions = `
    <div class="quick-actions" onclick="event.stopPropagation()">
      <button class="q-btn paid" onclick="quickStatus('${e.id}', 'paid')">✓ Pagar</button>
      <button class="q-btn partial" onclick="quickStatus('${e.id}', 'partial')">◑ Parcial</button>
      <button class="q-btn pending" onclick="quickStatus('${e.id}', 'pending')">⏳ Pend.</button>
    </div>`;

  return `<div class="exp-row" onclick="openEditExp('${e.id}')">
    <div class="exp-ico" style="background:${bg}">${ico}</div>
    <div class="exp-mid">
      <div class="exp-name">${e.nombre}</div>
      ${badge}
      ${cuotaHTML}
      ${quickActions}
    </div>
    <div class="exp-right">${amtHTML}</div>
  </div>`;
}

// ══════════════════════════════════════════════════════
// QUICK ACTIONS (BOTONES EN LISTA)
// ══════════════════════════════════════════════════════
window.quickStatus = async function(id, status) {
  if(status === 'partial') {
    openEditExp(id);
    selStatus('partial');
    return;
  }
  
  const exp = DB_GASTOS.find(e => e.id === id);
  if(!exp) return;
  
  // Actualizar UI al instante
  exp.estado = status;
  exp.monto_pagado = status === 'paid' ? exp.monto : 0;
  renderAll();

  // Guardar en la nube
  try {
    await supabaseClient.from('gastos').update({
      estado: status,
      monto_pagado: exp.monto_pagado
    }).eq('id', id);
  } catch(e) { console.error("Error al actualizar rapido", e); }
};

// ══════════════════════════════════════════════════════
// HISTORIAL
// ══════════════════════════════════════════════════════
function renderHistorial(){
  const allMonths=new Set([
    ...DB_GASTOS.map(e=>e.mes),
    ...Object.keys(DB_INGRESOS).map(k=>k.split('_')[0])
  ]);
  const sorted=[...allMonths].sort().reverse();
  const c=$('hist-list');
  if(!sorted.length){ c.innerHTML=`<div class="empty" style="padding-top:30px"><div class="empty-ico">📅</div><p>Sin historial aún</p></div>`; return; }
  
  c.innerHTML=sorted.map(month=>{
    const q=calcPeriod(month,'quincenal');
    const m=calcPeriod(month,'mensual');
    const totInc=q.income+m.income;
    const totGasto=q.totalGasto+m.totalGasto;
    const bal=totInc-totGasto;
    const cnt=getExps(month).length;
    return `<div class="hist-row" onclick="jumpMonth('${month}')">
      <div style="font-size:28px">📆</div>
      <div class="hist-mid">
        <div class="hist-month">${keyLabel(month)}</div>
        <div class="hist-sub">${cnt} gasto${cnt!==1?'s':''} · Ingreso: ${fmt(totInc)}</div>
      </div>
      <div class="hist-bal" style="color:${bal>=0?'var(--accent)':'var(--danger)'}">${bal>=0?'+':'-'}${fmt(bal)}</div>
    </div>`;
  }).join('');
}

function jumpMonth(month){
  $('sel-month').value=month;
  handleMonthChange(); // Corre clonación al saltar
  activateTab('resumen');
  document.querySelectorAll('#nav-chips .chip').forEach(c=>c.classList.toggle('on',c.dataset.t==='resumen'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.toggle('on',n.dataset.n==='resumen'));
}

// ══════════════════════════════════════════════════════
// ADD/EDIT EXPENSE 
// ══════════════════════════════════════════════════════
let editId=null, selSt='paid';

window.openAddExp = function(){
  editId=null; selSt='paid';
  $('sh-exp-title').textContent='Agregar gasto';
  $('f-name').value=''; $('f-amount').value='';
  $('f-period').value='mensual'; $('f-month').value=selMonth();
  $('f-hascuota').checked=false; toggleCuotas();
  $('f-cpaid').value=''; $('f-ctotal').value='';
  $('f-paid').value=''; $('partial-hint').textContent='';
  $('del-exp-btn').style.display='none';
  selStatus('paid'); openOv('ov-exp');
}

window.openEditExp = function(id){
  const e=DB_GASTOS.find(x=>x.id===id);
  if(!e) return;
  editId=id; selSt=e.estado;
  $('sh-exp-title').textContent='Editar gasto';
  $('f-name').value=e.nombre; $('f-amount').value=e.monto;
  $('f-period').value=e.periodo; $('f-month').value=e.mes;
  $('f-hascuota').checked=!!e.tiene_cuota; toggleCuotas();
  $('f-cpaid').value=e.cuota_actual||''; $('f-ctotal').value=e.cuota_total||'';
  $('f-paid').value=e.monto_pagado||'';
  $('del-exp-btn').style.display='';
  selStatus(e.estado); onPaidChange(); openOv('ov-exp');
}

window.selStatus = function(s){
  selSt=s;
  ['paid','pending','partial'].forEach(x=>{
    const el=$(`so-${x}`);
    if(el) {
      el.className='st-opt';
      if(x===s) el.classList.add(`st-${x}`);
    }
  });
  if($('partial-sect')) $('partial-sect').style.display = s==='partial'?'':'none';
}

window.toggleCuotas = function(){
  const on=$('f-hascuota').checked;
  $('cuota-sect').style.display=on?'':'none';
  if(on) updateCuotaHint();
}

function updateCuotaHint(){
  const p=+$('f-cpaid').value||0, t=+$('f-ctotal').value||0;
  $('cuota-hint').textContent= t>0 ? `Cuota ${p} de ${t} · Faltan ${Math.max(0,t-p)} cuotas` : '';
}

window.onAmtChange = function(){ if(selSt==='partial') onPaidChange(); }
window.onPaidChange = function(){
  const total=+$('f-amount').value||0;
  const paid=+$('f-paid').value||0;
  const left=total-paid;
  $('partial-hint').textContent = total>0 ? (left>=0?`Aún debes: $${left.toFixed(2)}`:'El pago supera el total') : '';
}

window.saveExp = async function(){
  const name=$('f-name').value.trim();
  const amount=+$('f-amount').value;
  if(!name||!amount||amount<=0){ alert('Ingresa nombre y monto'); return; }

  const btn = $('btn-save-exp'); btn.textContent = 'Guardando...'; btn.disabled = true;

  const obj = {
    usuario: ME,
    nombre: name,
    monto: amount,
    periodo: $('f-period').value,
    mes: $('f-month').value,
    estado: selSt,
    monto_pagado: selSt==='partial'?(+$('f-paid').value||0): (selSt==='paid'?amount:0),
    tiene_cuota: $('f-hascuota').checked,
    cuota_actual: +$('f-cpaid').value||0,
    cuota_total: +$('f-ctotal').value||0
  };

  if(editId) obj.id = editId;

  try {
    const { data, error } = await supabaseClient.from('gastos').upsert(obj).select().single();
    if(error) throw error;
    
    if(editId) {
      const idx = DB_GASTOS.findIndex(e=>e.id===editId);
      if(idx!==-1) DB_GASTOS[idx] = data;
    } else {
      DB_GASTOS.push(data);
    }
    closeOv('ov-exp'); 
    renderAll();
  } catch(e) {
    alert('Error al guardar en la nube');
    console.error(e);
  } finally {
    btn.textContent = 'Guardar'; btn.disabled = false;
  }
}

window.delExp = async function(){
  if(!confirm('¿Seguro que deseas eliminar este registro?')) return;
  showLoader(true);
  try {
    const { error } = await supabaseClient.from('gastos').delete().eq('id', editId);
    if(error) throw error;
    DB_GASTOS = DB_GASTOS.filter(e=>e.id!==editId);
    closeOv('ov-exp'); renderAll();
  } catch(e) {
    alert('Error al eliminar'); console.error(e);
  }
  showLoader(false);
}

// ══════════════════════════════════════════════════════
// INCOME MODAL (CON CORRECCIÓN DEL 406)
// ══════════════════════════════════════════════════════
window.openIncFor = function(period){
  const m=selMonth();
  $('fi-period').value=period;
  $('fi-month').value=m;
  $('fi-amount').value=DB_INGRESOS[`${m}_${period}`]||'';
  $('sh-inc-title').textContent=period==='mensual'?'📅 Ingresos Fin de mes':'🌙 Ingresos Quincena';
  openOv('ov-inc');
}

window.saveInc = async function(){
  const p=$('fi-period').value, m=$('fi-month').value;
  const a=+$('fi-amount').value||0;

  const btn = $('btn-save-inc'); btn.textContent = 'Guardando...'; btn.disabled = true;

  try {
    // maybeSingle() evita el error 406 si no encuentra datos previos
    const { data: existing } = await supabaseClient.from('ingresos')
      .select('id').eq('usuario', ME).eq('mes', m).eq('periodo', p).maybeSingle();

    const obj = { usuario: ME, mes: m, periodo: p, monto: a };
    if (existing) obj.id = existing.id;

    const { error } = await supabaseClient.from('ingresos').upsert(obj);
    if(error) throw error;

    DB_INGRESOS[`${m}_${p}`] = a;
    closeOv('ov-inc'); renderAll();
  } catch(e) {
    alert('Error al guardar ingreso'); console.error(e);
  } finally {
    btn.textContent = 'Guardar'; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
// UI MODALS EVENT LISTENERS Y STARTUP
// ══════════════════════════════════════════════════════
window.openOv = function(id){ $(id).classList.add('open'); }
window.closeOv = function(id){ $(id).classList.remove('open'); }

document.querySelectorAll('.overlay').forEach(o=>{
  o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); });
});
document.querySelectorAll('.sheet').forEach(sh=>{
  let sy=0;
  sh.addEventListener('touchstart',e=>sy=e.touches[0].clientY,{passive:true});
  sh.addEventListener('touchend',e=>{ if(e.changedTouches[0].clientY-sy>70) sh.closest('.overlay').classList.remove('open'); },{passive:true});
});

// EVENT LISTENERS DEL LOGIN
if($('li-pass')) $('li-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
if($('li-user')) $('li-user').addEventListener('keydown',e=>{ if(e.key==='Enter') $('li-pass').focus(); });
if($('f-cpaid')) $('f-cpaid').addEventListener('input',updateCuotaHint);
if($('f-ctotal')) $('f-ctotal').addEventListener('input',updateCuotaHint);

// STARTUP DEL UI
buildMonthSels();
