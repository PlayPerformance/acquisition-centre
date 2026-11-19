
/* ================= Config ================= */
const PAGE_URL=location.origin+location.pathname;
const PHONE='1300 08 88 08';
const FIELDS={
  overview:[['year','Year','number'],['make','Make','text'],['model','Model','text'],['badge','Badge','text'],['series','Series','text'],['performanceModel','Performance Model','text'],
    ['bodyType','Body Type','select',['','Sedan','Ute','Wagon','Hatch','Coupe','Convertible','SUV','Cab Chassis','Van','Other']],['colour','Colour','text'],['doors','Doors','number'],['seats','Seats','number'],
    ['transmission','Transmission','select',['','Automatic','Manual']],['driveType','Drive Type','select',['','RWD','FWD','AWD','4WD']],['fuelType','Fuel Type','select',['','Petrol','Diesel','Hybrid','Electric','LPG']],
    ['vin','VIN','text'],['buildDate','Build Date','text','MM/YY'],['complianceDate','Compliance Date','text','MM/YY']],
  condition:[['condition','Condition','select',['','Excellent','Good','Fair','Poor']],['rego','Rego','text'],['regoState','Rego State','select',['','QLD','NSW','VIC','SA','WA','TAS','NT','ACT','Unregistered']],
    ['regoExpiry','Rego Expiry','text','e.g. Nov/2026'],['writtenOff','Previously Written Off','select',['','No','Yes']],['defects','Defects','textarea']],
  engine:[['engineSize','Engine Size','text','e.g. 6.2L V8'],['cylinders','Cylinders','number'],['engineNumber','Engine Number','text'],['engineReplaced','Engine Replaced','select',['','No','Yes']]],
  misc:[['serviceBooks','Log / Service Books','select',['','Yes','No']],['ownersManual',"Owner's Manual",'select',['','Yes','No']],['spareKey','Spare Key','select',['','Yes','No']],
    ['sunroof','Sunroof','select',['','Yes','No']],['leather','Leather','select',['','Yes','No']],['nav','Nav','select',['','Yes','No']],['wheels','Wheels','text'],['tradesmanExtras','Tradesman Extras','text'],
    ['upgrades','Upgrades / Modifications','textarea'],['sportsPack','Sports Pack (AMG, SLine... etc)','text'],['odometerWords','Odometer Words','text'],['odometerReplaced','Odometer Replaced','select',['','No','Yes']]],
};
const SECT={overview:'Overview',condition:'Condition',engine:'Engine',misc:'Misc'};
const ALL=Object.values(FIELDS).flat();
const BASICS=['year','make','model','badge','series','transmission','bodyType','fuelType','colour','rego','regoState'];
const SORTS=[['new','Newest listed'],['plow','Price: low to high'],['phigh','Price: high to low'],['km','Lowest km'],['year','Newest year']];
const STEP_NAMES=['Photos','Price & basics','Details','Review'];
const STAGES=[
  {k:'purchased',label:'Purchased',desc:'Your car is secured and off the market.'},
  {k:'payment',label:'Payment confirmed',desc:'Payment received. Thanks!'},
  {k:'prep',label:'Being prepared',desc:'Final detail, safety check and paperwork.'},
  {k:'transit',label:'On the way',pickup:'Ready soon',desc:'Your car is on the road to you.',pdesc:'Final checks before pickup.'},
  {k:'arriving',label:'Arriving today',pickup:'Ready for pickup',desc:'Delivery is happening today.',pdesc:'Come and grab it! Call ahead on 1300 08 88 08.'},
  {k:'done',label:'Delivered',pickup:'Collected',desc:'Enjoy the drive!',pdesc:'Enjoy the drive!'},
];
const stLabel=(i,pick)=>pick&&STAGES[i].pickup?STAGES[i].pickup:STAGES[i].label;
const stDesc=(i,pick)=>pick&&STAGES[i].pdesc?STAGES[i].pdesc:STAGES[i].desc;
const HQ='Play Performance, QLD';

/* ================= State ================= */
const S={db:null,user:null,assets:null,me:null,uid:null,isAdmin:false,
  vehicles:[],loaded:false,claims:{},mine:{},allBuys:{},profiles:{},saved:[],
  q:'',make:'',body:'',sort:'new',show:24,
  aFilter:'available',aQ:'',draft:null,editingId:null,step:1,uploading:0,selPhoto:-1,loadErr:null,busy:false,noDb:false,threads:{},msgs:[],msgUnsub:null,msgFor:null,chatDraft:'',chatCar:null};
const app=document.getElementById('app');
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
Object.assign(S,LS.get('pp-prefs')||{});

/* ================= Helpers ================= */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(n===''||n==null||isNaN(n)||Number(n)<=0)?'':'$'+Number(n).toLocaleString('en-AU',{maximumFractionDigits:0});
const km=n=>(n===''||n==null||isNaN(n))?'':Number(n).toLocaleString('en-AU')+' km';
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fDate=ms=>{if(!ms)return'';const d=new Date(ms);return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`};
const fTime=ms=>{if(!ms)return'';const d=new Date(ms);return fDate(ms)+', '+d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})};
const ago=ms=>{if(!ms)return'';const s=(Date.now()-ms)/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'};
const newId=()=>'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const img=id=>/^(https?:|\/|stock\/)/.test(id)?id:'stock/'+id;
const vName=v=>[v.year,v.make,v.model].filter(Boolean).join(' ')||'Untitled vehicle';
const vSub=v=>[v.badge,v.series].filter(Boolean).join(' · ');
const inits=n=>(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'•';
const isNew=v=>v.publishedAt&&(Date.now()-v.publishedAt)<3*864e5;
const route=()=>(location.hash||'').replace(/^#/,'');
function go(h){if(route()===h)render();else location.hash=h;window.scrollTo(0,0)}
const link=id=>PAGE_URL+'#v-'+id;
function saleState(v){const c=S.claims[v.id];if(c&&c.buyer)return c.buyer===S.uid?'mine':'sold';if(v.status==='sold')return S.mine[v.id]?.result==='won'?'mine':'sold';if(v.status==='draft'||v.status==='hidden')return'draft';return'available'}
function adminState(v){if(S.claims[v.id]?.buyer||v.status==='sold')return'sold';if(v.status==='draft'||v.status==='hidden')return'draft';return'available'}
function toast(m){document.querySelectorAll('.toast').forEach(t=>t.remove());const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)}
function sheet(html,ready){return new Promise(res=>{const bg=document.createElement('div');bg.className='sheet-bg';bg.innerHTML=`<div class="sheet"><div class="grab"></div>${html}</div>`;
  const close=v=>{bg.remove();document.removeEventListener('keydown',k);res(v)};const k=e=>{if(e.key==='Escape')close(null)};
  bg.addEventListener('click',e=>{if(e.target===bg)close(null);const a=e.target.closest('[data-m]');if(a)close(a.dataset.m)});
  document.addEventListener('keydown',k);document.body.appendChild(bg);ready&&ready(bg.querySelector('.sheet'),close)})}
const confirmSheet=(t,x,ok,danger)=>sheet(`<h3 class="h-x">${t}</h3><p>${esc(x)}</p><div class="row"><button class="btn btn-line" data-m="0">Cancel</button><button class="btn ${danger?'btn-red':'btn-red'}" data-m="1">${esc(ok)}</button></div>`).then(v=>v==='1');
async function copy(text,what){try{await navigator.clipboard.writeText(text);toast((what||'Link')+' copied')}catch(e){sheet(`<h3 class="h-x">Copy ${esc((what||'link').toLowerCase())}</h3><p>Press and hold to copy:</p><div class="linkbox"><input class="inp" readonly value="${esc(text)}"></div><div class="row"><button class="btn btn-red" data-m="1">Done</button></div>`,s=>{const i=s.querySelector('input');i.focus();i.select()})}}
async function share(id){const v=S.vehicles.find(x=>x.id===id);const url=link(id);
  try{if(navigator.share){await navigator.share({title:vName(v||{}),text:`${vName(v||{})} ${money(v?.price)}`,url});return}}catch(e){if(e?.name==='AbortError')return}
  copy(url,'Link')}

/* ================= Icons ================= */
const I={
 odo:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 34a18 18 0 1 1 36 0"/><path d="M6 34h36"/><path d="M24 34l7-10"/><circle cx="24" cy="34" r="2.5" fill="currentColor"/></svg>',
 body:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M8 26l4-10h24l4 10"/><rect x="6" y="26" width="36" height="10" rx="2"/><path d="M10 36v4h6v-4M32 36v4h6v-4"/></svg>',
 trans:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="24" cy="24" r="19"/><path d="M16 15v18M24 15v18M32 15v9M16 24h16"/></svg>',
 eng:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M4 20h4l3 4h14l8-6h3l-9 12H11l-3-4H4z"/><path d="M14 20v-4h6v4"/><path d="M40 26c0 0 3 4 3 6a3 3 0 0 1-6 0c0-2 3-6 3-6z"/></svg>',
 car:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M5 13l2-6h10l2 6"/><rect x="3" y="13" width="18" height="5" rx="1.5"/><path d="M6 18v2M18 18v2"/><circle cx="7.5" cy="15.5" r=".8" fill="currentColor"/><circle cx="16.5" cy="15.5" r=".8" fill="currentColor"/></svg>',
 heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
 heartF:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
 truck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>',
 chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
 sendI:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4l2 7 9 1-9 1z"/></svg>',
 key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>',
 grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
 sort:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>',
 cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>',
 pics:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
 share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
 link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
 expand:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};
const LOGO=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 123 50" fill="none" aria-label="Play Performance"><path d="M71.7053 21.9331H71.8022H71.9908H72.0878H73.8296L73.2783 14.3462L69.7695 21.9331H70.0532H71.7053Z" fill="currentColor"/><path d="M23.8652 32.6092C25.6922 32.5235 27.5044 32.2419 29.2704 31.7692L27.7099 39.7432H67.1782L69.3331 35.0704L69.6743 39.7432H101.615L104.129 25.568L122.124 0H98.5639L97.5978 1.42679L97.1489 0H66.6215L54.6781 21.9886H51.7421L56.0447 0H35.4872L35.1963 1.51418C32.8026 0.508293 29.9743 0 26.7707 0H9.69693L8.98762 3.59194L6.02825 18.7052L1.91245 39.7503H22.4681L23.8652 32.6092ZM21.3404 29.9625L19.9038 37.2748H4.86821L11.6363 2.6895H26.4852C29.6457 2.6895 32.3518 3.22454 34.5283 4.29463C35.3515 4.68809 36.1259 5.17528 36.8358 5.74639L37.4338 2.68414H52.4766L48.1668 24.6709H56.0088L67.9486 2.6895H94.8737L96.4306 7.57089L99.7222 2.6895H116.642L101.279 24.5158L99.02 37.2748H85.2594L87.8919 23.8256L83.2338 11.5195L84.823 23.97L82.2174 37.2748H71.9297L71.549 32.0439H67.4781L65.0574 37.2748H30.6656L32.5996 27.3979C31.9298 27.7747 31.2378 28.1112 30.5274 28.4056C28.0277 29.4364 25.1905 29.9572 22.0875 29.9572L21.3404 29.9625Z" fill="currentColor"/><path d="M109.624 35.37H110.398C110.55 35.37 110.757 35.3932 110.818 35.4948C110.915 35.714 110.954 35.9538 110.933 36.1922C110.929 36.3114 110.936 36.4308 110.953 36.5489C110.969 36.6866 111.009 36.8206 111.071 36.9448L111.15 37.1035H112.7L112.321 36.6416C112.259 36.5481 112.221 36.441 112.21 36.3295C112.173 36.1246 112.156 35.9169 112.158 35.7088C112.162 35.5369 112.139 35.3653 112.089 35.2005C112.047 35.0625 111.974 34.9362 111.874 34.8314L111.834 34.7886L111.863 34.7618C111.98 34.6417 112.072 34.4999 112.134 34.3445C112.207 34.1526 112.242 33.9485 112.237 33.7434C112.237 33.2209 112.018 32.3416 110.592 32.3167H108.335V37.0982H109.624V35.37ZM109.624 33.4884H110.507C110.584 33.4881 110.661 33.4947 110.737 33.508C110.77 33.5125 110.802 33.5254 110.829 33.5455L110.859 33.5651C110.879 33.5772 110.895 33.5945 110.906 33.615C110.931 33.691 110.942 33.7707 110.938 33.8504C110.938 34.1447 110.831 34.2446 110.518 34.2446H109.62L109.624 33.4884Z" fill="currentColor"/><path d="M110.152 39.8019C111.176 39.8019 112.177 39.5003 113.028 38.9353C113.879 38.3704 114.543 37.5673 114.935 36.6278C115.327 35.6882 115.429 34.6544 115.229 33.657C115.03 32.6596 114.537 31.7434 113.813 31.0243C113.088 30.3052 112.166 29.8155 111.162 29.6171C110.157 29.4187 109.117 29.5205 108.171 29.9097C107.225 30.2989 106.416 30.9579 105.847 31.8035C105.278 32.649 104.975 33.6431 104.975 34.6601C104.976 36.0234 105.522 37.3304 106.493 38.2943C107.463 39.2583 108.779 39.8005 110.152 39.8019ZM110.152 30.2014C111.04 30.2014 111.908 30.4629 112.646 30.9528C113.384 31.4427 113.96 32.1391 114.299 32.9538C114.639 33.7685 114.728 34.665 114.555 35.53C114.382 36.3949 113.954 37.1893 113.326 37.8129C112.698 38.4364 111.898 38.8611 111.028 39.0331C110.157 39.2052 109.254 39.1169 108.434 38.7794C107.613 38.4419 106.912 37.8705 106.419 37.1372C105.926 36.404 105.662 35.5419 105.662 34.6601C105.662 33.4776 106.135 32.3435 106.977 31.5073C107.819 30.6711 108.961 30.2014 110.152 30.2014Z" fill="currentColor"/><path d="M24.6176 12.1384H21.9635L20.3581 20.3425L20.324 20.5208H23.1972C24.781 20.5101 26.038 20.1534 26.9359 19.424C27.6772 18.844 28.232 18.0618 28.5323 17.1732C28.6145 16.9316 28.6811 16.6849 28.7316 16.4348C28.9848 15.1383 28.7549 14.0842 28.0582 13.3102C27.392 12.5326 26.232 12.1384 24.6104 12.1384" fill="currentColor"/><path d="M7.92096 42.0083H4.14993V41.9958H1.52816V42.0083L1.12233 44.0611L0.79012 45.7608L0.384286 47.8261L0 49.7808H2.61638L2.99887 47.8189H6.77887C8.49918 47.8189 10.1548 46.5081 10.4691 44.9101C10.7833 43.3121 9.64306 42.0012 7.92096 42.0012M7.85272 44.9101C7.79153 45.1488 7.6528 45.3608 7.45803 45.5133C7.26325 45.6658 7.02328 45.7503 6.77528 45.7537H3.41188L3.74589 44.054H7.12186C7.23122 44.0488 7.34034 44.0685 7.44087 44.1115C7.5414 44.1546 7.63069 44.22 7.7019 44.3026C7.77311 44.3852 7.82437 44.4829 7.85176 44.5881C7.87914 44.6934 7.88193 44.8035 7.8599 44.9101" fill="currentColor"/><path d="M20.4443 43.9505L20.8268 41.9958H14.5005H13.6277H11.8841L10.3577 49.7683L10.3523 49.7915H19.2968L19.3004 49.7683L19.5949 48.2701L19.6847 47.8154H13.3566L13.5433 46.8719H19.4333L19.4351 46.8665H19.8715L20.254 44.9118H18.8156V44.9172H13.9258L14.1162 43.9505H20.4443Z" fill="currentColor"/><path d="M28.3994 42.0083H24.6284V41.9958H22.0067V42.0083L21.6044 44.0611L21.2704 45.7608L20.8646 47.8261L20.4803 49.7879H23.0967L23.4792 47.8261H25.9932L27.0526 49.7879H30.1054L28.597 47.5657C29.7588 47.1109 30.707 46.1014 30.9314 44.9243C31.2475 43.3192 30.1054 42.0155 28.3833 42.0155M28.315 44.9243C28.2533 45.1628 28.1144 45.3744 27.9198 45.5269C27.7251 45.6793 27.4854 45.764 27.2376 45.7679H23.8832L24.2172 44.0683H27.5824C27.6926 44.0613 27.803 44.0798 27.9049 44.1221C28.0068 44.1644 28.0975 44.2295 28.17 44.3124C28.2424 44.3952 28.2947 44.4935 28.3226 44.5996C28.3506 44.7058 28.3535 44.8169 28.3312 44.9243" fill="currentColor"/><path d="M40.9497 44.0058L41.3448 41.9958H35.207H32.6247H32.5906L31.0607 49.7915H33.6752L34.1332 47.4604H39.8472L39.8903 47.2375L40.1973 45.6716L40.2404 45.4505H34.5282L34.8119 44.0058H40.9497Z" fill="currentColor"/><path d="M47.2959 41.7852C43.884 41.7852 41.8171 42.9284 41.2353 45.8872C40.9875 47.1517 41.1365 48.097 41.6681 48.7515C42.3702 49.6183 43.7367 50 45.6833 50C49.0952 50 51.1495 48.8567 51.7331 45.8979C51.9827 44.621 51.8319 43.6882 51.3004 43.0319C50.6 42.1562 49.2425 41.7834 47.2959 41.7834M49.1168 45.8855C48.9372 46.795 47.9639 47.8277 46.1071 47.8277C45.1123 47.8277 44.491 47.5388 44.1552 47.1286C44.0127 46.9568 43.9114 46.7553 43.8588 46.539C43.8063 46.3227 43.8038 46.0974 43.8517 45.8801C44.0312 44.9688 45.0045 43.9361 46.8703 43.9361C47.8544 43.9361 48.4865 44.225 48.8241 44.6352C48.9631 44.8087 49.0616 45.0107 49.1122 45.2267C49.1628 45.4426 49.1644 45.6671 49.1168 45.8837" fill="currentColor"/><path d="M59.9359 42.0083H56.1649V41.9958H53.5432V42.0083L53.1391 44.0611L52.8051 45.7608L52.3993 47.8261L52.0168 49.7879H54.6314L55.0156 47.8261H57.5297L58.5874 49.7879H61.6509L60.1425 47.5657C61.3043 47.1109 62.2524 46.1014 62.4769 44.9243C62.7947 43.3192 61.6527 42.0155 59.9306 42.0155M59.8623 44.9243C59.8006 45.1628 59.6617 45.3744 59.4671 45.5269C59.2724 45.6793 59.0327 45.764 58.7849 45.7679H55.4197L55.7537 44.0683H59.1189C59.2291 44.0613 59.3395 44.0798 59.4414 44.1221C59.5433 44.1644 59.634 44.2295 59.7065 44.3124C59.7789 44.3952 59.8312 44.4935 59.8591 44.5996C59.8871 44.7058 59.89 44.8169 59.8677 44.9243" fill="currentColor"/><path d="M73.1544 41.9958H72.8958L69.0476 46.6276L67.004 41.9958H66.7472H64.1309L62.6027 49.7808H65.2191L65.9733 45.9374L67.7708 49.7683H68.4298H69.0781L72.3786 45.9374L71.6244 49.7808H74.2516L75.7815 41.9958H73.1544Z" fill="currentColor"/><path d="M81.3932 41.9958L75.1944 49.7683H78.2471L79.1827 48.593H84.7171L85.2002 49.7683H88.2529L85.1068 41.9958H81.3932ZM80.8276 46.5277L82.8585 43.9844L83.8803 46.5277H80.8276Z" fill="currentColor"/><path d="M98.2515 41.9958L97.2943 46.8719L93.8465 41.9958H90.7273L89.201 49.7683L89.1992 49.7808H91.8263L92.7871 44.894L96.2331 49.7683H96.7251L96.7233 49.7808H99.3397L99.3415 49.7683L100.868 41.9958H99.1242H98.2515Z" fill="currentColor"/><path d="M107.205 41.7854C103.793 41.7854 101.726 42.9286 101.144 45.8874C100.895 47.1519 101.046 48.0971 101.577 48.7517C102.278 49.6167 103.646 50.0001 105.591 50.0001C108.71 50.0001 110.71 49.0335 111.47 46.5919H108.735C108.291 47.2571 107.395 47.8403 106.02 47.8403C105.025 47.8403 104.404 47.5514 104.068 47.1412C103.925 46.9696 103.824 46.7681 103.771 46.5519C103.718 46.3356 103.715 46.1102 103.763 45.8927C103.942 44.9814 104.915 43.9487 106.783 43.9487C107.767 43.9487 108.399 44.2377 108.737 44.6479C108.865 44.8054 108.958 44.9876 109.012 45.1829H111.752C111.831 44.2609 111.648 43.551 111.213 43.0285C110.513 42.1528 109.153 41.78 107.209 41.78" fill="currentColor"/><path d="M121.939 43.9505L122.321 41.9958H115.995H115.122H113.379L111.852 49.7683L111.847 49.7915H120.791L120.795 49.7683L121.09 48.2701L121.179 47.8154H114.851L115.038 46.8719H119.858H120.928H121.364L121.749 44.9172H121.312H120.31H115.42L115.611 43.9505H121.939Z" fill="currentColor"/></svg><span class="sub">Acquisition<br>Centre</span>`;

/* ================= Boot ================= */
async function boot(){
  const timer=setTimeout(()=>{if(!S.loaded){S.loadErr='Taking a while to connect. Check your signal.';render()}},10000);
  try{const [db,user]=await Promise.all([window.claude?.use('db'),window.claude?.use('user')]);S.db=db;S.user=user}catch(e){}
  if(!S.db){clearTimeout(timer);S.noDb=true;render();return}
  try{if(S.user){S.realAdmin=!!(await S.user.canEdit());S.uid=await S.user.id();S.me=await S.user.me()}}catch(e){}
  if(route()==='customer'){LS.set('pp-preview',1);history.replaceState(null,'',location.pathname+location.search)}
  S.isAdmin=S.realAdmin&&!LS.get('pp-preview');
  if(S.realAdmin){try{S.assets=await window.claude.use('assets')}catch(e){}}
  S.db.collection('vehicles').onSnapshot(s=>{S.vehicles=s.docs.map(d=>({id:d.id,...d.data()}));if(!s.metadata.fromCache||S.vehicles.length){S.loaded=true;S.loadErr=null;clearTimeout(timer)}soft()},e=>{S.loaded=true;clearTimeout(timer);if(e.code!=='revoked')S.loadErr='Could not load vehicles.';soft()});
  S.db.collection('claims').onSnapshot(s=>{const c={};s.docs.forEach(d=>c[d.id]=d.data());S.claims=c;soft()},()=>{});
  if(S.uid){
    S.db.doc('purchases/'+S.uid).onSnapshot(s=>{S.mine=(s.exists&&s.data().items)||{};soft()},()=>{});
    S.db.doc('threads/'+S.uid).onSnapshot(s=>{S.myThread=s.exists?s.data():null;soft()},()=>{});
    S.db.doc('data/users/'+S.uid+'/prefs').onSnapshot(s=>{S.saved=(s.exists&&s.data().saved)||[];soft()},()=>{});
  }
  if(S.realAdmin){S.db.collection('threads').onSnapshot(async s=>{const t={};s.docs.forEach(d=>t[d.id]=d.data());S.threads=t;await profiles(Object.keys(t));soft()},()=>{})}
  if(S.isAdmin){
    S.db.collection('purchases').onSnapshot(async s=>{const all={};s.docs.forEach(d=>{const it=(d.data()||{}).items||{};for(const vid in it)(all[vid]||=[]).push({buyer:d.id,...it[vid]})});S.allBuys=all;await profiles(s.docs.map(d=>d.id));soft()},()=>{});
  }
  render();
}
async function profiles(ids){ids=ids.filter(i=>i&&!S.profiles[i]);if(!ids.length||!S.user?.profiles)return;ids.forEach(i=>S.profiles[i]={});
  try{const ps=await S.user.profiles(ids);ids.forEach(i=>{if(ps&&ps[i])S.profiles[i]=ps[i]})}catch(e){}soft()}
let NAV=0;window.addEventListener('hashchange',()=>{NAV++;render();window.scrollTo(0,0)});
function soft(){
  const r=route();
  if((r==='admin-new'||r.startsWith('admin-edit-'))&&S.draft)return;
  if(document.querySelector('.sheet-bg,.lb'))return;
  if(r.startsWith('chat')&&document.getElementById('msgs')&&(r!=='chat'||!S.isAdmin))return;
  if(r.startsWith('admin-v-')&&['tLoc','tEta','tCar','tRef','tLink','tNote'].some(i=>document.getElementById(i)===document.activeElement||(i==='tNote'&&document.getElementById(i)?.value)))return;
  const a=document.activeElement;
  render(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName));
}

/* ================= Shell ================= */
function render(keep){
  if(S.noDb){app.innerHTML=signIn();return}
  const r=route();let body,mode='';
  if(r.startsWith('admin')){
    if(!S.isAdmin)body='<div class="card empty">This area is for Play Performance staff only.</div>';
    else if(r==='admin-new'){body=wizard(null);mode='wizard'}
    else if(r.startsWith('admin-edit-')){body=wizard(r.slice(11));mode='wizard'}
    else if(r.startsWith('admin-v-'))body=adminVehicle(r.slice(8));
    else body=adminList();
  }else if(r.startsWith('v-')){body=vehiclePage(r.slice(2));if(document.body.dataset.hasbuy==='1')mode='buybar'}
  else if(r==='saved')body=S.uid?listPage('saved'):`<h1 class="page-h h-x">Saved <span class="red">cars</span></h1><div class="card empty">Sign in to save cars to your shortlist.<br><br><button class="btn btn-red" data-act="signin">Sign in</button></div>`;
  else if(r==='chat'){body=S.isAdmin?inbox():chatPage(S.uid);mode=S.isAdmin?'':'chatmode'}
  else if(r.startsWith('chat-')){body=chatPage(r.slice(5));mode='chatmode'}
  else if(r==='mine'||r==='track')body=trackList();
  else if(r.startsWith('track-'))body=trackPage(r.slice(6));
  else if(r==='customer'){body=listPage('all')}
  else body=listPage('all');
  let fid=null,sel=null;if(keep&&document.activeElement?.id){fid=document.activeElement.id;sel=document.activeElement.selectionStart}
  const y=window.scrollY;
  const galIdx=document.getElementById('gal')?Math.round(document.getElementById('gal').scrollLeft/(document.getElementById('gal').clientWidth||1)):0;
  app.innerHTML=shell(body,r);
  document.body.className=mode+(app.querySelector('.buybar')?' has-buybar':'');
  if(mode==='chatmode'){ensureMsgs(r==='chat'?S.uid:r.slice(5));const ta=document.getElementById('chatTa');if(ta){ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight)+'px'}}else stopMsgs();
  if(keep)window.scrollTo(0,y);
  if(fid){const el=document.getElementById(fid);if(el){el.focus({preventScroll:true});try{el.setSelectionRange(sel,sel)}catch(e){}}}
  after(r,galIdx);
  if(r.startsWith('chat')&&document.getElementById('msgs'))window.scrollTo(0,document.body.scrollHeight);
}
function tab(id,label,icon,r,extra=''){const on=(id===''?(r===''):r.startsWith(id));return `<button class="${on?'on':''}" data-go="${id}">${icon}<span>${label}</span>${extra}</button>`}
function shell(body,r){
  const nMine=Object.values(S.mine).filter(p=>p.result==='won').length, nSaved=S.saved.length;
  const name=S.me?.name||'';
  const nUnread=unreadCount();
  const bottom=`<nav class="tabbar">
    ${tab('','Cars',I.car,r==='saved'||r==='mine'||r.startsWith('admin')?'x':(r.startsWith('v-')?'':r))}
    ${S.isAdmin?'':tab('saved','Saved',I.heart,r,nSaved?`<span class="badge-n">${nSaved}</span>`:'')}
    ${S.isAdmin?tab('chat','Messages',I.chat,r,nUnread?`<span class="badge-n">${nUnread}</span>`:''):''}
    ${S.isAdmin?`<button class="plus" data-go="admin-new" aria-label="Add vehicle"><span class="c">${I.plus}</span></button>`:''}
    ${S.isAdmin?'':tab('track','Track',I.truck,r.startsWith('mine')?'track':r,nMine?`<span class="badge-n">${nMine}</span>`:'')}
    ${S.isAdmin?'':tab('chat','Chat',I.chat,r,nUnread?`<span class="badge-n">${nUnread}</span>`:'')}
    ${S.isAdmin?tab('admin','Admin',I.grid,r):''}
  </nav>`;
  return `<header class="top"><div class="wrap bar">
    <a class="logo" data-go="">${LOGO}</a>
    <div style="display:flex;align-items:center;gap:8px">
      <div class="tnav">
        <button class="${r===''||r.startsWith('v-')?'on':''}" data-go="">Cars</button>
        <button class="${r==='saved'?'on':''}" data-go="saved">Saved${nSaved?` (${nSaved})`:''}</button>
        <button class="${r==='mine'||r.startsWith('track')?'on':''}" data-go="track">Track my car${nMine?` (${nMine})`:''}</button>
        <button class="${r.startsWith('chat')?'on':''}" data-go="chat">Messages${nUnread?` (${nUnread})`:''}</button>
        ${S.isAdmin?`<button class="${r.startsWith('admin')&&r!=='admin-new'?'on':''}" data-go="admin">Admin</button><button class="btn btn-red btn-sm" data-go="admin-new" style="margin-left:6px">+ Add vehicle</button>`:''}
      </div>
      ${S.uid?`<div class="avatar" data-act="me" style="cursor:pointer" title="${esc(name)}">${esc(inits(name))}</div>`:`<button class="btn btn-red btn-sm" data-act="signin">Sign in</button>`}
    </div></div></header>
  <main><div class="wrap">${S.realAdmin&&!S.isAdmin?`<div class="banner" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span>👀 You're seeing the <b>customer view</b>.</span><button class="btn btn-red btn-sm" data-act="exitPreview">Back to admin</button></div>`:''}${S.loadErr?`<div class="banner">${esc(S.loadErr)}</div>`:''}${body}</div></main>${bottom}`;
}
function signIn(){return `<div class="signin"><div class="box"><div class="logo">${LOGO}</div><h2 class="h-x">Back <span class="red">soon</span></h2><p>The Acquisition Centre is being set up. Call us on ${PHONE}.</p></div></div>`}

/* ================= Buyer: list ================= */
function savePrefs(){LS.set('pp-prefs',{make:S.make,body:S.body,sort:S.sort})}
function rows(which){
  const q=S.q.trim().toLowerCase();
  let r=S.vehicles.filter(v=>{const s=saleState(v);return s==='available'||s==='mine'});
  if(which==='saved')r=S.vehicles.filter(v=>S.saved.includes(v.id)&&saleState(v)!=='draft');
  if(q)r=r.filter(v=>(vName(v)+' '+vSub(v)+' '+(v.colour||'')+' '+(v.bodyType||'')).toLowerCase().includes(q));
  if(which==='all'){if(S.make)r=r.filter(v=>(v.make||'').trim().toLowerCase()===S.make.toLowerCase());if(S.body)r=r.filter(v=>v.bodyType===S.body)}
  const P=v=>Number(v.price)||0,K=v=>Number(v.odometer)||1e9,T=v=>v.publishedAt||v.createdAt||0;
  const f={new:(a,b)=>T(b)-T(a),plow:(a,b)=>P(a)-P(b),phigh:(a,b)=>P(b)-P(a),km:(a,b)=>K(a)-K(b),year:(a,b)=>(+b.year||0)-(+a.year||0)};
  return r.sort(f[S.sort]||f.new);
}
function vcard(v){
  const st=saleState(v),ph=v.photos||[],sv=S.saved.includes(v.id);
  const tag=st==='mine'?'<span class="tag mine">You bought this</span>':st==='sold'?'<span class="tag sold">Sold</span>':isNew(v)?'<span class="tag">New</span>':'';
  return `<div class="vcard ${st==='sold'?'is-sold':''}" data-go="v-${v.id}">
    <div class="ph">${ph.length?`<img src="${img(ph[0])}" loading="lazy" alt="">`:'<div class="np">Photos coming soon</div>'}${tag}
      <button class="heart ${sv?'on':''}" data-save="${v.id}" aria-label="Save">${sv?I.heartF:I.heart}</button>
      ${ph.length>1?`<span class="pcount">1/${ph.length}</span>`:''}</div>
    <div class="bd"><div class="row1"><div style="min-width:0"><div class="t1">${esc(vName(v))}</div>${vSub(v)?`<div class="t2">${esc(vSub(v))}</div>`:''}</div><div class="price">${money(v.price)||'POA'}</div></div>
      <div class="facts">${[km(v.odometer),v.transmission,v.fuelType,v.bodyType].filter(Boolean).map(f=>`<span>${esc(f)}</span>`).join('')}</div></div></div>`;
}
function listPage(which){
  const avail=S.vehicles.filter(v=>saleState(v)==='available');
  const makes=[...new Set(avail.map(v=>(v.make||'').trim()).filter(Boolean))].sort();
  const bodies=[...new Set(avail.map(v=>v.bodyType).filter(Boolean))].sort();
  const r=rows(which);
  const head=which==='saved'?`<h1 class="page-h h-x">Saved <span class="red">cars</span></h1><p class="page-sub">Your shortlist. Tap ♡ on any car to add it.</p>`
    :`<h1 class="page-h h-x">Available <span class="red">cars</span></h1><p class="page-sub">Set prices. First to hit Buy now gets the car.</p>`;
  const tools=which==='all'?`<div class="search">${I.search}<input id="q" class="inp" type="search" placeholder="Search make, model, colour…" value="${esc(S.q)}" autocomplete="off" enterkeyhint="search"></div>
    ${makes.length>1||bodies.length>1?`<div class="chips"><button class="${!S.make&&!S.body?'on':''}" data-f="all">All</button>${makes.map(m=>`<button class="${S.make===m?'on':''}" data-f="make:${esc(m)}">${esc(m)}</button>`).join('')}${bodies.map(b=>`<button class="${S.body===b?'on':''}" data-f="body:${esc(b)}">${esc(b)}</button>`).join('')}</div>`:''}
    <div class="resline"><span>${S.loaded?`${r.length} ${r.length===1?'car':'cars'}`:''}</span><button data-act="sort">${I.sort} ${esc(SORTS.find(s=>s[0]===S.sort)?.[1]||'Sort')}</button></div>`:'';
  let body;
  if(!S.loaded)body='<div class="grid"><div class="skel"></div><div class="skel"></div></div>';
  else if(!r.length)body=`<div class="card empty">${which==='saved'?'Nothing saved yet.<br><br><button class="btn btn-line" data-go="">Browse cars</button>':(S.q||S.make||S.body)?'No cars match.<br><br><button class="btn btn-line" data-act="clear">Clear filters</button>':'No cars available right now.<br>New stock is added regularly. Check back soon.'}</div>`;
  else body=`<div class="grid">${r.slice(0,S.show).map(vcard).join('')}</div>${r.length>S.show?`<div class="more"><button class="btn btn-line" data-act="more">Show more (${r.length-S.show})</button></div>`:''}`;
  return head+tools+body;
}

/* ================= Buyer: vehicle ================= */
function galleryHtml(v,id='gal'){
  const ph=v.photos||[];
  return `<div class="gal" id="${id}">${ph.length?ph.map((p,i)=>`<img src="${img(p)}" alt="Photo ${i+1}" ${i>1?'loading="lazy"':''} draggable="false">`).join(''):'<div class="np">Photos coming soon</div>'}</div>`;
}
function vehiclePage(id){
  const v=S.vehicles.find(x=>x.id===id);
  if(!v)return S.loaded?`<div class="card empty">This car isn't available any more.<br><br><button class="btn btn-line" data-go="">See available cars</button></div>`:'<div class="skel"></div>';
  const st=saleState(v);
  if(st==='draft'&&!S.isAdmin)return `<div class="card empty">This car isn't available any more.<br><br><button class="btn btn-line" data-go="">See available cars</button></div>`;
  const ph=v.photos||[],sv=S.saved.includes(v.id),p=S.mine[v.id];
  const hl=(v.highlights||'').split(/\n+/).map(s=>s.replace(/^[-•*\s]+/,'').trim()).filter(Boolean);
  const acc=Object.keys(FIELDS).map((k,i)=>{const rr=FIELDS[k].filter(([f])=>String(v[f]??'').trim()!=='');if(!rr.length)return'';
    return `<details class="acc" ${i===0?'open':''}><summary>${SECT[k]}</summary><div class="kv">${rr.map(([f,l])=>`<div class="r"><span>${esc(l)}</span><span>${esc(v[f])}</span></div>`).join('')}</div></details>`}).join('');
  let status='';
  if(st==='mine')status=`<div class="okbox"><b class="big">It's yours!</b>You bought this car for <b>${money(p?.price||v.price)}</b> on ${fTime(p?.at||S.claims[v.id]?.at)}.<div style="margin-top:10px;font-weight:700;color:#fff">What happens next</div><ol class="steps"><li>We'll call you within 1 business day.</li><li>We arrange payment with you.</li><li>We organise ${p?.delivery==='Delivery'?'delivery to '+esc(p.location||'you'):'your pickup'}.</li></ol><button class="btn btn-red btn-block" data-go="track-${v.id}" style="margin-top:12px">${I.truck.replace('<svg','<svg width="20" height="20"')} Track my car</button><div class="note" style="margin-top:8px">Need us sooner? Call ${PHONE}.</div></div>`;
  else if(st==='sold')status=`<div class="okbox red"><b class="big">Sold</b>Someone else bought this one first.</div>`;
  else if(st==='draft')status=`<div class="banner">Hidden from buyers (admin preview).</div>`;
  const buyBtn=`<button class="btn btn-red btn-block" data-act="buy" data-id="${v.id}" ${v.price?'':'disabled'}>Buy now</button>`;
  const actions=`<div class="actrow">${true?`<button class="btn btn-line" data-save="${v.id}">${sv?I.heartF.replace('<svg','<svg width="20" height="20" style="color:var(--red)"'):I.heart.replace('<svg','<svg width="20" height="20"')} ${sv?'Saved':'Save'}</button>`:''}<button class="btn btn-line" data-act="share" data-id="${v.id}">${I.share.replace('<svg','<svg width="20" height="20"')} Share</button></div>`;
  const buybox=`<div class="card buybox">${st==='available'?`<div class="pl">Buy now price</div><span class="price">${money(v.price)||'POA'}</span>${buyBtn}<p class="note" style="margin:12px 0 0">You'll confirm on the next screen. We then call you to arrange payment and pickup or delivery.</p>`:st==='mine'?'<b class="h-x">Yours</b>':'<b class="h-x">Sold</b>'}${actions}</div>`;
  const bar=st==='available'?`<div class="buybar"><div class="p"><small>Buy now</small><span class="price">${money(v.price)||'POA'}</span></div><button class="btn btn-red" data-act="buy" data-id="${v.id}" ${v.price?'':'disabled'}>Buy now</button></div>`:'';
  return `<div class="vgrid"><div>
    <div class="vhero">${galleryHtml(v)}
      <button class="back-fab" data-act="back" aria-label="Back">←</button>
      ${ph.length?`<button class="gfull" data-act="full" aria-label="Full screen">${I.expand}</button><span class="gcount" id="gcount">1 / ${ph.length}</span>`:''}
      ${ph.length>1?'<button class="garr l" data-act="gprev">‹</button><button class="garr r" data-act="gnext">›</button>':''}</div>
    ${ph.length>1?`<div class="thumbs" id="thumbs">${ph.map((p,i)=>`<img src="${img(p)}" data-gi="${i}" class="${i?'':'on'}" loading="lazy" alt="">`).join('')}</div>`:''}
    <div class="vhead"><h1 class="h-x">${esc(vName(v))}</h1><div class="sub">${esc([vSub(v),v.colour].filter(Boolean).join(' · '))}</div>
      ${st==='available'?`<div class="pl">Buy now price</div><span class="price">${money(v.price)||'POA'}</span>`:''}</div>
    ${status}
    ${S.isAdmin?`<button class="btn btn-line btn-sm" data-go="admin-v-${v.id}" style="margin:6px 0 4px">Open in admin</button>`:''}
    <div class="keyspecs">
      <div class="ks">${I.odo}<div><small>Odometer</small><b>${esc(km(v.odometer)||'—')}</b></div></div>
      <div class="ks">${I.trans}<div><small>Transmission</small><b>${esc(v.transmission||'—')}</b></div></div>
      <div class="ks">${I.body}<div><small>Body</small><b>${esc(v.bodyType||'—')}</b></div></div>
      <div class="ks">${I.eng}<div><small>Engine</small><b>${esc(v.engineSize||v.fuelType||'—')}</b></div></div>
    </div>
    ${hl.length?`<div class="card hl"><h3 class="h-x">Highlights</h3><ul>${hl.map(h=>`<li>${esc(h)}</li>`).join('')}</ul></div>`:''}
    ${acc}
    <div class="mobile-actions">${actions}</div>
    ${!S.isAdmin?`<button class="btn btn-line btn-block" data-act="ask" data-id="${v.id}" style="margin-top:6px">${I.chat.replace('<svg','<svg width="20" height="20"')} Ask us about this car</button>`:''}<p class="note" style="text-align:center;margin-top:14px">Or call ${PHONE}</p>
  </div><div>${buybox}</div></div>${bar}`;
}

/* ================= Buy flow ================= */
async function buyNow(id){
  if(!S.uid){authSheet('Sign in or create an account to buy this car.');return}
  const v=S.vehicles.find(x=>x.id===id);if(!v||S.busy)return;
  if(saleState(v)!=='available'){toast('This car is no longer available.');return}
  const ph=(v.photos||[])[0];
  const res=await sheet(`<h3 class="h-x">Confirm <span class="red">purchase</span></h3>
    <div class="car">${ph?`<img src="${img(ph)}" alt="">`:''}<div><b>${esc(vName(v))}</b><span class="price">${money(v.price)}</span></div></div>
    <div class="fg"><span class="lbl">Pickup or delivery?</span><div class="opt"><label><input type="radio" name="del" value="Pickup" checked><span>Pickup</span></label><label><input type="radio" name="del" value="Delivery"><span>Delivery</span></label></div></div>
    <div class="fg" id="locW" style="display:none"><label class="lbl" for="bLoc">Deliver to (suburb, state)</label><input id="bLoc" class="inp" placeholder="e.g. Parramatta NSW" autocomplete="address-level2"></div>
    <div class="fg"><label class="lbl" for="bCom">Anything we should know? <span class="muted" style="font-weight:400">(optional)</span></label><textarea id="bCom" class="inp" rows="2" placeholder="Best time to call, finance, trade-in…"></textarea></div>
    <label class="check"><input type="checkbox" id="bOk"><span>I'm committing to buy this car for <b>${money(v.price)}</b>. Play Performance will call me to arrange payment.</span></label>
    <div class="err" id="bErr"></div>
    <div class="row"><button class="btn btn-line" data-m="">Cancel</button><button class="btn btn-red" id="bGo">Confirm</button></div>`,
    (s,close)=>{
      s.querySelectorAll('input[name=del]').forEach(r=>r.onchange=()=>{s.querySelector('#locW').style.display=s.querySelector('input[name=del]:checked').value==='Delivery'?'block':'none'});
      s.querySelector('#bGo').onclick=()=>{if(!s.querySelector('#bOk').checked){s.querySelector('#bErr').textContent='Tick the box to confirm.';return}
        close({delivery:s.querySelector('input[name=del]:checked').value,location:s.querySelector('#bLoc').value.trim(),comments:s.querySelector('#bCom').value.trim()})};
    });
  if(!res||typeof res!=='object')return;
  S.busy=true;toast('Securing your car…');
  const rec={price:Number(v.price),at:Date.now(),vehicle:vName(v),...res};
  try{
    const ref=S.db.doc('claims/'+id);
    const lease=await ref.acquire({holder:S.uid,ttlMs:8000});
    if(!lease.acquired){S.busy=false;await attempt(id,{...rec,result:'busy'});toast('Someone else is buying this right now. Try again in a few seconds.');return}
    const cur=await ref.get();
    if(cur.exists&&cur.data()?.buyer&&cur.data().buyer!==S.uid){S.busy=false;await attempt(id,{...rec,result:'too late'});render();toast('Sorry, someone else just bought this car.');return}
    await ref.set({buyer:S.uid,at:rec.at,price:rec.price});
    await attempt(id,{...rec,result:'won'});
    S.busy=false;go('track-'+id);toast("You bought it! Track it here.");
    try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}
  }catch(e){S.busy=false;if(e?.code==='already_exists'){await attempt(id,{...rec,result:'too late'});render();toast('Sorry, someone else just bought this car.');return}toast(e?.code==='invalid_argument'?'This car is no longer available.':'Something went wrong. Check your connection and try again.')}
}
async function attempt(id,rec){try{const it={...S.mine};if(rec.result!=='won'&&it[id]?.result==='won')return;it[id]=rec;await S.db.doc('purchases/'+S.uid).set({items:it})}catch(e){}}

function myCars(){return Object.keys(S.mine).filter(id=>S.mine[id].result==='won'&&S.claims[id]?.buyer===S.uid||S.mine[id].result==='won'&&!S.claims[id]).map(id=>({id,p:S.mine[id],v:S.vehicles.find(x=>x.id===id)})).filter(x=>x.v).sort((a,b)=>(b.p.at||0)-(a.p.at||0))}
function trackOf(v,p,claimAt){const t=v.track||{};const stage=Math.max(0,Math.min(STAGES.length-1,+t.stage||0));const ups=[...(t.updates||[])];
  if(!ups.some(u=>u.stage===0))ups.push({stage:0,at:claimAt||p?.at,note:'',auto:true});return {...t,stage,updates:ups.sort((a,b)=>(b.at||0)-(a.at||0))}}
function routeSvg(stage,pick,dest){
  const f=pick?Math.min(1,stage/4):[0,0,0.08,0.55,0.9,1][stage];
  const x=20+f*300;
  return `<div class="route"><svg viewBox="0 0 340 60" aria-hidden="true">
    <path d="M20 40 C 110 6, 230 6, 320 40" fill="none" stroke="#2c2c2c" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9"/>
    <path d="M20 40 C 110 6, 230 6, 320 40" fill="none" stroke="#F30000" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${(f*100).toFixed(1)} 100"/>
    <circle cx="20" cy="40" r="7" fill="#F30000"/><circle cx="320" cy="40" r="7" fill="${f>=1?'#F30000':'#000'}" stroke="#F30000" stroke-width="3"/>
    ${f>0&&f<1?`<g transform="translate(${x-14},${(40-34*Math.sin(Math.PI*f)*0.85-14).toFixed(1)})"><circle cx="14" cy="14" r="14" fill="#fff"/><path d="M6 10h9v8H6zM15 13h3l2 2v3h-5" fill="none" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9" cy="19.5" r="1.6" fill="#000"/><circle cx="17.5" cy="19.5" r="1.6" fill="#000"/></g>`:''}
  </svg><div class="ends"><div><b>Play Performance</b>Queensland</div><div><b>${pick?'Pickup':'Delivery'}</b>${esc(pick?'Our yard':(dest||'Your address'))}</div></div></div>`;
}
function trackCard(v,p,full){
  const pick=p?.delivery!=='Delivery', t=trackOf(v,p,S.claims[v.id]?.at), ph=(v.photos||[])[0];
  const head=`<div class="trk-head">${ph?`<img src="${img(ph)}" alt="">`:''}<div style="min-width:0"><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:700">${esc(vName(v))}</div><div class="trk-status" style="color:${t.stage>=5?'var(--green)':'#fff'}">${esc(stLabel(t.stage,pick))}</div><div class="trk-sub">${esc(stDesc(t.stage,pick))}</div></div></div>`;
  if(!full)return `<div class="card trk" data-go="track-${v.id}" style="cursor:pointer">${head}${routeSvg(t.stage,pick,p?.location)}<div class="btn btn-line btn-block btn-sm">View tracking</div></div>`;
  const facts=[];
  if(t.location)facts.push(`<div><small>Current location</small>📍 ${esc(t.location)}</div>`);
  if(t.eta)facts.push(`<div><small>${pick?'Ready by':'Estimated arrival'}</small>${esc(fYMD(t.eta))}</div>`);
  if(t.carrier)facts.push(`<div><small>Transport</small>${esc(t.carrier)}</div>`);
  if(t.ref)facts.push(`<div><small>Booking ref</small>${esc(t.ref)}</div>`);
  facts.push(`<div><small>${pick?'Pickup':'Delivery to'}</small>${esc(pick?'Play Performance yard':(p?.location||'Your address'))}</div>`);
  facts.push(`<div><small>Paid</small>${money(p?.price||v.price)}</div>`);
  return `<div class="card trk">${head}${routeSvg(t.stage,pick,p?.location)}
    <div class="facts2">${facts.join('')}</div>
    ${t.link?`<a class="btn btn-line btn-block" href="${esc(t.link)}" target="_blank" rel="noopener" style="margin-bottom:14px">${I.truck.replace('<svg','<svg width="20" height="20"')} Live tracking with ${esc(t.carrier||'carrier')}</a>`:''}
    <ol class="steps2">${STAGES.map((s,i)=>{const u=t.updates.find(x=>x.stage===i);return `<li class="${i<t.stage?'done':i===t.stage?(i===5?'done':'now'):''}"><span class="dot">${i<t.stage||i===5&&t.stage===5?'✓':''}</span><b>${esc(stLabel(i,pick))}</b>${u?.at?`<small>${fTime(u.at)}</small>`:''}</li>`}).join('')}</ol>
  </div>
  ${t.updates.filter(u=>u.note||u.location).length?`<div class="card sect"><h2 class="h-x">Updates</h2>${t.updates.filter(u=>u.note||u.location).map(u=>`<div class="upd"><div class="t">${fTime(u.at)} · ${esc(stLabel(u.stage||0,pick))}</div>${u.location?`📍 ${esc(u.location)}<br>`:''}${esc(u.note||'')}</div>`).join('')}</div>`:''}
  ${S.isAdmin?'':`<button class="btn btn-line btn-block" data-act="ask" data-id="${v.id}">${I.chat.replace('<svg','<svg width="20" height="20"')} Message us about this delivery</button>`}<p class="note" style="text-align:center">Or call ${PHONE}</p>`;
}
const fYMD=s=>{if(!s)return'';const [y,m,d]=s.split('-').map(Number);if(!y)return s;const dt=new Date(y,m-1,d);return dt.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})};
function trackList(){
  if(!S.uid)return `<h1 class="page-h h-x">Track <span class="red">my car</span></h1><div class="card empty">Sign in to track your car.<br><br><button class="btn btn-red" data-act="signin">Sign in</button></div>`;
  const list=myCars();
  return `<h1 class="page-h h-x">Track <span class="red">my car</span></h1><p class="page-sub">Follow your car from purchase to your driveway.</p>
  ${!S.loaded?'<div class="skel" style="height:200px"></div>':list.length?list.map(({v,p})=>trackCard(v,p,false)).join(''):`<div class="card empty">No cars to track yet.<br>Buy a car and you can follow it here, step by step.<br><br><button class="btn btn-line" data-go="">Browse cars</button></div>`}`;
}
function trackPage(id){
  const v=S.vehicles.find(x=>x.id===id),p=S.mine[id];
  if(!v)return S.loaded?'<div class="card empty">Car not found.</div>':'<div class="skel"></div>';
  if(!(p?.result==='won'||S.isAdmin))return '<div class="card empty">You can only track cars you bought.<br><br><button class="btn btn-line" data-go="track">My tracking</button></div>';
  return `<button class="btn btn-line btn-sm" data-go="track" style="margin-bottom:12px">← All my cars</button>${trackCard(v,p||{delivery:'Delivery'},true)}`;
}

/* ================= Auth ================= */
function authSheet(why){
  let mode='in';
  const html=()=>`<h3 class="h-x">${mode==='up'?'Create <span class="red">account</span>':mode==='reset'?'Reset <span class="red">password</span>':'Sign <span class="red">in</span>'}</h3>
    ${why?`<p>${esc(why)}</p>`:'<p>Buy cars, track your delivery and chat with our team.</p>'}
    <div class="form1">
      ${mode==='up'?'<div><label class="lbl" for="aName">Full name</label><input id="aName" class="inp" autocomplete="name"></div><div><label class="lbl" for="aPhone">Mobile</label><input id="aPhone" class="inp" type="tel" autocomplete="tel" inputmode="tel"></div>':''}
      <div><label class="lbl" for="aEmail">Email</label><input id="aEmail" class="inp" type="email" autocomplete="email" inputmode="email"></div>
      ${mode!=='reset'?`<div><label class="lbl" for="aPw">Password</label><input id="aPw" class="inp" type="password" autocomplete="${mode==='up'?'new-password':'current-password'}" placeholder="${mode==='up'?'At least 8 characters':''}"></div>`:''}
    </div>
    <div class="err" id="aErr"></div>
    <div class="row"><button class="btn btn-red btn-block" id="aGo">${mode==='up'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button></div>
    <p style="text-align:center;margin:14px 0 0;font-size:14px">${mode==='in'?'New here? <a href="#" data-sw="up" style="color:#fff;font-weight:700">Create an account</a><br><a href="#" data-sw="reset" style="color:var(--muted)">Forgot password?</a>':'<a href="#" data-sw="in" style="color:#fff;font-weight:700">I already have an account</a>'}</p>`;
  sheet('<div id="authBox"></div>',(s,close)=>{
    const box=s.querySelector('#authBox');
    const draw=()=>{box.innerHTML=html();box.querySelectorAll('[data-sw]').forEach(a=>a.onclick=ev=>{ev.preventDefault();mode=a.dataset.sw;draw()});
      box.querySelector('#aGo').onclick=go2;box.querySelectorAll('input').forEach(i=>i.onkeydown=ev=>{if(ev.key==='Enter')go2()});setTimeout(()=>box.querySelector('input')?.focus(),50)};
    const go2=async()=>{const g=id=>box.querySelector(id)?.value.trim()||'';const er=box.querySelector('#aErr');er.textContent='';
      const email=g('#aEmail'),pw=box.querySelector('#aPw')?.value||'';
      if(!/^\S+@\S+\.\S+$/.test(email)){er.textContent='Enter a valid email.';return}
      const btn=box.querySelector('#aGo');btn.disabled=true;
      try{
        if(mode==='reset'){const {error}=await window.__sb.auth.resetPasswordForEmail(email,{redirectTo:PAGE_URL});if(error)throw error;er.style.color='var(--green)';er.textContent='Check your email for a reset link.';btn.disabled=false;return}
        if(mode==='up'){if(!g('#aName')){er.textContent='Enter your name.';btn.disabled=false;return}if(pw.length<8){er.textContent='Password needs at least 8 characters.';btn.disabled=false;return}
          const {data,error}=await window.__sb.auth.signUp({email,password:pw,options:{data:{name:g('#aName'),phone:g('#aPhone')},emailRedirectTo:PAGE_URL}});if(error)throw error;
          if(!data.session){er.style.color='var(--green)';er.textContent='Almost done! Check your email and tap the link to confirm, then sign in.';btn.disabled=false;return}}
        else{const {error}=await window.__sb.auth.signInWithPassword({email,password:pw});if(error)throw error}
        close();location.reload();
      }catch(x){btn.disabled=false;er.style.color='';er.textContent=/invalid login/i.test(x.message)?'Wrong email or password.':/already registered/i.test(x.message)?'That email already has an account. Sign in instead.':/confirm/i.test(x.message)?'Please confirm your email first (check your inbox).':(x.message||'Something went wrong.')}};
    draw();
  });
}

/* ================= Messages ================= */
const seen=k=>LS.get('pp-seen-'+k)||0;
function markSeen(k,at){if(at&&at>seen(k))LS.set('pp-seen-'+k,at)}
function unreadCount(){
  if(S.isAdmin)return Object.entries(S.threads).filter(([u,t])=>t.lastFrom==='buyer'&&(t.lastAt||0)>seen(u)).length;
  const t=S.myThread;return t&&t.lastFrom==='pp'&&(t.lastAt||0)>seen('mine')?1:0;
}
function ensureMsgs(uid){
  if(!uid||!S.db)return;
  if(S.msgFor===uid&&S.msgUnsub)return;
  stopMsgs();S.msgFor=uid;S.msgs=[];S.msgsLoaded=false;
  S.msgUnsub=S.db.collection('threads/'+uid+'/m').orderBy('at','asc').limit(500).onSnapshot(s=>{
    S.msgs=s.docs.map(d=>({id:d.id,...d.data()}));S.msgsLoaded=true;
    const last=S.msgs[S.msgs.length-1];if(last)markSeen(S.isAdmin?uid:'mine',last.at);
    if(!unreadCount())document.querySelectorAll('[data-go="chat"] .badge-n').forEach(e=>e.remove());
    const box=document.getElementById('msgs');const atBottom=!box||(window.innerHeight+window.scrollY>=document.body.scrollHeight-160);
    const ta=document.getElementById('chatTa');const foc=document.activeElement===ta;
    const m=document.getElementById('msgs');if(m){m.innerHTML=msgsHtml(uid);if(atBottom)window.scrollTo(0,document.body.scrollHeight)}else soft();
    if(foc)ta?.focus();
  },()=>{S.msgsLoaded=true;soft()});
}
function stopMsgs(){if(S.msgUnsub){try{S.msgUnsub()}catch(e){}}S.msgUnsub=null;S.msgFor=null}
function carRef(id){const v=S.vehicles.find(x=>x.id===id);if(!v)return'';const ph=(v.photos||[])[0];return `<div class="carref" data-go="${S.isAdmin?'admin-v-':'v-'}${v.id}">${ph?`<img src="${img(ph)}" alt="">`:''}<span>${esc(vName(v))}<br><span style="opacity:.8;font-weight:500">${money(v.price)}</span></span></div>`}
function msgsHtml(uid){
  if(!S.msgsLoaded||S.msgFor!==uid)return '<div class="note" style="text-align:center;padding:20px">Loading…</div>';
  const mineSide=S.isAdmin?'pp':'buyer';let last='';
  const intro=S.isAdmin?'':`<div class="bub them">G'day! 👋 Ask us anything about a car, finance, delivery or your purchase. We usually reply within the hour during business hours.</div>`;
  return intro+S.msgs.map(m=>{const d=fDate(m.at);const sep=d!==last?`<div class="daysep">${d===fDate(Date.now())?'Today':d}</div>`:'';last=d;
    return sep+`<div class="bub ${m.from===mineSide?'me':'them'}">${m.car?carRef(m.car):''}${esc(m.text)}<span class="tm">${new Date(m.at).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}${S.isAdmin&&m.from==='pp'&&m.by?' · '+esc(m.by):''}</span></div>`}).join('');
}
function chatPage(uid){
  if(!uid)return `<div class="card empty">Sign in to message the Play Performance team.<br><br><button class="btn btn-red" data-act="signin">Sign in</button></div>`;
  const isA=S.isAdmin;const p=isA?(S.profiles[uid]||{}):{};
  const bought=isA?Object.entries(S.claims).filter(([vid,c])=>c.buyer===uid).map(([vid])=>vid):[];
  const quick=isA?['Thanks! We\'ll call you shortly.','Payment received, thank you.','Your car is on its way 🚚','Ready for pickup!']:['Is this still available?','Can I get finance?','Do you deliver to my area?','Can I book an inspection?'];
  const about=S.chatCar?S.vehicles.find(x=>x.id===S.chatCar):null;
  return `${isA?'<button class="btn btn-line btn-sm" data-go="chat" style="margin-bottom:10px">← Inbox</button>':''}
  <div class="chat-h"><div class="av">${isA?esc(inits(p.name||p.email||'?')):'PP'}</div><div><b>${isA?esc(p.name||'Buyer'):'Play Performance'}</b><small>${isA?esc(p.email||''):'Sales team · usually replies within the hour'}</small></div></div>
  ${bought.length?`<div class="note" style="margin:-4px 0 10px">Bought: ${bought.map(id=>{const v=S.vehicles.find(x=>x.id===id);return v?`<a href="#admin-v-${id}" style="color:#fff">${esc(vName(v))}</a>`:''}).join(', ')}</div>`:''}
  <div class="msgs" id="msgs">${msgsHtml(uid)}</div>
  <div class="composer"><div class="in">
    ${about?`<div class="about"><span>About: <b>${esc(vName(about))}</b> · ${money(about.price)}</span><button data-act="noCar" aria-label="Remove">✕</button></div>`:''}
    <div class="quick">${quick.map(q=>`<button data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div class="row3"><textarea id="chatTa" rows="1" placeholder="${isA?'Reply to '+esc((p.name||'buyer').split(' ')[0])+'…':'Type a message…'}" enterkeyhint="send">${esc(S.chatDraft)}</textarea><button class="send" data-act="send" data-uid="${uid}" aria-label="Send">${I.sendI}</button></div>
  </div></div>`;
}
function inbox(){
  const list=Object.entries(S.threads).sort((a,b)=>(b[1].lastAt||0)-(a[1].lastAt||0));
  return `<h1 class="page-h h-x">Messages</h1><p class="page-sub">Chats from buyers. Newest first.</p>
  ${list.length?`<div class="inbox">${list.map(([u,t])=>{const p=S.profiles[u]||{},un=t.lastFrom==='buyer'&&(t.lastAt||0)>seen(u);
    return `<div class="card irow ${un?'unread':''}" data-go="chat-${u}"><div class="av">${esc(inits(p.name||p.email||'?'))}</div><div class="mid"><b>${esc(p.name||p.email||'Buyer')}</b><div class="last">${t.lastFrom==='pp'?'You: ':''}${esc(t.lastText||'')}</div></div><div class="rt">${ago(t.lastAt)}${un?'<span class="udot"></span>':''}</div></div>`}).join('')}</div>`
  :'<div class="card empty">No messages yet.<br>When a buyer messages you, it shows up here.</div>'}`;
}
async function sendMsg(uid){
  const ta=document.getElementById('chatTa');const text=(ta?.value||'').trim();if(!text||!uid)return;
  const from=S.isAdmin?'pp':'buyer',at=Date.now();
  const m={from,text:text.slice(0,2000),at};if(S.chatCar)m.car=S.chatCar;if(from==='pp'&&S.me?.name)m.by=S.me.name.split(' ')[0];
  ta.value='';S.chatDraft='';const car=S.chatCar;S.chatCar=null;const ab=document.querySelector('.composer .about');if(ab)ab.remove();
  try{
    await S.db.collection('threads/'+uid+'/m').doc(at.toString(36)+Math.random().toString(36).slice(2,6)).set(m);
    await S.db.doc('threads/'+uid).set({lastAt:at,lastText:text.slice(0,140),lastFrom:from});
    markSeen(S.isAdmin?uid:'mine',at);if(!unreadCount())document.querySelectorAll('[data-go="chat"] .badge-n').forEach(e=>e.remove());
  }catch(e){ta.value=text;S.chatDraft=text;S.chatCar=car;toast(e?.code==='invalid_argument'?`Your account can't send messages yet. Call ${PHONE}.`:'Message not sent. Check your signal and try again.')}
  ta.focus();
}

/* ================= Admin: list ================= */
function bName(u){if(!u)return'';const p=S.profiles[u]||{};return p.name||p.email||'Buyer'}
function chip(s){return s==='sold'?'<span class="chip sold">Sold</span>':s==='draft'?'<span class="chip draft">Draft</span>':'<span class="chip">Live</span>'}
function adminList(){
  profiles(Object.values(S.claims).map(c=>c.buyer));
  const c={available:0,sold:0,draft:0};let value=0,month=0;const m0=new Date();m0.setDate(1);m0.setHours(0,0,0,0);
  S.vehicles.forEach(v=>{const s=adminState(v);c[s]++;if(s==='available')value+=Number(v.price)||0;if(s==='sold'&&(S.claims[v.id]?.at||v.soldAt||0)>=m0.getTime())month++});
  const q=S.aQ.trim().toLowerCase();
  let r=S.vehicles.filter(v=>S.aFilter==='all'||adminState(v)===S.aFilter);
  if(q)r=r.filter(v=>(vName(v)+' '+vSub(v)+' '+(v.vin||'')+' '+(v.rego||'')+' '+bName(S.claims[v.id]?.buyer)).toLowerCase().includes(q));
  r.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
  const f=(k,l)=>`<button class="${S.aFilter===k?'on':''}" data-af="${k}">${l}</button>`;
  return `<h1 class="page-h h-x">Admin</h1>
  <div class="stats"><div class="card stat hi"><small>Live</small><b>${c.available}</b></div><div class="card stat"><small>Stock value</small><b>${money(value)||'$0'}</b></div><div class="card stat"><small>Sold this month</small><b>${month}</b></div><div class="card stat"><small>Drafts</small><b>${c.draft}</b></div></div>
  <div class="search">${I.search}<input id="aq" class="inp" type="search" placeholder="Search car, rego, VIN or buyer" value="${esc(S.aQ)}" autocomplete="off"></div>
  <div class="chips">${f('available',`Live (${c.available})`)}${f('sold',`Sold (${c.sold})`)}${f('draft',`Drafts (${c.draft})`)}${f('all','All')}</div>
  ${!S.loaded?'<div class="skel" style="height:120px"></div>':!r.length?`<div class="card empty">${S.vehicles.length?'Nothing here.':'No cars yet.<br><br><button class="btn btn-red" data-go="admin-new">+ Add your first car</button>'}</div>`:
  `<div class="alist">${r.map(v=>{const s=adminState(v),cl=S.claims[v.id],ph=(v.photos||[])[0];return `<div class="card arow" data-go="admin-v-${v.id}">${ph?`<img src="${img(ph)}" loading="lazy" alt="">`:'<div class="nimg"></div>'}
    <div class="mid"><div class="t1">${esc(vName(v))}</div><div class="t2">${s==='sold'?(cl?.buyer?'Sold to '+esc(bName(cl.buyer)):'Sold elsewhere'):esc([v.rego,km(v.odometer)].filter(Boolean).join(' · ')||vSub(v))}</div><div style="margin-top:6px;display:flex;gap:8px;align-items:center">${chip(s)}<span class="price">${money(v.price)||'No price'}</span></div></div>
    ${s==='available'?`<button class="lk" data-act="share" data-id="${v.id}" aria-label="Send link">${I.link}</button>`:''}</div>`}).join('')}</div>`}`;
}

/* ================= Admin: vehicle ================= */
function adminVehicle(id){
  const v=S.vehicles.find(x=>x.id===id);
  if(!v)return S.loaded?'<div class="card empty">Car not found.<br><br><button class="btn btn-line" data-go="admin">Back to admin</button></div>':'<div class="skel"></div>';
  const s=adminState(v),cl=S.claims[id],att=[...(S.allBuys[id]||[])].sort((a,b)=>(a.at||0)-(b.at||0));
  profiles([cl?.buyer,...att.map(a=>a.buyer)]);
  const pr=cl?.buyer?(S.profiles[cl.buyer]||{}):{},win=cl?.buyer?att.find(a=>a.buyer===cl.buyer):null,ph=(v.photos||[])[0];
  const statusCard=s==='sold'?`<div class="card sect"><h2 class="h-x">Sold${cl?.buyer?' to <span class="red">'+esc(pr.name||'buyer')+'</span>':' <span class="red">elsewhere</span>'}</h2>
      ${cl?.buyer?`<p class="sub">${fTime(cl.at)} · ${money(cl.price||v.price)}</p><div class="kgrid"><div><small>Buyer</small>${esc(pr.name||'—')}</div><div><small>Email</small>${esc(pr.email||'—')}</div><div><small>Pickup / delivery</small>${esc(win?.delivery||'—')}${win?.location?' · '+esc(win.location):''}</div><div><small>Notes</small>${esc(win?.comments||'—')}</div></div>
      ${pr.email?`<div class="actrow"><button class="btn btn-line" data-copy="${esc(pr.email)}">Copy email</button></div>`:''}`:`<p class="sub">${fDate(v.soldAt)}${v.soldNote?' · '+esc(v.soldNote):''}</p>`}
      <button class="btn btn-line danger btn-block" data-act="release" data-id="${id}">Release sale (back on sale)</button></div>`
    :s==='available'?`<div class="card sect"><h2 class="h-x">Live <span class="red">for sale</span></h2><p class="sub">Buyers can buy this now for <b style="color:#fff">${money(v.price)||'— (set a price!)'}</b>.</p>
      <button class="btn btn-red btn-block" data-act="share" data-id="${id}">${I.share.replace('<svg','<svg width="20" height="20"')} Send to a buyer</button>
      <div class="linkbox" style="margin-top:10px"><input class="inp" readonly value="${esc(link(id))}"><button class="btn btn-line btn-sm" data-act="copyLink" data-id="${id}">Copy</button></div></div>`
    :`<div class="card sect"><h2 class="h-x">Draft</h2><p class="sub">Buyers can't see this car yet.</p><button class="btn btn-red btn-block" data-act="publish" data-id="${id}">Publish now</button></div>`;
  const attCard=att.length?`<div class="card sect"><h2 class="h-x">Buy now <span class="red">taps</span></h2><p class="sub">In order. First one wins.</p>${att.map(a=>{const p=S.profiles[a.buyer]||{},w=cl?.buyer===a.buyer;return `<div class="attempt"><div class="top2"><b>${esc(p.name||'Buyer')}</b>${w?'<span class="chip">Won</span>':`<span class="chip draft">${a.result==='busy'?'Clashed':'Too late'}</span>`}</div><div class="muted" style="margin-top:3px">${fTime(a.at)}${p.email?' · '+esc(p.email):''}</div>${a.delivery?`<div style="margin-top:4px">${esc(a.delivery)}${a.location?' · '+esc(a.location):''}</div>`:''}${a.comments?`<div class="muted" style="margin-top:4px;white-space:pre-wrap">“${esc(a.comments)}”</div>`:''}</div>`}).join('')}</div>`:'';
  const pick=(win?.delivery||'Pickup')!=='Delivery', t=trackOf(v,win,cl?.at);
  const trackCardAdmin=s==='sold'&&cl?.buyer?`<div class="card sect"><h2 class="h-x">Delivery <span class="red">tracking</span></h2><p class="sub">${esc(pr.name||'The buyer')} sees this on their Track tab. Now: <b style="color:#fff">${esc(stLabel(t.stage,pick))}</b></p>
    <div class="stagepick">${STAGES.map((x,i)=>`<button class="${t.stage===i?'on':''}" data-stage="${i}">${i+1}. ${esc(stLabel(i,pick))}</button>`).join('')}</div>
    <div class="form1">
      <div><label class="lbl" for="tLoc">Current location</label><input id="tLoc" class="inp" placeholder="e.g. Coffs Harbour depot" value="${esc(t.location||'')}"></div>
      <div class="two"><div><label class="lbl" for="tEta">${pick?'Ready by':'ETA'}</label><input id="tEta" class="inp" type="date" value="${esc(t.eta||'')}"></div><div><label class="lbl" for="tCar">Transport company</label><input id="tCar" class="inp" placeholder="e.g. Prestige Car Carriers" value="${esc(t.carrier||'')}"></div></div>
      <div class="two"><div><label class="lbl" for="tRef">Booking ref</label><input id="tRef" class="inp" value="${esc(t.ref||'')}"></div><div><label class="lbl" for="tLink">Carrier tracking link</label><input id="tLink" class="inp" type="url" placeholder="https://" value="${esc(t.link||'')}"></div></div>
      <div><label class="lbl" for="tNote">Message to buyer (optional)</label><textarea id="tNote" class="inp" rows="2" placeholder="e.g. Picked up this morning, all looking good"></textarea></div>
      <input type="hidden" id="tStage" value="${t.stage}">
      <button class="btn btn-red btn-block" data-act="postTrack" data-id="${id}">Post update</button>
      <button class="btn btn-line btn-block btn-sm" data-go="track-${id}">Preview what the buyer sees</button>
    </div></div>`:'';
  return `<button class="btn btn-line btn-sm" data-go="admin" style="margin-bottom:12px">← Admin</button>
  <div class="card review">${ph?`<img src="${img(ph)}" alt="">`:''}<div style="min-width:0"><div class="h-x" style="font-size:16px;line-height:1.25">${esc(vName(v))}</div><div class="muted" style="font-size:13px;margin-top:4px">${esc([vSub(v),v.rego].filter(Boolean).join(' · '))}</div><div style="margin-top:8px;display:flex;gap:8px;align-items:center">${chip(s)}<span class="price" style="font-size:18px">${money(v.price)||'No price'}</span></div></div></div>
  <div class="adm2"><div>${statusCard}${trackCardAdmin}${attCard}</div><div>
  <div class="card sect"><h2 class="h-x">Manage</h2><div class="agrid">
    <button class="btn btn-line" data-go="admin-edit-${id}">Edit</button>
    <button class="btn btn-line" data-go="v-${id}">Buyer view</button>
    <button class="btn btn-line" data-act="duplicate" data-id="${id}">Duplicate</button>
    ${s==='available'?`<button class="btn btn-line" data-act="markSold" data-id="${id}">Sold elsewhere</button><button class="btn btn-line" data-act="hide" data-id="${id}">Hide</button>`:''}
    <button class="btn btn-line danger" data-act="delete" data-id="${id}">Delete</button>
  </div></div></div></div>`;
}

/* ================= Admin: wizard ================= */
function blank(){const d={photos:[],odometer:'',price:'',highlights:'',status:'available'};ALL.forEach(([k])=>d[k]='');return d}
const fld=k=>ALL.find(f=>f[0]===k);
function input([k,label,type,opt],req){
  const val=S.draft[k]??'',id='f_'+k;let el;
  if(type==='select')el=`<select id="${id}" class="inp" data-d="${k}">${opt.map(o=>`<option value="${esc(o)}" ${String(val)===o?'selected':''}>${o||'Select…'}</option>`).join('')}</select>`;
  else if(type==='textarea')el=`<textarea id="${id}" class="inp" data-d="${k}" rows="3">${esc(val)}</textarea>`;
  else el=`<input id="${id}" class="inp" data-d="${k}" type="${type==='number'?'number':'text'}" ${type==='number'?'inputmode="numeric"':''} placeholder="${esc(typeof opt==='string'?opt:'')}" value="${esc(val)}" ${k==='make'?'list="makes"':''} ${k==='vin'||k==='rego'?'autocapitalize="characters" style="text-transform:uppercase"':''}>`;
  return `<div class="${type==='textarea'?'full':''}"><label class="lbl" for="${id}">${esc(label)}${req?'<span class="req">*</span>':''}</label>${el}</div>`;
}
function wizard(id){
  if(id&&(!S.draft||S.editingId!==id)){const v=S.vehicles.find(x=>x.id===id);if(!v)return S.loaded?'<div class="card empty">Car not found.</div>':'<div class="skel"></div>';S.draft=JSON.parse(JSON.stringify(v));delete S.draft.id;S.editingId=id;S.step=1}
  if(!id&&(!S.draft||S.editingId!==null)){S.editingId=null;S.step=1;const sv=LS.get('pp-draft-new');
    S.draft=sv&&(sv.make||sv.model||sv.photos?.length)?{...blank(),...sv,_restored:true}:(S.dupe?{...blank(),...S.dupe}:blank());S.dupe=null}
  const d=S.draft,st=S.step;
  const makes=[...new Set(['Holden','HSV','Ford','FPV','Toyota','Nissan','Mercedes-Benz','BMW','Audi','Volkswagen','Subaru','Mitsubishi','Jeep','Land Rover','Chevrolet','Dodge','RAM','Mazda','Hyundai','Kia','Porsche',...S.vehicles.map(v=>v.make).filter(Boolean)])].sort();
  let body='';
  if(st===1)body=`<h1 class="page-h h-x">Photos</h1><p class="page-sub">Snap the car or pick from your camera roll. First photo is the cover. Tap a photo to move or remove it.</p>
    ${S.assets?`<div class="cap"><label class="cam">${I.cam}Take photo<input type="file" accept="image/*" capture="environment" id="camIn"></label><label class="upl">${I.pics}Choose photos<input type="file" accept="image/*" multiple id="uplIn"></label></div>`:'<div class="banner">Photo uploads need Editor access on this page.</div>'}
    <div class="pgrid" id="pgrid">${pgrid()}</div><div id="ptools">${ptools()}</div>`;
  if(st===2)body=`<h1 class="page-h h-x">Price <span class="red">& basics</span></h1><p class="page-sub">The essentials buyers see first.</p>
    <datalist id="makes">${makes.map(m=>`<option value="${esc(m)}">`).join('')}</datalist>
    <div class="form1">
      <div><label class="lbl" for="f_price">Buy now price ($)<span class="req">*</span></label><input id="f_price" class="inp" data-d="price" type="number" inputmode="numeric" placeholder="e.g. 42000" value="${esc(d.price)}" style="font-size:22px;font-weight:700"></div>
      <div class="two">${input(fld('year'),1)}<div><label class="lbl" for="f_odometer">Odometer (km)</label><input id="f_odometer" class="inp" data-d="odometer" type="number" inputmode="numeric" value="${esc(d.odometer)}"></div></div>
      <div class="two">${input(fld('make'),1)}${input(fld('model'),1)}</div>
      <div class="two">${input(fld('badge'))}${input(fld('series'))}</div>
      <div class="two">${input(fld('transmission'))}${input(fld('bodyType'))}</div>
      <div class="two">${input(fld('fuelType'))}${input(fld('colour'))}</div>
      <div class="two">${input(fld('rego'))}${input(fld('regoState'))}</div>
      <div><label class="lbl" for="f_highlights">Highlights <span class="muted" style="font-weight:400">(one per line)</span></label><textarea id="f_highlights" class="inp" data-d="highlights" rows="4" placeholder="Aftermarket exhaust&#10;Professionally lowered&#10;Full service history">${esc(d.highlights)}</textarea></div>
    </div>`;
  if(st===3)body=`<h1 class="page-h h-x">More <span class="red">details</span></h1><p class="page-sub">All optional. Anything left blank is hidden from buyers.</p>
    ${Object.keys(FIELDS).map((k,i)=>{const fs=FIELDS[k].filter(f=>!BASICS.includes(f[0]));if(!fs.length)return'';const filled=fs.filter(f=>String(d[f[0]]??'').trim()).length;
      return `<details class="acc" ${i===0?'open':''}><summary>${SECT[k]} <span class="muted" style="font-family:'Work Sans';font-stretch:normal;font-weight:500;text-transform:none;font-size:13px;margin-left:auto;margin-right:10px">${filled}/${fs.length}</span></summary><div style="padding:0 16px 16px" class="form1">${fs.map(f=>input(f)).join('')}</div></details>`}).join('')}`;
  if(st===4){const miss=[];if(!(d.photos||[]).length)miss.push('No photos');if(!(Number(d.price)>0))miss.push('No price');if(!d.year||!d.make||!d.model)miss.push('Year, make or model missing');
    const ph=(d.photos||[])[0];
    body=`<h1 class="page-h h-x">Review</h1><p class="page-sub">Check it over, then publish.</p>
    <div class="card review">${ph?`<img src="${img(ph)}" alt="">`:''}<div><div class="h-x" style="font-size:16px">${esc(vName(d))}</div><div class="muted" style="font-size:13px;margin-top:4px">${esc([vSub(d),km(d.odometer)].filter(Boolean).join(' · '))}</div><div class="price" style="font-size:22px;margin-top:6px">${money(d.price)||'No price'}</div></div></div>
    <div class="card sect"><ul class="checklist">
      <li class="${(d.photos||[]).length?'':'no'}">${(d.photos||[]).length} photos</li>
      <li class="${Number(d.price)>0?'':'no'}">Price ${money(d.price)||'not set'}</li>
      <li class="${d.year&&d.make&&d.model?'':'no'}">Year, make and model</li>
      <li class="${(d.highlights||'').trim()?'':'no'}">Highlights ${(d.highlights||'').trim()?'added':'(optional)'}</li>
      <li class="${ALL.filter(f=>String(d[f[0]]??'').trim()).length>12?'':'no'}">${ALL.filter(f=>String(d[f[0]]??'').trim()).length} of ${ALL.length} details filled</li>
    </ul>${miss.length?`<p class="err" style="margin-top:12px">${miss.join(' · ')}</p>`:''}</div>
    <button class="btn btn-line btn-block" data-act="draft">Save as draft (hidden)</button>`}
  const isEdit=!!S.editingId, live=isEdit&&d.status!=='draft'&&d.status!=='hidden';
  return `<div style="max-width:760px;margin:0 auto">
    ${d._restored?`<div class="banner">Restored the car you were adding. <button class="btn btn-line btn-sm" data-act="discard" style="margin-left:8px">Start fresh</button></div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:center"><div class="wz-title">${isEdit?'Edit car':'Add a car'} · Step ${st} of 4 · ${STEP_NAMES[st-1]}</div><button class="btn btn-line btn-sm" data-act="cancelWz">Cancel</button></div>
    <div class="wz-steps">${[1,2,3,4].map(i=>`<div class="${i<=st?'on':''}" data-step="${i}" style="cursor:pointer"></div>`).join('')}</div>
    ${body}<div id="wzErr" class="err"></div></div>
    <div class="wz-bar"><div class="in">${st>1?'<button class="btn btn-line" data-act="prev">Back</button>':''}
      ${st<4?`<button class="btn btn-red" data-act="next">${st===1&&!(d.photos||[]).length?'Skip photos for now':'Next'}</button>`:`<button class="btn btn-red" data-act="publish-wz">${live?'Save changes':'Publish'}</button>`}</div></div>`;
}
function pgrid(){const d=S.draft;let h=(d.photos||[]).map((p,i)=>`<div class="pt ${S.selPhoto===i?'sel':''}" data-pi="${i}"><img src="${img(p)}" alt="">${i===0?'<span class="cover">Cover</span>':''}<span class="n">${i+1}</span></div>`).join('');
  for(let i=0;i<S.uploading;i++)h+='<div class="pt loading">Uploading…</div>';return h||'<p class="note" style="grid-column:1/-1;margin:0">No photos yet.</p>'}
function ptools(){const i=S.selPhoto,n=(S.draft.photos||[]).length;if(i<0||i>=n)return n>1?'<p class="note">Tap a photo to make it the cover, move it or remove it.</p>':'';
  return `<div class="ptools"><button class="btn btn-line btn-sm" data-ph="cover" ${i===0?'disabled':''}>★ Make cover</button><button class="btn btn-line btn-sm" data-ph="left" ${i===0?'disabled':''}>← Move</button><button class="btn btn-line btn-sm" data-ph="right" ${i===n-1?'disabled':''}>Move →</button><button class="btn btn-line btn-sm danger" data-ph="del">Remove</button></div>`}
function refreshPh(){const g=document.getElementById('pgrid');if(g)g.innerHTML=pgrid();const t=document.getElementById('ptools');if(t)t.innerHTML=ptools();const nb=document.querySelector('[data-act=next]');if(nb&&S.step===1)nb.textContent=(S.draft.photos||[]).length?'Next':'Skip photos for now';persist()}
let pT;function persist(){if(S.editingId)return;clearTimeout(pT);pT=setTimeout(()=>{const d={...S.draft};delete d._restored;LS.set('pp-draft-new',d)},300)}
async function compress(f){try{const b=await createImageBitmap(f,{imageOrientation:'from-image'});let w=b.width,h=b.height;const r=Math.min(1,1800/Math.max(w,h));w=Math.round(w*r);h=Math.round(h*r);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(b,0,0,w,h);return(await new Promise(res=>c.toBlob(res,'image/jpeg',.84)))||f}catch(e){return f}}
async function addFiles(fs){fs=[...fs].filter(f=>f.type.startsWith('image/')||/\.(heic|heif)$/i.test(f.name));if(!fs.length||!S.assets)return;S.uploading+=fs.length;refreshPh();
  for(const f of fs){try{const r=await S.assets.upload(await compress(f));S.draft.photos.push(r.id)}catch(e){toast('A photo could not be uploaded')}S.uploading--;refreshPh()}}
function wzCheck(step){const d=S.draft;
  if(step===2){if(!(Number(d.price)>0))return['Add a Buy now price.','f_price'];if(!String(d.year).trim())return['Add the year.','f_year'];if(!String(d.make).trim())return['Add the make.','f_make'];if(!String(d.model).trim())return['Add the model.','f_model']}
  return null}
async function saveCar(mode){
  const d=S.draft,err=document.getElementById('wzErr');
  if(S.uploading){err.textContent='Wait for photos to finish uploading.';return}
  let c=null;if(!String(d.year).trim())c=['Add the year.','f_year'];else if(!String(d.make).trim())c=['Add the make.','f_make'];else if(!String(d.model).trim())c=['Add the model.','f_model'];else if(mode==='publish'&&!(Number(d.price)>0))c=['Add a Buy now price.','f_price'];
  if(c){S.step=2;render();window.scrollTo(0,0);setTimeout(()=>{const e=document.getElementById('wzErr');if(e)e.textContent=c[0];document.getElementById(c[1])?.focus()},30);return}
  const id=S.editingId||newId(),b={...d};delete b._restored;
  ['vin','rego'].forEach(k=>{if(b[k])b[k]=String(b[k]).toUpperCase().trim()});
  const sold=b.status==='sold';
  if(mode==='draft'&&!sold)b.status='draft';
  if(mode==='publish'&&!sold){if(b.status!=='available'||!b.publishedAt)b.publishedAt=Date.now();b.status='available'}
  b.createdAt=b.createdAt||Date.now();b.updatedAt=Date.now();
  document.querySelectorAll('.wz-bar button,[data-act=draft]').forEach(x=>x.disabled=true);
  try{await S.db.doc('vehicles/'+id).set(b);if(!S.editingId)LS.del('pp-draft-new');S.draft=null;S.editingId=null;S.step=1;S.selPhoto=-1;toast(mode==='draft'?'Saved as draft':'Car is live!');go('admin-v-'+id)}
  catch(e){document.querySelectorAll('.wz-bar button,[data-act=draft]').forEach(x=>x.disabled=false);err.textContent=e?.code==='quota_exceeded'?'Storage is full. Delete old cars to make room.':'Could not save. Check your signal and try again.'}
}

/* ================= Gallery ================= */
function bindGal(el,onIdx){if(!el)return;let t;el.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(()=>{const i=Math.round(el.scrollLeft/(el.clientWidth||1));onIdx(i)},60)},{passive:true})}
function galTo(el,i,smooth=true){if(!el)return;el.scrollTo({left:i*el.clientWidth,behavior:smooth?'smooth':'auto'})}
function lightbox(photos,start){
  const bg=document.createElement('div');bg.className='lb';
  bg.innerHTML=`<div class="gal" id="lbgal">${photos.map(p=>`<img src="${img(p)}" alt="" draggable="false">`).join('')}</div><button class="x" aria-label="Close">✕</button><span class="gcount" id="lbc">${start+1} / ${photos.length}</span>`;
  document.body.appendChild(bg);const g=bg.querySelector('#lbgal');galTo(g,start,false);
  bindGal(g,i=>{bg.querySelector('#lbc').textContent=`${i+1} / ${photos.length}`});
  const close=()=>{const i=Math.round(g.scrollLeft/(g.clientWidth||1));bg.remove();document.removeEventListener('keydown',k);galTo(document.getElementById('gal'),i,false)};
  const k=e=>{if(e.key==='Escape')close();if(e.key==='ArrowRight')g.scrollBy({left:g.clientWidth,behavior:'smooth'});if(e.key==='ArrowLeft')g.scrollBy({left:-g.clientWidth,behavior:'smooth'})};
  bg.querySelector('.x').onclick=close;document.addEventListener('keydown',k);
}
function curV(){const r=route();const id=r.startsWith('v-')?r.slice(2):r.startsWith('admin-v-')?r.slice(8):null;return id?S.vehicles.find(v=>v.id===id):null}

/* ================= Events ================= */
async function toggleSave(id){if(!S.uid){authSheet('Sign in to save cars to your shortlist.');return}const s=S.saved.includes(id)?S.saved.filter(x=>x!==id):[...S.saved,id];S.saved=s;render(true);if(s.includes(id))toast('Saved');
  try{await S.db.doc('data/users/'+S.uid+'/prefs').set({saved:s})}catch(e){toast('Could not save that')}}
async function upd(id,p,m){try{await S.db.doc('vehicles/'+id).update({...p,updatedAt:Date.now()});toast(m)}catch(e){toast('Could not update')}}
document.addEventListener('click',async e=>{
  const qb=e.target.closest('[data-quick]');if(qb){const ta=document.getElementById('chatTa');if(ta){ta.value=qb.dataset.quick;S.chatDraft=ta.value;ta.focus()}return}
  const t=e.target.closest('[data-go],[data-act],[data-save],[data-af],[data-stage],[data-f],[data-copy],[data-gi],[data-pi],[data-ph],[data-step]');if(!t)return;
  if(t.dataset.save){e.stopPropagation();toggleSave(t.dataset.save);return}
  if(t.dataset.copy){copy(t.dataset.copy,'Email');return}
  if(t.dataset.af){S.aFilter=t.dataset.af;render();return}
  if(t.dataset.stage!==undefined){document.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('on',b===t));document.getElementById('tStage').value=t.dataset.stage;return}
  if(t.dataset.f){const f=t.dataset.f;if(f==='all'){S.make='';S.body=''}else{const[k,...v]=f.split(':');const val=v.join(':');if(k==='make')S.make=S.make===val?'':val;else S.body=S.body===val?'':val}S.show=24;savePrefs();render();return}
  if(t.dataset.gi!==undefined){galTo(document.getElementById('gal'),+t.dataset.gi);return}
  if(t.dataset.pi!==undefined){const i=+t.dataset.pi;S.selPhoto=S.selPhoto===i?-1:i;refreshPh();return}
  if(t.dataset.ph){const i=S.selPhoto,p=S.draft.photos;if(i<0)return;const a=t.dataset.ph;
    if(a==='del'){p.splice(i,1);S.selPhoto=-1}if(a==='cover'){const[x]=p.splice(i,1);p.unshift(x);S.selPhoto=0}
    if(a==='left'&&i>0){[p[i-1],p[i]]=[p[i],p[i-1]];S.selPhoto=i-1}if(a==='right'&&i<p.length-1){[p[i+1],p[i]]=[p[i],p[i+1]];S.selPhoto=i+1}refreshPh();return}
  if(t.dataset.step){const n=+t.dataset.step;if(n>S.step){for(let s=S.step;s<n;s++){const c=wzCheck(s);if(c){document.getElementById('wzErr').textContent=c[0];return}}}S.step=n;render();window.scrollTo(0,0);return}
  const a=t.dataset.act,v=t.dataset.id?S.vehicles.find(x=>x.id===t.dataset.id):null;
  if(a==='share'){e.stopPropagation();share(t.dataset.id);return}
  if(a==='signin'){authSheet();return}
  if(a==='exitPreview'){LS.del('pp-preview');S.isAdmin=true;go('admin');return}
  if(a==='me'){const r=await sheet(`<h3 class="h-x">${esc(S.me?.name||'Your account')}</h3><p>${esc(S.me?.email||'')}</p>${S.realAdmin?`<button class="btn ${S.isAdmin?'btn-red':'btn-line'} btn-block" data-m="toggle" style="margin-bottom:10px">${S.isAdmin?'👀 Switch to customer view':'Back to admin view'}</button>`:''}<div class="row"><button class="btn btn-line" data-m="">Close</button><button class="btn btn-line danger" data-m="out">Sign out</button></div>`);
    if(r==='out'){await window.__sb.auth.signOut();LS.del('pp-preview');location.hash='';location.reload();return}
    if(r==='toggle'){if(S.isAdmin){LS.set('pp-preview',1);S.isAdmin=false;go('')}else{LS.del('pp-preview');S.isAdmin=true;go('admin')}}return}
  if(a==='copyLink'){copy(link(t.dataset.id),'Link');return}
  if(a==='send'){sendMsg(t.dataset.uid);return}
  if(a==='noCar'){S.chatCar=null;t.closest('.about')?.remove();return}
  if(a==='ask'){if(!S.uid){authSheet('Sign in to message our team.');return}S.chatCar=t.dataset.id;go('chat');setTimeout(()=>document.getElementById('chatTa')?.focus(),80);return}
  if(a==='postTrack'){const v2=S.vehicles.find(x=>x.id===t.dataset.id);if(!v2)return;const g=x=>document.getElementById(x).value.trim();
    const stage=+g('tStage'),old=v2.track||{},note=g('tNote'),loc=g('tLoc');
    const lk=g('tLink');if(lk&&!/^https?:\/\//i.test(lk)){toast('Tracking link must start with https://');return}
    const ups=[...(old.updates||[])];if(stage!==(+old.stage||0)||note||loc!==(old.location||''))ups.push({stage,at:Date.now(),note,location:loc});
    t.disabled=true;
    try{await S.db.doc('vehicles/'+v2.id).update({track:{stage,location:loc,eta:g('tEta'),carrier:g('tCar'),ref:g('tRef'),link:lk,updates:ups.slice(-40)},updatedAt:Date.now()});toast('Buyer updated');document.getElementById('tNote').value=''}
    catch(x){toast('Could not post update')}t.disabled=false;return}
  if(t.dataset.go!==undefined){e.preventDefault();if(t.dataset.go==='admin-new'){S.draft=null;S.editingId='__new'}go(t.dataset.go);return}
  if(a==='back'){if(NAV>0)history.back();else go(S.isAdmin&&false?'admin':'');return}
  if(a==='full'){const cv=curV();const g=document.getElementById('gal');if(cv?.photos?.length)lightbox(cv.photos,Math.round(g.scrollLeft/(g.clientWidth||1)));return}
  if(a==='gprev'||a==='gnext'){const g=document.getElementById('gal');g.scrollBy({left:(a==='gnext'?1:-1)*g.clientWidth,behavior:'smooth'});return}
  if(a==='sort'){const r=await sheet(`<h3 class="h-x">Sort by</h3><div class="sortlist">${SORTS.map(([k,l])=>`<button data-m="${k}" class="${S.sort===k?'on':''}">${l}${S.sort===k?' ✓':''}</button>`).join('')}</div>`);if(r){S.sort=r;savePrefs();render()}return}
  if(a==='more'){S.show+=24;render(true);return}
  if(a==='clear'){S.q='';S.make='';S.body='';savePrefs();render();return}
  if(a==='buy'){buyNow(t.dataset.id);return}
  if(a==='next'){const c=wzCheck(S.step);if(c){document.getElementById('wzErr').textContent=c[0];document.getElementById(c[1])?.focus();return}S.step++;render();window.scrollTo(0,0);return}
  if(a==='prev'){S.step--;render();window.scrollTo(0,0);return}
  if(a==='publish-wz'){saveCar('publish');return}
  if(a==='draft'){saveCar('draft');return}
  if(a==='discard'){LS.del('pp-draft-new');S.draft=blank();S.selPhoto=-1;render();return}
  if(a==='cancelWz'){const id=S.editingId;if(!id&&((S.draft?.photos||[]).length||S.draft?.make)){toast('Kept on this phone. Finish it any time.')}S.draft=null;S.editingId=null;S.selPhoto=-1;go(id?'admin-v-'+id:'admin');return}
  if(a==='publish'&&v){if(!(Number(v.price)>0)){toast('Add a price first');S.draft=null;go('admin-edit-'+v.id);return}upd(v.id,{status:'available',publishedAt:Date.now()},'Car is live!');return}
  if(a==='hide'&&v){if(await confirmSheet('Hide this car?',"Buyers won't see it until you publish it again.",'Hide'))upd(v.id,{status:'hidden'},'Hidden');return}
  if(a==='markSold'&&v){const r=await sheet(`<h3 class="h-x">Sold <span class="red">elsewhere</span></h3><p>Buyers will see it as sold.</p><div class="fg"><label class="lbl" for="sn">Note (optional)</label><input id="sn" class="inp" placeholder="e.g. Sold on Marketplace"></div><div class="row"><button class="btn btn-line" data-m="">Cancel</button><button class="btn btn-red" id="snGo">Mark sold</button></div>`,(s,c)=>{s.querySelector('#snGo').onclick=()=>c({n:s.querySelector('#sn').value.trim()})});
    if(r&&typeof r==='object')upd(v.id,{status:'sold',soldAt:Date.now(),soldNote:r.n},'Marked sold');return}
  if(a==='release'&&v){if(!(await confirmSheet('Release this sale?','The car goes back on sale. Let the buyer know first.','Release',true)))return;
    try{await S.db.doc('claims/'+v.id).delete();await S.db.doc('vehicles/'+v.id).update({status:'available',soldAt:null,soldNote:'',track:null,updatedAt:Date.now()});toast('Back on sale')}catch(x){toast('Could not release')}return}
  if(a==='duplicate'&&v){const c=JSON.parse(JSON.stringify(v));['id','track','vin','rego','engineNumber','createdAt','updatedAt','publishedAt','soldAt','soldNote'].forEach(k=>delete c[k]);c.photos=[];c.status='available';LS.del('pp-draft-new');S.dupe=c;S.draft=null;S.editingId='__new';go('admin-new');toast('Copied. Add photos, rego and VIN.');return}
  if(a==='delete'&&v){if(!(await confirmSheet('Delete this car?',`${vName(v)} will be removed for good. This can't be undone.`,'Delete',true)))return;
    try{await S.db.doc('vehicles/'+v.id).delete();await S.db.doc('claims/'+v.id).delete();toast('Deleted');go('admin')}catch(x){toast('Could not delete')}return}
});
let qT;
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='q'){S.q=t.value;S.show=24;clearTimeout(qT);qT=setTimeout(()=>render(true),150)}
  else if(t.id==='aq'){S.aQ=t.value;render(true)}
  else if(t.id==='chatTa'){S.chatDraft=t.value;t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'}
  else if(t.dataset.d&&S.draft){S.draft[t.dataset.d]=t.value;persist();const e2=document.getElementById('wzErr');if(e2)e2.textContent=''}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='camIn'||t.id==='uplIn'){addFiles(t.files);t.value=''}
  else if(t.dataset.d&&S.draft){S.draft[t.dataset.d]=t.value;persist()}});
document.addEventListener('keydown',e=>{if(e.target.id==='chatTa'&&e.key==='Enter'&&!e.shiftKey&&window.matchMedia('(min-width:700px)').matches){e.preventDefault();document.querySelector('[data-act=send]')?.click();return}
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.querySelector('.lb,.sheet-bg'))return;const g=document.getElementById('gal');if(!g)return;
  if(e.key==='ArrowRight')g.scrollBy({left:g.clientWidth,behavior:'smooth'});if(e.key==='ArrowLeft')g.scrollBy({left:-g.clientWidth,behavior:'smooth'})});
function after(r,galIdx){
  const g=document.getElementById('gal');
  if(g){const cv=curV();const n=cv?.photos?.length||0;
    if(galIdx)galTo(g,galIdx,false);
    bindGal(g,i=>{const c=document.getElementById('gcount');if(c)c.textContent=`${i+1} / ${n}`;document.querySelectorAll('#thumbs img').forEach((im,k)=>im.classList.toggle('on',k===i));const th=document.querySelector(`#thumbs img[data-gi="${i}"]`);if(th)th.parentElement.scrollTo({left:Math.max(0,th.offsetLeft-th.parentElement.clientWidth/2+th.clientWidth/2),behavior:'smooth'})});
    g.addEventListener('click',()=>{if(n)lightbox(cv.photos,Math.round(g.scrollLeft/(g.clientWidth||1)))});}
}
boot();
