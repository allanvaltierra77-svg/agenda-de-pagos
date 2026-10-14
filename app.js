/*
 * Mi Agenda de Pagos — MVP de demostración.
 * No hay claves privadas en este archivo. La conexión con Supabase se añade
 * después de configurar URL + anon/publishable key y políticas RLS.
 */
const SUPABASE_URL = ""; // Añadir en la fase de conexión
const SUPABASE_ANON_KEY = ""; // Solo clave publicable/anon; nunca service_role

const $ = (id) => document.getElementById(id);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const dateFromISO = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d,12); };
const isoFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDaysISO = (iso,n) => { const d=dateFromISO(iso); d.setDate(d.getDate()+n); return isoFromDate(d); };
const money = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n)||0);
const formatDate = (s) => s ? dateFromISO(s).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"}) : "—";
const monthLabel = (d) => d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
const escapeHTML = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initialPayments = [
  {id:"demo-1",name:"Tarjeta Banorte",amount:1500,due_date:todayISO(),frequency:"monthly",category:"Tarjeta",provider:"Banorte",notes:"Ejemplo de demostración",status:"pending",paid_at:null,paid_amount:null},
  {id:"demo-2",name:"Pago de servicio",amount:780,due_date:addDaysISO(todayISO(),2),frequency:"monthly",category:"Servicio",provider:"Proveedor de ejemplo",notes:"",status:"pending",paid_at:null,paid_amount:null},
  {id:"demo-3",name:"Pago quincenal",amount:1200,due_date:addDaysISO(todayISO(),5),frequency:"biweekly",category:"Personal",provider:"",notes:"Ejemplo de demostración",status:"pending",paid_at:null,paid_amount:null},
  {id:"demo-4",name:"Pago realizado de ejemplo",amount:500,due_date:addDaysISO(todayISO(),-3),frequency:"once",category:"Otro",provider:"",notes:"Registro de prueba",status:"paid",paid_at:addDaysISO(todayISO(),-3),paid_amount:500}
];
let payments = loadPayments();
let calendarCursor = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedDay = todayISO();
let statusChart = null;

function loadPayments(){
  try { const raw=localStorage.getItem("miAgendaPagos.demo.v1"); if(raw) return JSON.parse(raw); } catch(e){}
  return structuredClone(initialPayments);
}
function savePayments(){ localStorage.setItem("miAgendaPagos.demo.v1",JSON.stringify(payments)); }
function isPaid(p){ return p.status==="paid"; }
function statusOf(p){
  if(isPaid(p)) return "paid";
  return p.due_date < todayISO() ? "overdue" : "pending";
}
function statusLabel(p){ return ({paid:"Pagado",overdue:"Vencido",pending:"Pendiente"})[statusOf(p)]; }
function frequencyLabel(f){ return ({once:"Una sola vez",biweekly:"Quincenal",monthly:"Mensual",custom:"Personalizada"})[f] || f; }
function iconFor(p){ return ({Tarjeta:"▣",Servicio:"⌂",Préstamo:"↗",Cuenta:"▤",Personal:"◷",Otro:"•"})[p.category] || "•"; }
function showToast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>t.classList.remove("show"),2600); }

function render(){
  renderStats(); renderUpcoming(); renderTable(); renderHistory(); renderCalendar(); renderChart();
  $("today-label").textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
  $("month-chip").textContent=monthLabel(new Date());
}
function renderStats(){
  const active=payments.filter(p=>!isPaid(p));
  const paidThisMonth=payments.filter(p=>isPaid(p)&&p.paid_at&&p.paid_at.slice(0,7)===todayISO().slice(0,7));
  const overdue=active.filter(p=>statusOf(p)==="overdue");
  const upcoming=active.filter(p=>p.due_date>=todayISO()).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  $("total-pending").textContent=money(active.reduce((s,p)=>s+Number(p.amount||0),0));
  $("pending-count").textContent=`${active.length} ${active.length===1?"pago pendiente":"pagos pendientes"}`;
  $("overdue-count").textContent=overdue.length;
  $("total-paid").textContent=money(paidThisMonth.reduce((s,p)=>s+Number(p.paid_amount ?? p.amount),0));
  $("paid-count").textContent=`${paidThisMonth.length} ${paidThisMonth.length===1?"pago realizado":"pagos realizados"}`;
  $("next-due").textContent=upcoming.length?formatDate(upcoming[0].due_date):"—";
  $("next-due-name").textContent=upcoming.length?upcoming[0].name:"Sin pagos próximos";
}
function paymentRow(p){
  return `<div class="payment-row"><div class="payment-icon">${iconFor(p)}</div><div class="payment-info"><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.provider||p.category)} · ${formatDate(p.due_date)}</small></div><div class="payment-amount">${money(p.amount)}<small><span class="pill pill-${statusOf(p)}">${statusLabel(p)}</span></small></div></div>`;
}
function renderUpcoming(){
  const list=payments.filter(p=>!isPaid(p)&&p.due_date>=todayISO()&&p.due_date<=addDaysISO(todayISO(),7)).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  $("upcoming-list").innerHTML=list.length?list.map(paymentRow).join(""):'<div class="empty-state">No hay pagos próximos en los siguientes 7 días.</div>';
}
function renderTable(){
  const q=($("payment-search")?.value||"").toLowerCase();
  const filter=$("status-filter")?.value||"all";
  const filtered=payments.filter(p=>{
    const matches=`${p.name} ${p.provider||""} ${p.category}`.toLowerCase().includes(q);
    const st=statusOf(p); return matches&&(filter==="all"||filter===st);
  }).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  $("payments-table").innerHTML=filtered.length?filtered.map(p=>`<tr><td><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.provider||p.category)}</small></td><td>${formatDate(p.due_date)}</td><td>${frequencyLabel(p.frequency)}</td><td><strong>${money(p.amount)}</strong></td><td><span class="pill pill-${statusOf(p)}">${statusLabel(p)}</span></td><td><div class="table-actions">${!isPaid(p)?`<button class="small-button done" data-action="paid" data-id="${p.id}">Ya pagué</button>`:""}<button class="small-button" data-action="edit" data-id="${p.id}">Editar</button></div></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty-state">No se encontraron pagos.</div></td></tr>';
}
function renderHistory(){
  const history=payments.filter(isPaid).sort((a,b)=>(b.paid_at||"").localeCompare(a.paid_at||""));
  $("history-table").innerHTML=history.length?history.map(p=>`<tr><td><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.provider||p.category)}</small></td><td>${formatDate(p.paid_at)}</td><td><strong>${money(p.paid_amount??p.amount)}</strong></td><td>${escapeHTML(p.notes||"—")}</td></tr>`).join(""):'<tr><td colspan="4"><div class="empty-state">Todavía no hay pagos en el historial.</div></td></tr>';
}
function renderChart(){
  const counts={pending:0,overdue:0,paid:0};
  payments.forEach(p=>counts[statusOf(p)]++);
  const canvas=$("status-chart"); if(!canvas||!window.Chart)return;
  if(statusChart)statusChart.destroy();
  statusChart=new Chart(canvas,{type:"doughnut",data:{labels:["Pendientes","Vencidos","Pagados"],datasets:[{data:[counts.pending,counts.overdue,counts.paid],backgroundColor:["#3157d5","#c43d4b","#2da56b"],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${ctx.label}: ${ctx.raw}`}}}}});
  $("chart-legend").innerHTML=[["Pendientes",counts.pending,"#3157d5"],["Vencidos",counts.overdue,"#c43d4b"],["Pagados",counts.paid,"#2da56b"]].map(([l,n,c])=>`<span><i class="legend-dot" style="background:${c}"></i>${l} (${n})</span>`).join("");
}
function renderCalendar(){
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
  $("calendar-month").textContent=monthLabel(calendarCursor);
  const first=new Date(year,month,1),offset=(first.getDay()+6)%7,days=new Date(year,month+1,0).getDate();
  const weekdays=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  let html=weekdays.map(d=>`<div class="calendar-cell weekday">${d}</div>`).join("");
  for(let i=0;i<offset;i++)html+='<div class="calendar-cell"></div>';
  for(let day=1;day<=days;day++){
    const iso=isoFromDate(new Date(year,month,day));
    const dayPayments=payments.filter(p=>p.due_date===iso&&!isPaid(p));
    const overdue=dayPayments.some(p=>statusOf(p)==="overdue");
    html+=`<button class="calendar-cell day ${dayPayments.length?"has-payments":""} ${overdue?"overdue-day":""} ${selectedDay===iso?"selected":""}" data-day="${iso}"><span class="day-num">${day}</span></button>`;
  }
  $("calendar-grid").innerHTML=html;
  const dayItems=payments.filter(p=>p.due_date===selectedDay).sort((a,b)=>a.name.localeCompare(b.name));
  $("selected-day-payments").innerHTML=`<strong>${formatDate(selectedDay)}</strong> · ${dayItems.length?dayItems.map(p=>`${escapeHTML(p.name)} (${money(p.amount)} · ${statusLabel(p)})`).join(" &nbsp; · &nbsp; "):"No hay pagos registrados para este día."}`;
}
function openPayment(p=null){
  $("payment-form").reset();
  $("payment-id").value=p?.id||"";
  $("dialog-title").textContent=p?"Editar pago":"Agregar pago";
  $("payment-name").value=p?.name||"";
  $("payment-amount").value=p?.amount??"";
  $("payment-due").value=p?.due_date||todayISO();
  $("payment-category").value=p?.category||"Tarjeta";
  $("payment-frequency").value=p?.frequency||"once";
  $("payment-provider").value=p?.provider||"";
  $("payment-notes").value=p?.notes||"";
  $("payment-dialog").showModal();
}
function markPaid(id){
  const p=payments.find(x=>x.id===id); if(!p)return;
  p.status="paid";p.paid_at=todayISO();p.paid_amount=Number(p.amount);
  savePayments();render();showToast("Pago marcado como realizado.");
}
function setView(view){
  document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));
  $(`${view}-view`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  $("page-title").textContent=({dashboard:"Resumen de pagos",payments:"Todos los pagos",history:"Historial de pagos",settings:"Configuración"})[view];
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.go)));
$("add-payment-top").addEventListener("click",()=>openPayment());
$("add-payment-list").addEventListener("click",()=>openPayment());
$("close-dialog").addEventListener("click",()=>$("payment-dialog").close());
$("cancel-dialog").addEventListener("click",()=>$("payment-dialog").close());
$("payment-form").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("payment-id").value;
  const existing=payments.find(p=>p.id===id);
  const p={...(existing||{}),id:id||`local-${Date.now()}`,name:$("payment-name").value.trim(),amount:Number($("payment-amount").value),due_date:$("payment-due").value,category:$("payment-category").value,frequency:$("payment-frequency").value,provider:$("payment-provider").value.trim(),notes:$("payment-notes").value.trim(),status:existing?.status==="paid"?"paid":"pending",paid_at:existing?.paid_at||null,paid_amount:existing?.paid_amount??null};
  if(existing)payments=payments.map(x=>x.id===id?p:x);else payments.push(p);
  savePayments();$("payment-dialog").close();render();showToast(existing?"Pago actualizado.":"Pago agregado.");
});
$("payments-table").addEventListener("click",e=>{
  const b=e.target.closest("button[data-action]");if(!b)return;
  const p=payments.find(x=>x.id===b.dataset.id);if(!p)return;
  if(b.dataset.action==="paid")markPaid(p.id);
  if(b.dataset.action==="edit")openPayment(p);
});
$("payment-search").addEventListener("input",renderTable);
$("status-filter").addEventListener("change",renderTable);
$("prev-month").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();});
$("next-month").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();});
$("calendar-grid").addEventListener("click",e=>{const b=e.target.closest("[data-day]");if(b){selectedDay=b.dataset.day;renderCalendar();}});
$("reset-demo").addEventListener("click",()=>{if(confirm("¿Restablecer los datos de demostración? Esto reemplaza los cambios guardados en este navegador.")){payments=structuredClone(initialPayments);savePayments();render();showToast("Datos de ejemplo restablecidos.");}});
$("export-history").addEventListener("click",()=>{
  const rows=[["Pago","Fecha de pago","Importe pagado MXN","Notas"],...payments.filter(isPaid).map(p=>[p.name,p.paid_at||"",p.paid_amount??p.amount,p.notes||""])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="historial-pagos.csv";a.click();URL.revokeObjectURL(url);
});
render();
