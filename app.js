/* Mi Agenda de Pagos — Supabase */
const SUPABASE_URL = "https://qhckcpwrwhnwcifkvoky.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xdDO-CUO9HIlJHys-zlvOA_tS_deI_T";
const HOUSEHOLD_ID = "edd056fc-32ae-49c0-91e4-f3d705375146";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateFromISO = s => { if(!s)return new Date(); const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d,12); };
const isoFromDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDaysISO = (iso,n) => { const d=dateFromISO(iso); d.setDate(d.getDate()+n); return isoFromDate(d); };
const money = n => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n)||0);
const formatDate = s => s ? dateFromISO(s).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"}) : "—";
const monthLabel = d => d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
const escapeHTML = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let payments=[], history=[], currentUser=null, calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDay=todayISO(), statusChart=null;

function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("show"),2800);}
function authMessage(msg,isError=true){const el=$("auth-message");el.textContent=msg;el.classList.toggle("error",isError);}
function isPaid(p){return p.status==="paid";}
function statusOf(p){if(isPaid(p))return "paid";return p.due_date<todayISO()?"overdue":"pending";}
function statusLabel(p){return ({paid:"Pagado",overdue:"Vencido",pending:"Pendiente"})[statusOf(p)];}
function frequencyLabel(f){return ({once:"Una sola vez",biweekly:"Quincenal",monthly:"Mensual",custom:"Personalizada"})[f]||f;}
function iconFor(p){return ({Tarjeta:"▣",Servicio:"⌂",Préstamo:"↗",Cuenta:"▤",Personal:"◷",Otro:"•"})[p.category]||"•";}

async function loadData(){
  const {data: member, error: memberError}=await sb.from("household_members").select("household_id,role").eq("household_id",HOUSEHOLD_ID).eq("user_id",currentUser.id).maybeSingle();
  if(memberError) throw memberError;
  if(!member){throw new Error("Tu usuario inició sesión, pero no tiene acceso a esta agenda. Verifica household_members.");}
  const [{data:payData,error:payError},{data:histData,error:histError}]=await Promise.all([
    sb.from("payments").select("*").eq("household_id",HOUSEHOLD_ID).order("due_date"),
    sb.from("payment_history").select("*").eq("household_id",HOUSEHOLD_ID).order("paid_at",{ascending:false})
  ]);
  if(payError)throw payError;if(histError)throw histError;
  payments=(payData||[]).map(p=>({...p,paid_at:null,paid_amount:null}));
  history=histData||[];
  const paidIds=new Set(history.map(h=>h.payment_id));
  payments=payments.map(p=>({...p,status:p.status==="paid"||paidIds.has(p.id)?"paid":"pending"}));
  render();
  $("settings-household").textContent=`Agenda: Agenda familiar de pagos · Rol: ${member.role}`;
}
async function refresh(){try{await loadData();}catch(e){console.error(e);showToast("No se pudieron cargar los datos: "+(e.message||"Error"));}}

function render(){
 renderStats();renderUpcoming();renderTable();renderHistory();renderCalendar();renderChart();
 $("today-label").textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
 $("month-chip").textContent=monthLabel(new Date());
}
function renderStats(){
 const active=payments.filter(p=>!isPaid(p)),paidThisMonth=history.filter(h=>h.paid_at&&h.paid_at.slice(0,7)===todayISO().slice(0,7)),overdue=active.filter(p=>statusOf(p)==="overdue"),upcoming=active.filter(p=>p.due_date>=todayISO()).sort((a,b)=>a.due_date.localeCompare(b.due_date));
 $("total-pending").textContent=money(active.reduce((s,p)=>s+Number(p.amount||0),0));$("pending-count").textContent=`${active.length} ${active.length===1?"pago pendiente":"pagos pendientes"}`;$("overdue-count").textContent=overdue.length;
 $("total-paid").textContent=money(paidThisMonth.reduce((s,h)=>s+Number(h.amount_paid||0),0));$("paid-count").textContent=`${paidThisMonth.length} ${paidThisMonth.length===1?"pago realizado":"pagos realizados"}`;$("next-due").textContent=upcoming.length?formatDate(upcoming[0].due_date):"—";$("next-due-name").textContent=upcoming.length?upcoming[0].name:"Sin pagos próximos";
}
function paymentRow(p){return `<div class="payment-row"><div class="payment-icon">${iconFor(p)}</div><div class="payment-info"><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.provider||p.category)} · ${formatDate(p.due_date)}</small></div><div class="payment-amount">${money(p.amount)}<small><span class="pill pill-${statusOf(p)}">${statusLabel(p)}</span></small></div></div>`;}
function renderUpcoming(){const list=payments.filter(p=>!isPaid(p)&&p.due_date>=todayISO()&&p.due_date<=addDaysISO(todayISO(),7)).sort((a,b)=>a.due_date.localeCompare(b.due_date));$("upcoming-list").innerHTML=list.length?list.map(paymentRow).join(""):'<div class="empty-state">No hay pagos próximos en los siguientes 7 días.</div>';}
function renderTable(){
 const q=($("payment-search").value||"").toLowerCase(),filter=$("status-filter").value;
 const filtered=payments.filter(p=>`${p.name} ${p.provider||""} ${p.category}`.toLowerCase().includes(q)).filter(p=>filter==="all"||filter===statusOf(p)).sort((a,b)=>a.due_date.localeCompare(b.due_date));
 $("payments-table").innerHTML=filtered.length?filtered.map(p=>`<tr><td><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.provider||p.category)}</small></td><td>${formatDate(p.due_date)}</td><td>${frequencyLabel(p.frequency)}</td><td><strong>${money(p.amount)}</strong></td><td><span class="pill pill-${statusOf(p)}">${statusLabel(p)}</span></td><td><div class="table-actions">${!isPaid(p)?`<button class="small-button done" data-action="paid" data-id="${p.id}">Ya pagué</button>`:""}<button class="small-button" data-action="edit" data-id="${p.id}">Editar</button></div></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty-state">No se encontraron pagos.</div></td></tr>';
}
function renderHistory(){
 const sorted=[...history].sort((a,b)=>(b.paid_at||"").localeCompare(a.paid_at||""));
 $("history-table").innerHTML=sorted.length?sorted.map(h=>{const p=payments.find(x=>x.id===h.payment_id);return `<tr><td><strong>${escapeHTML(p?.name||"Pago")}</strong><small>${escapeHTML(p?.provider||p?.category||"")}</small></td><td>${formatDate(h.paid_at)}</td><td><strong>${money(h.amount_paid)}</strong></td><td>${escapeHTML(h.note||"—")}</td></tr>`;}).join(""):'<tr><td colspan="4"><div class="empty-state">Todavía no hay pagos registrados en el historial.</div></td></tr>';
}
function renderChart(){
 const counts={pending:0,overdue:0,paid:0};payments.forEach(p=>counts[statusOf(p)]++);
 const canvas=$("status-chart");if(!canvas||!window.Chart)return;if(statusChart)statusChart.destroy();
  statusChart = new Chart(canvas, { type: "doughnut", data: { labels: ["Pendientes", "Vencidos", "Pagados"], datasets: [{ data: [counts.pending, counts.overdue, counts.paid], backgroundColor: ["#3157d5", "#c43d4b", "#2da56b"], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}` } } } } });
$("chart-legend").innerHTML=[["Pendientes",counts.pending,"#3157d5"],["Vencidos",counts.overdue,"#c43d4b"],["Pagados",counts.paid,"#2da56b"]].map(([l,n,c])=>`<span><i class="legend-dot" style="background:${c}"></i>${l} (${n})</span>`).join("");
}
function renderCalendar(){
 const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth(),first=new Date(year,month,1),offset=(first.getDay()+6)%7,days=new Date(year,month+1,0).getDate(),weekdays=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
 $("calendar-month").textContent=monthLabel(calendarCursor);let html=weekdays.map(d=>`<div class="calendar-cell weekday">${d}</div>`).join("");
 for(let i=0;i<offset;i++)html+='<div class="calendar-cell"></div>';
 for(let day=1;day<=days;day++){const iso=isoFromDate(new Date(year,month,day)),dayPayments=payments.filter(p=>p.due_date===iso&&!isPaid(p)),overdue=dayPayments.some(p=>statusOf(p)==="overdue");html+=`<button class="calendar-cell day ${dayPayments.length?"has-payments":""} ${overdue?"overdue-day":""} ${selectedDay===iso?"selected":""}" data-day="${iso}"><span class="day-num">${day}</span></button>`;}
 $("calendar-grid").innerHTML=html;const items=payments.filter(p=>p.due_date===selectedDay).sort((a,b)=>a.name.localeCompare(b.name));
 $("selected-day-payments").innerHTML=`<strong>${formatDate(selectedDay)}</strong> · ${items.length?items.map(p=>`${escapeHTML(p.name)} (${money(p.amount)} · ${statusLabel(p)})`).join(" &nbsp; · &nbsp; "):"No hay pagos registrados para este día."}`;
}
function openPayment(p=null){
 $("payment-form").reset();$("payment-id").value=p?.id||"";$("dialog-title").textContent=p?"Editar pago":"Agregar pago";$("payment-name").value=p?.name||"";$("payment-amount").value=p?.amount??"";$("payment-due").value=p?.due_date||todayISO();$("payment-category").value=p?.category||"Tarjeta";$("payment-frequency").value=p?.frequency||"once";$("payment-provider").value=p?.provider||"";$("payment-notes").value=p?.notes||"";$("payment-dialog").showModal();
}
function openPaid(p){
 $("paid-form").reset();$("paid-payment-id").value=p.id;$("paid-amount").value=p.amount;$("paid-date").value=todayISO();$("paid-note").value="";$("paid-dialog").showModal();
}
async function savePayment(e){
 e.preventDefault();const id=$("payment-id").value;
 const payload={household_id:HOUSEHOLD_ID,name:$("payment-name").value.trim(),amount:Number($("payment-amount").value),due_date:$("payment-due").value,category:$("payment-category").value,frequency:$("payment-frequency").value,provider:$("payment-provider").value.trim()||null,notes:$("payment-notes").value.trim()||null,status:"pending",updated_at:new Date().toISOString()};
 try{
   let result;
   if(id){const existing=payments.find(p=>p.id===id);payload.status=existing?.status==="paid"?"paid":"pending";result=await sb.from("payments").update(payload).eq("id",id).eq("household_id",HOUSEHOLD_ID).select().single();}
   else{payload.created_by=currentUser.id;result=await sb.from("payments").insert(payload).select().single();}
   if(result.error)throw result.error;$("payment-dialog").close();await loadData();showToast(id?"Pago actualizado en la nube.":"Pago guardado en la nube.");
 }catch(err){console.error(err);showToast("No se pudo guardar: "+(err.message||"revisa permisos"));}
}
async function savePaid(e){
 e.preventDefault();const id=$("paid-payment-id").value,p=payments.find(x=>x.id===id);if(!p)return;
 const paidAt=$("paid-date").value,amount=Number($("paid-amount").value),note=$("paid-note").value.trim()||null;
 try{
   const {error:histError}=await sb.from("payment_history").insert({payment_id:id,household_id:HOUSEHOLD_ID,paid_at:paidAt,amount_paid:amount,note,recorded_by:currentUser.id});
   if(histError)throw histError;
   const {error:updateError}=await sb.from("payments").update({status:"paid",updated_at:new Date().toISOString()}).eq("id",id).eq("household_id",HOUSEHOLD_ID);
   if(updateError)throw updateError;
   $("paid-dialog").close();await loadData();showToast("Pago e historial guardados.");
 }catch(err){console.error(err);showToast("No se pudo registrar el pago: "+(err.message||"revisa permisos"));}
}
function setView(view){document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));$(`${view}-view`).classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));$("page-title").textContent=({dashboard:"Resumen de pagos",payments:"Todos los pagos",history:"Historial de pagos",settings:"Configuración"})[view];}
function showApp(user){currentUser=user;$("auth-screen").classList.add("hidden");$("app-shell").classList.remove("hidden");$("user-email").textContent=user.email||"";}
async function signIn(e){e.preventDefault();$("login-button").disabled=true;$("login-button").textContent="Ingresando…";authMessage("",false);
 try{const {data,error}=await sb.auth.signInWithPassword({email:$("login-email").value.trim(),password:$("login-password").value});if(error)throw error;showApp(data.user);await loadData();}
 catch(err){console.error(err);authMessage("No se pudo iniciar sesión o cargar la agenda: "+(err.message||"revisa tus datos"));await sb.auth.signOut();}
 finally{$("login-button").disabled=false;$("login-button").textContent="Iniciar sesión";}
}
async function signOut(){await sb.auth.signOut();currentUser=null;payments=[];history=[];$("app-shell").classList.add("hidden");$("auth-screen").classList.remove("hidden");$("login-password").value="";authMessage("Sesión cerrada.",false);}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.go)));
$("login-form").addEventListener("submit",signIn);$("logout-button").addEventListener("click",signOut);
$("add-payment-top").addEventListener("click",()=>openPayment());$("add-payment-list").addEventListener("click",()=>openPayment());
$("close-dialog").addEventListener("click",()=>$("payment-dialog").close());$("cancel-dialog").addEventListener("click",()=>$("payment-dialog").close());
$("close-paid-dialog").addEventListener("click",()=>$("paid-dialog").close());$("cancel-paid-dialog").addEventListener("click",()=>$("paid-dialog").close());
$("payment-form").addEventListener("submit",savePayment);$("paid-form").addEventListener("submit",savePaid);
$("payments-table").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;const p=payments.find(x=>x.id===b.dataset.id);if(!p)return;if(b.dataset.action==="paid")openPaid(p);if(b.dataset.action==="edit")openPayment(p);});
$("payment-search").addEventListener("input",renderTable);$("status-filter").addEventListener("change",renderTable);
$("prev-month").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();});$("next-month").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();});
$("calendar-grid").addEventListener("click",e=>{const b=e.target.closest("[data-day]");if(b){selectedDay=b.dataset.day;renderCalendar();}});
$("export-history").addEventListener("click",()=>{const rows=[["Pago","Fecha de pago","Importe pagado MXN","Notas"],...history.map(h=>[payments.find(p=>p.id===h.payment_id)?.name||"Pago",h.paid_at,h.amount_paid,h.note||""])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="historial-pagos.csv";a.click();URL.revokeObjectURL(url);});

let recoveryMode = false;

$("forgot-password").addEventListener("click", async () => {
  const email = $("login-email").value.trim();

  if (!email) {
    authMessage("Escribe tu correo electrónico primero.");
    $("login-email").focus();
    return;
  }

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: "https://allanvaltierra77-svg.github.io/agenda-de-pagos/"
    });

    if (error) throw error;

    authMessage("Te enviamos un enlace para cambiar tu contraseña.", false);
  } catch (error) {
    authMessage("No se pudo enviar el correo: " + error.message);
  }
});

$("back-to-login").addEventListener("click", () => {
  $("reset-password-form").classList.add("hidden");
  $("login-form").classList.remove("hidden");
  recoveryMode = false;
});

$("reset-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = $("new-password").value;
  const confirmation = $("confirm-password").value;
  const message = $("reset-message");

  if (password.length < 8) {
    message.textContent = "La contraseña debe tener al menos 8 caracteres.";
    return;
  }

  if (password !== confirmation) {
    message.textContent = "Las contraseñas no coinciden.";
    return;
  }

  try {
    const { error } = await sb.auth.updateUser({ password });

    if (error) throw error;

    message.textContent = "Contraseña actualizada. Ya puedes iniciar sesión.";
    recoveryMode = false;
    await sb.auth.signOut();
    $("reset-password-form").classList.add("hidden");
    $("login-form").classList.remove("hidden");
    $("login-password").value = "";
  } catch (error) {
    message.textContent = "No se pudo cambiar la contraseña: " + error.message;
  }
});

sb.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryMode = true;
    $("login-form").classList.add("hidden");
    $("reset-password-form").classList.remove("hidden");
  }
});
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session?.user){showApp(session.user);await refresh();}})();
