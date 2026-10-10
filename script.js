// MEMORA Dashboard app logic
/* ============ DATA ============ */
const B2C_CATEGORIES=[
 {id:'couple',icon:'❤️',name:'Couples / Anniversary',tag:'Love stories, told beautifully.'},
 {id:'birthday',icon:'🎂',name:'Birthday',tag:'Turn another year into an experience.'},
 {id:'wedding',icon:'💍',name:'Wedding',tag:'Your big day, everywhere your guests are.'},
 {id:'family',icon:'🫶',name:'Family',tag:'Family stories worth preserving.'},
 {id:'graduation',icon:'🎓',name:'Graduation',tag:'Celebrate the milestone in style.'},
 {id:'celebration',icon:'🎉',name:'Celebration',tag:'Any moment worth marking.'},
 {id:'invitation',icon:'💌',name:'Digital Invitation',tag:'Beautiful invites guests will remember.'},
 {id:'memory',icon:'✨',name:'Memory / Story Website',tag:'A living archive of a story.'}
];
const B2B_CATEGORIES=[
 {id:'cafes',icon:'☕',name:'Cafes'},
 {id:'bakeries',icon:'🍰',name:'Bakeries'},
 {id:'shops',icon:'🛍',name:'Shops'},
 {id:'boutiques',icon:'👗',name:'Boutiques'},
 {id:'startups',icon:'🚀',name:'Startups'},
 {id:'smallbiz',icon:'💼',name:'Small Businesses'},
 {id:'creators',icon:'🎨',name:'Creators'},
 {id:'eventplanners',icon:'📅',name:'Event Planners'},
 {id:'professional',icon:'🏢',name:'Professional Services'}
];
const DEFAULT_B2C_PACKAGES={
 standard:{id:'standard',icon:'🎂',name:'Standard Keepsake',price:'₹4,999',priceNote:'one-time',delivery:'3–5 working days',ideal:'Birthdays, baby showers & small family gatherings',
  features:['Elegant single-page personalized website','Up to 25 photos','Countdown timer','Google Maps venue link','Digital RSVP form','6 months live hosting'],
  specs:{Photos:'Up to 25',Video:'Not included',Music:'Not included','Theme selection':'1 curated theme','Animation level':'Light','Countdown':'Yes','RSVP':'Digital form','Maps':'Google Maps link','Hosting validity':'6 months','Sections / pages':'Single page','Customization':'Standard','Revisions':'1 round'}},
 premium:{id:'premium',icon:'💍',name:'Premium Celebration',price:'₹9,999',priceNote:'one-time',delivery:'5–8 working days',badge:'MOST POPULAR',ideal:'Weddings, silver anniversaries & multi-day functions',
  features:['Multi-page or deep-scrolling experience','Custom domain included','Music integration','Custom animations','Unlimited photos & videos','RSVP collection','1 year live hosting'],
  specs:{Photos:'Unlimited',Video:'Included',Music:'Included','Theme selection':'Multiple themes + palette','Animation level':'Custom animations','Countdown':'Yes','RSVP':'Collection + guest list','Maps':'Interactive map','Hosting validity':'1 year','Sections / pages':'Multi-page / deep-scroll','Customization':'Advanced','Revisions':'2 rounds','Custom domain':'Included'}}
};
const DEFAULT_B2B_PLANS={
 setup:{id:'setup',icon:'🌱',name:'Local Business Setup',price:'₹15,000–₹35,000',priceNote:'one-time setup',delivery:'7–14 working days depending on scope',ideal:'Cafes, shops, boutiques, startups & local services',
  features:['Custom business website planning','Design','Brand asset integration','Custom domain setup','Basic SEO setup','Responsive design','Launch support'],recurring:false},
 basic:{id:'basic',icon:'☁️',name:'Basic Care',priceMonthly:1499,priceNote:'/ month',delivery:'Ongoing',ideal:'Keeping a business site secure, live and lightly updated',
  features:['Cloud hosting','SSL','Monthly backups','Up to 2 small changes / month','Text & image updates','Maintenance'],recurring:true}
};
const DEFAULT_DEMOS=[
 {
  id:1,
  title:'AVIRA — Fashion & Clothing',
  category:'clothing',
  url:'https://avirafashion.netlify.app/',
  desc:'Premium fashion website with modern product presentation, responsive design, interactive experiences and a polished shopping-focused interface.',
  image:'',
  featured:true,
  published:true
 }
];
const ALL_CATS=[...B2C_CATEGORIES.map(c=>({...c,type:'b2c'})),...B2B_CATEGORIES.map(c=>({...c,type:'b2b'}))];

/* ============ STORAGE ============ */
function loadJSON(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v==null?fallback:v}catch(e){return fallback}}
function saveJSON(key,val){localStorage.setItem(key,JSON.stringify(val))}
function getPackages(){const o=loadJSON('memora_pkg_overrides',{});const base=JSON.parse(JSON.stringify(DEFAULT_B2C_PACKAGES));Object.keys(o).forEach(k=>{if(base[k])Object.assign(base[k],o[k])});Object.values(base).forEach(p=>{if(p.available===undefined)p.available=true});return base}
function getPlans(){const o=loadJSON('memora_plan_overrides',{});const base=JSON.parse(JSON.stringify(DEFAULT_B2B_PLANS));Object.keys(o).forEach(k=>{if(base[k])Object.assign(base[k],o[k])});Object.values(base).forEach(p=>{if(p.available===undefined)p.available=true});return base}
function setAvailability(kind,id,available){
 const key=kind==='pkg'?'memora_pkg_overrides':'memora_plan_overrides';
 const o=loadJSON(key,{});o[id]=o[id]||{};o[id].available=available;saveJSON(key,o);
}

/* ============ BACKEND (Firebase — REAL shared, cross-device database) ============
   When window.MEMORA_CONFIG.firebase is filled in (see <head>), every order,
   enquiry and notification is written to Firestore and every open tab/device
   (customer or owner) gets it in real time via onSnapshot listeners below.
   getOrders()/getEnquiries()/getNotifications() still return synchronously
   from a local cache (unchanged call sites everywhere else in this file) —
   that cache is kept live by Firestore, not just by this browser's own writes.
   If Firebase isn't configured, everything silently falls back to the
   original localStorage-only behaviour (single device/browser only). */
let fbApp=null,fbDb=null,fbAuth=null,fbReady=false;
function backendConfigured(){const c=window.MEMORA_CONFIG&&window.MEMORA_CONFIG.firebase;return !!(c&&c.apiKey&&c.projectId)}
function initBackend(){
 if(!backendConfigured())return;
 try{
  fbApp=firebase.initializeApp(window.MEMORA_CONFIG.firebase);
  fbDb=firebase.firestore();
  fbAuth=firebase.auth();
  fbReady=true;
  subscribeCollection('memora_enquiries_coll','memora_enquiries');
  subscribeCollection('memora_notifications_coll','memora_notifications');
  watchCustomerAuth();
 }catch(e){console.error('Firebase init failed — running local-only.',e);fbReady=false}
}
function subscribeCollection(coll,cacheKey){
 fbDb.collection(coll).onSnapshot(snap=>{
  const list=snap.docs.map(d=>d.data()).sort((a,b)=>(b._ts||0)-(a._ts||0));
  saveJSON(cacheKey,list);
  softRefresh();
 },err=>console.error(coll+' sync error (check Firestore rules):',err));
}
function softRefresh(){
 const p=parts();
 if(!p.length&&document.getElementById('app'))return;
 if((p[0]==='studio'&&isOwnerAuthed())||p[0]==='my-booking'){render()}
}
function cloudSet(coll,docId,data){
 if(!fbReady||!docId)return;
 fbDb.collection(coll).doc(String(docId)).set({...data,_ts:data._ts||Date.now()},{merge:true})
  .catch(e=>console.error('Cloud write failed for '+coll+'/'+docId+' — check Firestore rules:',e));
}

/* ---- Customer auth: Firebase Authentication (Email + Password) ----
   PHASE 2A — replaces the old email/mobile OTP prototype entirely.
   currentCustomer() still returns synchronously from a small local cache
   (unchanged call sites everywhere else in this file: the booking wizard,
   enquiry gate, and My Booking all just call currentCustomer()/customerSignOut()
   as before) — that cache is now kept in sync with the real Firebase Auth
   session by watchCustomerAuth() below, instead of being the source of truth
   itself. If Firebase isn't configured yet (see <head>), sign-in simply
   cannot proceed and the form shows a clear message instead of silently
   pretending to work. */
function currentCustomer(){return loadJSON('memora_customer',null)}
function saveCustomerSession(c){saveJSON('memora_customer',c)}
function customerSignOut(){
 if(fbReady&&fbAuth.currentUser){fbAuth.signOut().catch(()=>{})}
 saveCustomerSession(null);
 toast('Signed out.');render();
}


/* ============ CUSTOMER NAVIGATION ============ */
function updateCustomerNav(){
 const area=document.getElementById('customerNavArea');
 const mobileOrder=document.getElementById('mobileMyOrderLink');

 if(!area)return;

 const customer=currentCustomer();

 if(customer){
   area.innerHTML=`
     <div style="display:flex;align-items:center;gap:8px">
       <button class="navbtn outline cartpill" onclick="go('my-booking')">
         My Order
         <span class="cartcount" id="cartCount" style="display:none">0</span>
       </button>

       <button class="navbtn outline" onclick="customerSignOut()">
         Sign Out
       </button>
     </div>
   `;

   if(mobileOrder){
     mobileOrder.style.display='block';
   }

 }else{
   area.innerHTML=`
     <button class="navbtn outline" onclick="openCustomerSignIn()">
       Sign In
     </button>
   `;

   if(mobileOrder){
     mobileOrder.style.display='none';
   }
 }

 updateCartBadge();
}

let customerOrdersUnsubscribe = null;

function subscribeCustomerOrders(uid){

  if(!fbReady || !uid)return;

  if(customerOrdersUnsubscribe){
    customerOrdersUnsubscribe();
    customerOrdersUnsubscribe=null;
  }

  customerOrdersUnsubscribe =
    fbDb
      .collection('memora_orders_coll')
      .where('customerUid','==',uid)
      .onSnapshot(
        snap=>{

          const list =
            snap.docs
              .map(d=>d.data())
              .sort(
                (a,b)=>
                  (b._ts||0)-(a._ts||0)
              );

          saveJSON('memora_orders',list);
          softRefresh();

        },
        err=>{

          console.error(
            'Customer orders sync error:',
            err
          );

        }
      );
}

function watchCustomerAuth(){

  if(!fbReady || !fbAuth)return;

  fbAuth.onAuthStateChanged(user=>{

  if(!user){

    if(customerOrdersUnsubscribe){
      customerOrdersUnsubscribe();
      customerOrdersUnsubscribe=null;
    }

    saveJSON('memora_orders',[]);
    saveCustomerSession(null);
    updateCustomerNav();
    return;
  }
  const profileRef=fbDb.collection('users').doc(user.uid);
  profileRef.get().then(doc=>{
   if(doc.exists){
    const p=doc.data();
    saveCustomerSession({uid:user.uid,email:p.email||user.email||'',name:p.name||'',phone:p.phone||'',whatsapp:p.whatsapp||p.phone||''}); 
    subscribeCustomerOrders(user.uid);
   }else{
    const profile={role:'customer',email:user.email||'',name:'',phone:'',whatsapp:'',createdAt:Date.now()};
    profileRef.set(profile).catch(e=>console.error('Could not create user profile — check Firestore rules:',e));
    saveCustomerSession({uid:user.uid,email:profile.email,name:'',phone:'',whatsapp:''}); 
    subscribeCustomerOrders(user.uid);
   }
   updateCustomerNav();
   softRefresh();
  }).catch(e=>{
   console.error('Could not read user profile — check Firestore rules:',e);
   saveCustomerSession({uid:user.uid,email:user.email||'',name:'',phone:'',whatsapp:''});
  });
 });
}
/* ---- createAccount() ---- */
function signUpCustomer(name,email,phone,password){
 name=(name||'').trim();
 email=(email||'').trim().toLowerCase();
 phone=(phone||'').trim();

 if(!name){
  toast('Please enter your name.');
  return;
 }

 if(!email||!/^\S+@\S+\.\S+$/.test(email)){
  toast('Please enter a valid email.');
  return;
 }

 if(!password||password.length<6){
  toast('Password must be at least 6 characters.');
  return;
 }

 if(!fbReady){
  toast('MEMORA is not connected to Firebase yet — sign-up is unavailable.');
  return;
 }

 fbAuth.createUserWithEmailAndPassword(email,password)
  .then(cred=>{
   const user=cred.user;

   // Firebase automatically signs the customer in here.
   // Save the authentication session immediately.
   saveCustomerSession({
    uid:user.uid,
    email:user.email||email,
    name:name,
    phone:phone,
    whatsapp:phone
   });

   const profile={
    role:'customer',
    email:user.email||email,
    name:name,
    phone:phone,
    whatsapp:phone,
    createdAt:Date.now()
   };

   // Save the customer profile, but don't make a Firestore
   // profile-writing problem look like an authentication failure.
   return fbDb.collection('users').doc(user.uid).set(profile)
    .then(()=>{
     toast('Account created successfully. Welcome, '+name+'!');
     afterCustomerSignIn();
    })
    .catch(e=>{
     console.error('Customer profile could not be saved:',e);

     // Firebase account itself was successfully created.
     toast('Account created successfully. Welcome, '+name+'!');
     afterCustomerSignIn();
    });
  })
  .catch(e=>{
   toast(authErrorMessage(e));
  });
}
/* ---- signIn() ---- */
function signInCustomer(email,password){
 email=(email||'').trim().toLowerCase();

 if(!email||!password){
  toast('Please enter your email and password.');
  return;
 }

 if(!fbReady){
  toast('MEMORA is not connected to Firebase yet — sign-in is unavailable.');
  return;
 }

 fbAuth.signInWithEmailAndPassword(email,password)
  .then(cred=>{
   const user=cred.user;

   // Immediately keep a minimal local session so the UI
   // can continue without waiting for the Firestore profile.
   saveCustomerSession({
    uid:user.uid,
    email:user.email||email,
    name:'',
    phone:'',
    whatsapp:''
   });

   toast('Signed in successfully. Welcome back.');
   afterCustomerSignIn();
  })
  .catch(e=>{
   toast(authErrorMessage(e));
  });
}
function forgotCustomerPassword(){
 const emailInput=document.getElementById('siEmail');
 const email=(emailInput?.value||'').trim();

 if(!email){
  toast('Enter your email address first.');
  if(emailInput)emailInput.focus();
  return;
 }

 if(!fbReady){
  toast('MEMORA is not connected to Firebase yet.');
  return;
 }

 fbAuth.sendPasswordResetEmail(email)
  .then(()=>{
   toast('Password reset email sent. Check your inbox.');
  })
  .catch(e=>{
   const code=e&&e.code||'';

   if(code==='auth/user-not-found'){
    toast('No MEMORA account was found with this email.');
   }else if(code==='auth/invalid-email'){
    toast('Please enter a valid email address.');
   }else if(code==='auth/too-many-requests'){
    toast('Too many attempts. Please wait a moment.');
   }else{
    toast('Could not send the reset email. Please try again.');
   }
  });
}
function authErrorMessage(e){
 const code=e&&e.code||'';
 if(code==='auth/email-already-in-use'){
 authMode='signin';
 setTimeout(()=>{
  const email=document.getElementById('suEmail');
  const enteredEmail=email?email.value.trim():'';

  renderCustomerAuthScreen();

  setTimeout(()=>{
   const siEmail=document.getElementById('siEmail');
   if(siEmail){
    siEmail.value=enteredEmail;
    siEmail.focus();
   }
  },30);
 },0);

 return 'An account already exists. Switching you to Sign In...';
}
 if(code==='auth/invalid-email')return 'Please enter a valid email address.';
 if(code==='auth/weak-password')return 'Password must be at least 6 characters.';
 if(code==='auth/user-not-found'||code==='auth/wrong-password'||code==='auth/invalid-credential')return 'Incorrect email or password.';
 if(code==='auth/too-many-requests')return 'Too many attempts — please wait a moment and try again.';
 return 'Something went wrong ('+(code||e.message||'unknown error')+'). Please try again.';
}
/* Runs whatever the customer was trying to do before they were asked to sign in —
   resumes the order wizard exactly where it was, or finishes a parked enquiry,
   without making them start over (their cart/details/form stay intact). */
function afterCustomerSignIn(){
 closeModal();
 const pendingEnq=loadJSON('memora_pending_enquiry',null);
 if(pendingEnq){localStorage.removeItem('memora_pending_enquiry');finalizeEnquiry(pendingEnq);return}
 const p=parts();
 if(p[0]==='order'){renderWizardStep();return}
 render();
}
function customerAuthBoxHtml(){return `<div class="wizard-card" id="customerAuthBox">${authInnerHtml()}</div>`}
function renderCustomerAuthScreen(){
 const box=document.getElementById('customerAuthBox');
 if(box)box.innerHTML=authInnerHtml();
}
let authMode='signin'; // signin | signup
function setAuthMode(mode){
 authMode=mode;
 renderCustomerAuthScreen();

 // Make sure the newly opened form starts clean.
 setTimeout(()=>{
  const ids=mode==='signin'
   ? ['siEmail','siPassword']
   : ['suName','suEmail','suPhone','suPassword'];

  ids.forEach(id=>{
   const el=document.getElementById(id);
   if(el)el.value='';
  });
 },50);
}
function authInnerHtml(){
 const connWarning=!fbReady?`<p style="color:var(--burgundy);font-size:12.5px;background:#fbeef0;padding:10px;border-radius:10px">MEMORA isn't connected to its account system yet — sign-in/sign-up will not work until Firebase is configured.</p>`:'';
 if(authMode==='signup'){
  return `<h2 style="margin-top:0">Create your MEMORA account</h2>
   ${connWarning}
   <div class="field">
  <label>FULL NAME</label>
  <input
    id="suName"
    placeholder="Your name"
    autocomplete="off"
    value=""
  >
</div>

<div class="field">
  <label>EMAIL</label>
  <input
    id="suEmail"
    type="email"
    placeholder="you@email.com"
    autocomplete="off"
    value=""
  >
</div>

<div class="field">
  <label>MOBILE NUMBER</label>
  <input
    id="suPhone"
    type="tel"
    placeholder="10-digit mobile"
    autocomplete="off"
    value=""
  >
</div>

<div class="field">
  <label>PASSWORD</label>
  <input
    id="suPassword"
    type="password"
    placeholder="At least 6 characters"
    autocomplete="new-password"
    value=""
  >
</div>
   <div class="wizard-nav" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
    <button class="navbtn outline" onclick="setAuthMode('signin')">Already have an account? Sign in</button>
    <button class="navbtn" onclick="signUpCustomer(document.getElementById('suName').value,document.getElementById('suEmail').value,document.getElementById('suPhone').value,document.getElementById('suPassword').value)">Create Account</button>
   </div>`;
 }
 // 'signin'
 return `<h2 style="margin-top:0">Sign in to continue</h2>
  ${connWarning}

  <p style="color:var(--muted);font-size:14px">
    Welcome back to MEMORA. Sign in to access your orders and bookings.
  </p>

  <div class="field">
    <label>EMAIL</label>
    <input
      id="siEmail"
      type="email"
      placeholder="you@email.com"
      autocomplete="off"
      value=""
    >
  </div>

  <div class="field">
    <label>PASSWORD</label>
    <input
      id="siPassword"
      type="password"
      placeholder="Your password"
      autocomplete="new-password"
      value=""
    >
  </div>

  <div style="text-align:right;margin:-4px 0 14px">
    <button
      type="button"
      onclick="forgotCustomerPassword()"
      style="border:0;background:none;color:var(--burgundy);font-size:13px;font-weight:700;cursor:pointer;padding:0"
    >
      Forgot password?
    </button>
  </div>

  <div class="wizard-nav" style="justify-content:space-between;flex-wrap:wrap;gap:10px">

   <button
     class="navbtn outline"
     onclick="setAuthMode('signup')"
   >
     New here? Create account
   </button>

   <button
     class="navbtn"
     onclick="signInCustomer(
       document.getElementById('siEmail').value,
       document.getElementById('siPassword').value
     )"
   >
     Sign In
   </button>

  </div>`;
}
function customerSignInFormHtml(){
 authMode='signin';
 return customerAuthBoxHtml();
}
function openCustomerSignIn(){
 authMode='signin';

 showModal(`
   <div style="text-align:left">
     ${customerSignInFormHtml()}
   </div>
 `);

 setTimeout(()=>{
  const email=document.getElementById('siEmail');
  const password=document.getElementById('siPassword');

  if(email)email.value='';
  if(password)password.value='';

  if(email)email.focus();
 },50);
}

/* ============ IDS ============ */
function pad(n,len){return String(n).padStart(len,'0')}
function newOrderId(){
 const c=loadJSON('memora_id_counter',{orders:0});c.orders=(c.orders||0)+1;saveJSON('memora_id_counter',c);
 const d=new Date();const ymd=`${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}`;
 return `MEM-${ymd}-${pad(c.orders,3)}`;
}
function newEnquiryId(){
 const c=loadJSON('memora_id_counter',{enquiries:0});c.enquiries=(c.enquiries||0)+1;saveJSON('memora_id_counter',c);
 const d=new Date();const ymd=`${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}`;
 return `ENQ-${ymd}-${pad(c.enquiries,3)}`;
}
function fmtDateTime(ts){
 if(!ts)return '—';
 const d=new Date(ts);
 return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})+', '+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}

/* ============ ORDERS ============ */
function getOrders(){return loadJSON('memora_orders',[])}
function saveOrders(o){saveJSON('memora_orders',o)}
function getOrder(id){return getOrders().find(o=>o.orderId===id)}
function createOrderRecord(order){
 const orders=getOrders();orders.unshift(order);saveOrders(orders);
 cloudSet('memora_orders_coll',order.orderId,order);
}
function updateOrder(id,patch){
 const orders=getOrders();const i=orders.findIndex(o=>o.orderId===id);
 if(i<0)return;
 Object.assign(orders[i],patch);
 saveOrders(orders);
 cloudSet('memora_orders_coll',id,{...patch,orderId:id});
}
function myOrderIds(){
 const c=currentCustomer();
 if(c&&c.uid){return getOrders().filter(o=>o.customerUid===c.uid).map(o=>o.orderId)}
 return loadJSON('memora_my_orders',[]);
}
function addMyOrderId(id){const ids=loadJSON('memora_my_orders',[]);ids.push(id);saveJSON('memora_my_orders',ids)}
const ORDER_STAGES=['ENQUIRY','PENDING REVIEW','ACCEPTED — PAYMENT PENDING','CONFIRMED','IN PROGRESS','DELIVERED','COMPLETED'];
const TIMELINE_STEPS=[
  'Enquiry Received',
  'Order Reviewed',
  'Order Accepted',
  'Advance Payment Requested',
  'Advance Payment Received',
  'Booking Confirmed',
  'Work Started',
  'Website Ready',
  '90% Payment Requested',
  '90% Payment Received',
  'Delivered',
  'Completed'
];
function stageIndexForStatus(status, paymentStatus){
  if(status==='CANCELLED'||status==='REFUNDED')return -1;

  const map={
    'ENQUIRY':1,
    'PENDING REVIEW':2,
    'ACCEPTED — PAYMENT PENDING':4,
    'CONFIRMED':6,
    'IN PROGRESS':7,
    'DELIVERED':11,
    'COMPLETED':12
  };

  // Delivered and Completed must override payment status
  if(status==='DELIVERED')return 11;
  if(status==='COMPLETED')return 12;

  // Final payment stages apply before delivery/completion
  if(paymentStatus==='FULL PAYMENT RECEIVED'){
    return 10;
  }

  if(paymentStatus==='FINAL PAYMENT DUE'){
    return 9;
  }

  return map[status]||0;
}
function calcAdvance(amount){
 const advance=Math.round(amount*0.10*100)/100;
 const remaining=Math.round((amount-advance)*100)/100;
 return {advance,remaining};
}
/* Bug fix: a naive digit-strip on a price RANGE (e.g. "₹15,000–₹35,000") concatenates both
   bounds into one huge number (₹1,50,00,35,000). We take only the first number group instead,
   so a range always resolves to its lower bound. */
function amountNumber(priceStr){
 const m=String(priceStr).match(/[\d][\d,]*/);
 if(!m)return 0;
 return parseInt(m[0].replace(/,/g,''),10)||0;
}

/* ============ UPI PAYMENT ============ */
/* Prototype payment flow only — no real payment gateway or automatic verification is
   connected. The customer must submit a UTR after paying; the owner manually confirms
   receipt in Creator Studio before a booking is marked CONFIRMED / FULL PAYMENT RECEIVED. */
const UPI_ID='nikitamanjul@ybl';
/* Set this to a real backend base URL (e.g. 'https://api.memora.example') to enable the
   production adapters below (email, WhatsApp, payment gateway). Left empty, every adapter
   safely no-ops and the app stays on its mailto:/wa.me/UPI-intent fallback. NEVER put a
   secret API key, payment gateway secret, or WhatsApp API token in this file — those belong
   on the backend as environment variables, never in client-side HTML/JS. */
const BACKEND_API_BASE='';
/* Flip to true only once a real gateway (Razorpay / PhonePe Payment Gateway / etc.) is wired
   up on your backend at POST /api/payments/create-order + POST /api/payments/verify. */
const PAYMENT_GATEWAY_CONFIGURED=false;
function buildUpiUri(order,stage){
 stage=stage==='FINAL'?'FINAL':'ADVANCE';
 const amt=stage==='FINAL'?order.remaining:order.advance;
 const am=Number(amt).toFixed(2);
 const note=stage==='FINAL'?'MEMORA final payment ':'MEMORA booking advance ';
 return `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent('MEMORA')}&tr=${encodeURIComponent(order.orderId+(stage==='FINAL'?'-FINAL':''))}&am=${am}&cu=INR&tn=${encodeURIComponent(note+order.orderId)}`;
}
/* Central payment entry point per the spec: startPayment(order, stage). stage is
   'ADVANCE' or 'FINAL'. This is where a real gateway call (startGatewayPayment) would plug
   in; until PAYMENT_GATEWAY_CONFIGURED is true it is transparent about being a prototype and
   falls back to the UPI intent link — it never claims payment succeeded. */
function startPayment(orderId,stage){
 const o=getOrder(orderId);if(!o)return;
 if(PAYMENT_GATEWAY_CONFIGURED){
  startGatewayPayment(o,stage);
  return;
 }
 toast('Payment gateway is not connected in this prototype — opening UPI payment instead.');
 setTimeout(()=>{window.location.href=buildUpiUri(o,stage)},600);
}
/* Production adapter placeholder — POST /api/payments/create-order + POST /api/payments/verify.
   Do not put PAYMENT_GATEWAY_KEY_ID / PAYMENT_GATEWAY_SECRET here; those live on the backend. */
function startGatewayPayment(order,stage){
 if(!BACKEND_API_BASE)return;
 const amount=stage==='FINAL'?order.remaining:order.advance;
 fetch(`${BACKEND_API_BASE}/api/payments/create-order`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.orderId,stage,amount})})
  .then(r=>r.json()).then(data=>{ if(data&&data.checkoutUrl)window.location.href=data.checkoutUrl; })
  .catch(()=>{toast('Payment gateway request failed — opening UPI payment instead.');window.location.href=buildUpiUri(order,stage)});
}
function copyUpiId(){
 if(navigator.clipboard){navigator.clipboard.writeText(UPI_ID).then(()=>toast('UPI ID copied.')).catch(()=>toast('UPI ID: '+UPI_ID))}
 else{toast('UPI ID: '+UPI_ID)}
}
function showPaymentProofForm(orderId){
 const box=document.getElementById('payProofBox-'+orderId);
 if(box)box.style.display='block';
}
function submitPaymentProof(orderId){
 const utr=document.getElementById('utrInput-'+orderId).value.trim();
 const pdate=document.getElementById('payDateInput-'+orderId).value;
 const ptime=document.getElementById('payTimeInput-'+orderId).value;
 if(!utr){alert('Please enter the UTR / Transaction ID.');return}
 updateOrder(orderId,{utr,paymentDate:pdate,paymentTime:ptime,paymentSubmittedAt:Date.now(),paymentStatus:'PENDING'});
 toast('Payment details submitted — awaiting verification.');
 go('my-booking/'+orderId);
}
function showFinalPaymentProofForm(orderId){
 const box=document.getElementById('finalPayProofBox-'+orderId);
 if(box)box.style.display='block';
}
function submitFinalPaymentProof(orderId){
 const utr=document.getElementById('finalUtrInput-'+orderId).value.trim();
 const pdate=document.getElementById('finalPayDateInput-'+orderId).value;
 const ptime=document.getElementById('finalPayTimeInput-'+orderId).value;
 if(!utr){alert('Please enter the UTR / Transaction ID.');return}
 updateOrder(orderId,{finalUtr:utr,finalPaymentDate:pdate,finalPaymentTime:ptime,finalPaymentSubmittedAt:Date.now()});
 toast('Final payment details submitted — awaiting verification.');
 go('my-booking/'+orderId);
}
function paymentSectionHtml(o){
 if(o.status==='ENQUIRY'||o.status==='PENDING REVIEW'){
  return `<div class="summary-box" style="text-align:left">
   <b style="color:var(--navy)">Payment — Locked</b>
   <p style="margin:6px 0 0">Payment will become available after MEMORA accepts your booking request.</p>
  </div>`;
 }
 if(o.status==='ACCEPTED — PAYMENT PENDING'&&o.paymentStatus!=='ADVANCE RECEIVED'&&o.paymentStatus!=='PAID'){
  if(o.paymentSubmittedAt){
   return `<div class="summary-box" style="border-color:var(--gold);text-align:left">
    <b style="color:var(--navy)">Payment verification pending</b>
    <p style="margin:6px 0 0">We've received your payment details. MEMORA will verify the payment and confirm your booking shortly.</p>
    <div class="spec-grid" style="margin-top:10px">
     <div class="spec-row"><div>UTR / Transaction ID</div><div>${escapeHtml(o.utr||'—')}</div></div>
     <div class="spec-row"><div>Payment date</div><div>${escapeHtml(o.paymentDate||'—')}</div></div>
     <div class="spec-row"><div>Payment time</div><div>${escapeHtml(o.paymentTime||'—')}</div></div>
    </div>
   </div>`;
  }
  return advancePaymentHtml(o);
 }
 if(o.paymentStatus==='FINAL PAYMENT DUE'){
  if(o.finalPaymentSubmittedAt){
   return `<div class="summary-box" style="border-color:var(--gold);text-align:left">
    <b style="color:var(--navy)">Final payment verification pending</b>
    <p style="margin:6px 0 0">We've received your final payment details. MEMORA will verify it shortly.</p>
    <div class="spec-grid" style="margin-top:10px">
     <div class="spec-row"><div>UTR / Transaction ID</div><div>${escapeHtml(o.finalUtr||'—')}</div></div>
     <div class="spec-row"><div>Payment date</div><div>${escapeHtml(o.finalPaymentDate||'—')}</div></div>
     <div class="spec-row"><div>Payment time</div><div>${escapeHtml(o.finalPaymentTime||'—')}</div></div>
    </div>
   </div>`;
  }
  return finalPaymentHtml(o);
 }
 if(o.paymentStatus==='FULL PAYMENT RECEIVED'){
  return `<div class="summary-box" style="text-align:left"><b style="color:var(--navy)">✓ Full payment received</b><p style="margin:6px 0 0">Thank you — your order is fully paid.</p></div>`;
 }
 return '';
}
function advancePaymentHtml(o){
 const uri=buildUpiUri(o,'ADVANCE');
 return `<div class="summary-box" style="border-color:var(--gold);text-align:left">
  <b style="color:var(--navy)">Confirm Your Booking</b>
  <p style="margin:6px 0 12px">Your MEMORA booking has been accepted. Confirm it by paying the 10% booking advance below — this amount is part of your total order price and will be deducted from your remaining balance.</p>
  <div class="totalrow" style="border-top:0;padding-top:0;margin-top:0"><span>Booking Advance — 10%</span><span>${money(o.advance)}</span></div>
  <div style="margin:14px 0">
   <button class="navbtn" style="width:100%" onclick="startPayment('${o.orderId}','ADVANCE')">PAY 10% ADVANCE WITH PHONEPE</button>
  </div>
  <p style="font-size:11.5px;color:var(--muted);margin:0 0 14px">On Android, this attempts to open PhonePe or another UPI app with the amount pre-filled. If nothing opens (e.g. on desktop), use UPI Payment below instead — this does not mean payment failed or succeeded either way.</p>
  <div style="border-top:1px dashed #d9cdbb;padding-top:14px">
   <b style="color:var(--navy);font-size:14px">UPI Payment</b>
   <p style="font-size:12.5px;color:var(--muted);margin:6px 0 10px">On desktop, copy the UPI ID or scan a QR code using your phone.</p>
   <p style="font-size:13px;margin:0 0 10px">UPI ID: <b style="color:var(--navy)">${UPI_ID}</b></p>
   <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="navbtn outline" onclick="copyUpiId()">Copy UPI ID</button>
    <a href="${escapeAttr(uri)}" class="navbtn outline" style="text-decoration:none;display:inline-block;text-align:center">Open UPI Payment</a>
   </div>
   <div style="margin-top:14px;text-align:center">
    <div style="font-size:11px;font-weight:800;letter-spacing:.3px;color:var(--muted);margin-bottom:6px">SCAN TO PAY — 10% BOOKING ADVANCE — ${money(o.advance)}</div>
    ${qrPlaceholderHtml()}
   </div>
  </div>
  <p style="font-size:11px;color:var(--muted);margin-top:14px">Clicking a payment button does not confirm your payment was received — MEMORA verifies every payment manually below.</p>
  <div style="margin-top:14px;border-top:1px dashed #d9cdbb;padding-top:14px">
   <button class="navbtn outline" onclick="showPaymentProofForm('${o.orderId}')">I Have Completed Payment</button>
   <div id="payProofBox-${o.orderId}" style="display:none;margin-top:12px">
    <div class="subhead" style="margin:0 0 8px;font-size:16px">Payment Verification</div>
    <div class="field"><label>UTR / TRANSACTION ID</label><input id="utrInput-${o.orderId}" placeholder="e.g. 123456789012"></div>
    <div class="form-grid">
     <div class="field"><label>PAYMENT DATE</label><input type="date" id="payDateInput-${o.orderId}"></div>
     <div class="field"><label>PAYMENT TIME</label><input type="time" id="payTimeInput-${o.orderId}"></div>
    </div>
    <button class="navbtn" onclick="submitPaymentProof('${o.orderId}')">Submit Payment Details</button>
   </div>
  </div>
 </div>`;
}
function finalPaymentHtml(o){
 const uri=buildUpiUri(o,'FINAL');
 return `<div class="summary-box" style="border-color:var(--gold);text-align:left">
  <b style="color:var(--navy)">Final Payment Due</b>
  <p style="margin:6px 0 12px">Your project has reached the final payment stage. Pay the remaining 90% below to complete your order.</p>
  <div class="totalrow" style="border-top:0;padding-top:0;margin-top:0"><span>Remaining Balance — 90%</span><span>${money(o.remaining)}</span></div>
  <div style="margin:14px 0">
   <button class="navbtn" style="width:100%" onclick="startPayment('${o.orderId}','FINAL')">PAY REMAINING 90%</button>
  </div>
  <div style="border-top:1px dashed #d9cdbb;padding-top:14px">
   <b style="color:var(--navy);font-size:14px">UPI Payment</b>
   <p style="font-size:13px;margin:6px 0 10px">UPI ID: <b style="color:var(--navy)">${UPI_ID}</b></p>
   <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="navbtn outline" onclick="copyUpiId()">Copy UPI ID</button>
    <a href="${escapeAttr(uri)}" class="navbtn outline" style="text-decoration:none;display:inline-block;text-align:center">Open UPI Payment</a>
   </div>
  </div>
  <p style="font-size:11px;color:var(--muted);margin-top:14px">Clicking a payment button does not confirm your payment was received — MEMORA verifies every payment manually below.</p>
  <div style="margin-top:14px;border-top:1px dashed #d9cdbb;padding-top:14px">
   <button class="navbtn outline" onclick="showFinalPaymentProofForm('${o.orderId}')">I Have Completed Payment</button>
   <div id="finalPayProofBox-${o.orderId}" style="display:none;margin-top:12px">
    <div class="subhead" style="margin:0 0 8px;font-size:16px">Final Payment Verification</div>
    <div class="field"><label>UTR / TRANSACTION ID</label><input id="finalUtrInput-${o.orderId}" placeholder="e.g. 123456789012"></div>
    <div class="form-grid">
     <div class="field"><label>PAYMENT DATE</label><input type="date" id="finalPayDateInput-${o.orderId}"></div>
     <div class="field"><label>PAYMENT TIME</label><input type="time" id="finalPayTimeInput-${o.orderId}"></div>
    </div>
    <button class="navbtn" onclick="submitFinalPaymentProof('${o.orderId}')">Submit Payment Details</button>
   </div>
  </div>
 </div>`;
}
/* MEMORA's real PhonePe/UPI "scan & pay" QR (owner-supplied), embedded as a data URI so it
   works offline and needs no external QR-generation library. Same fixed QR is shown for both
   the 10% advance and the 90% final payment — the exact amount to pay is always shown as text
   above it (a static QR image cannot encode a dynamic amount), and the UPI "Open UPI Payment"
   button above still carries the correct pre-filled amount for apps that support UPI deep links. */
const MEMORA_QR_DATA_URI='data:image/png;base64,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atSoMXDQIAepjTQNaD7N2et0Oq+77rpjx4+fVmCMKYQwxt9/992JEycUKxnG+IorrmjQsKEoiogYUEmSDh08+OmCBTLLmrzvrVGjxujRox0OB06nJwihRDJZo0aNcvWkJlSzZs0uvPBCxfMURTVs1OjW4cNJDwuer1mz5oIFC2iahh6BQRFE0e/3X3755WrwgNPpvP7664+fOMHJuU0RkiTJ6XLVqFGDHDWZFvXqq69u1ry5glOPQmjNDz8cOnRIz2YhjDHP832vvnrDhg0KWANFUYlEQr2cSpI0a9as/gMGqLMV3X333VM/+MCfny/ziwLS/e233x41erT68x9/9NH999+fn58vf5dhmGAwOGLEiNffeMP8NNiwYcO111wjO7FkUxOJhJqfrFGjRj//8otmBjCr5cZ//evrr78m4SQAQJ0zZ06fK6+sOlvCfXv3XnbZZST1mtob5Xk+HA5369Zt3LhxvXr3pihKEARgeqMoqri4eNmyZfPmzVu9enUoFFL4AurVLm2+rDZt2gwePPjaa6+FuQR/JWvL8ur/mjVrBg8cyJkAlAJzUefOnb9aujRj3huyDOjff82aNYoze4zxgk8/7d69u/r50aNHT582LT8vT3YSGZqORKMffvjhjcOGmf/urJkzR4wYUa4ehgkGg8OGDZv+0Ufm5fn777/3ueIKMmcqiOic9u2/X7nS6/XmjpVh+K23Ll68mJxQNE2Hw+Fp06cPGjQozdi4XC51syD2of280+nz+bwE3grOp0EXyZNp+Fkm81UUTVInvRASMG3qKaLX61UsLMlk0uPxRKNRn8+XsdxP5yXU8XjB1qsP4yu+gIjSkvxCUwsLC3/++ecbbrhhyJAho++8U44liaJYt27dW2655ZZbbtm5c+eqVau+/fbbDRs27N2719I9vjp16rRp06Znz549e/bs0aMHwIBlU6UGLlAEoETvZqs2ZRjD6GmFgaAikUheXp5aK0wSnKflw4rH4/BXxUrPsixMHHKWUimsgBktgmdESVLWwzCQ/FlPjdXuCE3TyUTC6/VyHEcarLKogs58scr1rvi0LHNjLnU27bRUr04GIQwpxbFPKpns5JO8YvJtRj0H1zy3jnF4W51nUNaYbOh70uYllHmpck2YZTJaZKYZEPoFOz5z5szFixf379//jlGjunTpAhMmmUwihFq3bt26devb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';
function qrPlaceholderHtml(){
 return `<div style="width:190px;height:190px;margin:0 auto;border-radius:12px;overflow:hidden;background:#fff;padding:6px;box-shadow:0 1px 6px rgba(0,0,0,.08)"><img src="${MEMORA_QR_DATA_URI}" alt="MEMORA PhonePe / UPI payment QR — nikitamanjul@ybl" style="width:100%;height:100%;object-fit:contain;display:block"></div>`;
}

/* ============ ENQUIRIES ============ */
function getEnquiries(){return loadJSON('memora_enquiries',[])}
function saveEnquiries(e){saveJSON('memora_enquiries',e)}
function createEnquiryRecord(enq){
 const list=getEnquiries();list.unshift(enq);saveEnquiries(list);
 cloudSet('memora_enquiries_coll',enq.enquiryId,{...enq,_ts:enq.createdAt});
}
function updateEnquiry(id,patch){
 const list=getEnquiries();const i=list.findIndex(x=>x.enquiryId===id);
 if(i<0)return;
 Object.assign(list[i],patch);
 saveEnquiries(list);
 cloudSet('memora_enquiries_coll',id,{...patch,enquiryId:id});
}

/* ============ OWNER AUTH ============ */
/* Prototype authentication — replace with server-side authentication before production. */
/* This is a client-side gate only. It does NOT provide real security: anyone with
   browser devtools access can read this code. Do not store real secrets here. */
const OWNER_USERNAME='nikita_manjul26';
const OWNER_PASSCODE='Bappa@9926';
function isOwnerAuthed(){return sessionStorage.getItem('memora_owner_session')==='active'}
function ownerLogin(){
 const user=document.getElementById('ownerUser').value.trim();
 const val=document.getElementById('ownerPass').value;
 if(user===OWNER_USERNAME&&val===OWNER_PASSCODE){
  sessionStorage.setItem('memora_owner_session','active');
  toast('Welcome back.');
  go('studio');
 }else{
  document.getElementById('ownerLoginErr').style.display='block';
 }
}
function ownerLogout(){
 sessionStorage.removeItem('memora_owner_session');
 toast('Logged out of Creator Studio.');
 go('');
}
function getDemos(){return loadJSON('memora_demos',DEFAULT_DEMOS)}
function saveDemos(d){saveJSON('memora_demos',d)}
function getCart(){return loadJSON('memora_cart',[])}
function saveCart(c){saveJSON('memora_cart',c);updateCartBadge()}

/* ============ ROUTER ============ */
function go(hash){
 const target='#/'+hash;
 if(window.location.hash===target){render()}else{window.location.hash=target}
}
function goHref(href){go(String(href||'').replace(/^\/+/,''))}
window.addEventListener('hashchange',render);
window.addEventListener('DOMContentLoaded',()=>{
  initBackend();
  render();
  updateCustomerNav();
  updateCartBadge();
});

function parts(){return window.location.hash.replace(/^#\/?/,'').split('/').filter(Boolean)}
function render(){
 window.scrollTo(0,0);
 const p=parts();const app=document.getElementById('app');
 highlightNav(p[0]||'');
 closeMobile();
 if(!p.length){app.innerHTML=viewHome();return}
 if(p[0]==='b2c'){app.innerHTML=p[1]?viewCategory('b2c',p[1]):viewOverview('b2c');return}
 if(p[0]==='b2b'){app.innerHTML=p[1]?viewCategory('b2b',p[1]):viewOverview('b2b');return}
 if(p[0]==='creations'){app.innerHTML=viewCreations(p[1]||'all');return}
 if(p[0]==='how-it-works'){app.innerHTML=viewHowItWorks();return}
 if(p[0]==='pricing'){app.innerHTML=viewPricing();return}
 if(p[0]==='order'){app.innerHTML=viewOrder();wizardStep=cartHasItems()?1:0;renderWizardStep();return}
 if(p[0]==='my-booking'){app.innerHTML=viewMyBooking(p[1]);return}
 if(p[0]==='contact'){app.innerHTML=viewContact();return}
 if(p[0]==='terms'){app.innerHTML=viewTerms();return}
 if(p[0]==='privacy'){app.innerHTML=viewPrivacy();return}
 if(p[0]==='studio'){
  window.location.href='owner.html';
  return;
}
 app.innerHTML=viewHome();
}
function highlightNav(r){
 document.querySelectorAll('#navlinks a').forEach(a=>{a.classList.toggle('active',a.dataset.r===r)});
}
function toggleMobile(){document.getElementById('mobilePanel').classList.toggle('open')}
function closeMobile(){document.getElementById('mobilePanel').classList.remove('open')}

/* ============ SHARED BITS ============ */
function breadcrumb(items){
 return `<div class="breadcrumbs">`+items.map((it,i)=>{
   const sep=i<items.length-1?'<span>/</span>':'';
   return it.href?`<a href="javascript:void(0)" onclick="goHref('${it.href}');return false">${it.label}</a>${sep}`:`${it.label}`;
 }).join('')+`</div>`;
}
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(s){return escapeHtml(s).replace(/javascript:/gi,'')}
function toast(msg){const x=document.getElementById('toast');x.textContent=msg;x.style.display='block';clearTimeout(window._toastT);window._toastT=setTimeout(()=>x.style.display='none',2600)}
function showModal(html){document.getElementById('modalBox').innerHTML=html;document.getElementById('modalOverlay').classList.add('open')}
function closeModal(){document.getElementById('modalOverlay').classList.remove('open')}
function money(n){return '₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2})}
function statusClass(status){
 const m={'ENQUIRY':'status-enquiry','PENDING REVIEW':'status-review','ACCEPTED — PAYMENT PENDING':'status-accepted','CONFIRMED':'status-confirmed','IN PROGRESS':'status-progress','DELIVERED':'status-delivered','COMPLETED':'status-completed','CANCELLED':'status-cancelled','REFUNDED':'status-refunded'};
 return m[status]||'status-enquiry';
}
function timelineHtml(order){
 if(order.status==='CANCELLED'||order.status==='REFUNDED'){
  return `<div class="b-timeline"><div class="b-tstep done"><div class="b-tdot">✕</div><div class="b-tlabel">Booking ${order.status==='CANCELLED'?'Cancelled':'Refunded'}</div></div></div>`;
 }
 const idx=stageIndexForStatus(order.status,order.paymentStatus);
 return `<div class="b-timeline">${TIMELINE_STEPS.map((label,i)=>{
  const n=i+1;const cls=n<idx?'done':(n===idx?'current done':'');
  return `<div class="b-tstep ${cls}"><div class="b-tdot">${n<=idx?'✓':n}</div><div class="b-tlabel">${label}</div></div>`;
 }).join('')}</div>`;
}
function catById(id){return ALL_CATS.find(c=>c.id===id)}

/* ============ HOME ============ */
function viewHome(){
 const demos=getDemos().filter(d=>d.published).slice(0,3);
 return `
 <header class="hero">
   <div>
     <div class="eyebrow">Personalized digital experiences</div>
     <h1>Your memories,<br><i>turned into a website.</i></h1>
     <p>Beautiful, personalized digital experiences for the moments that matter — and a polished digital presence for the businesses you're building.</p>
     <div class="hero-actions">
       <button class="navbtn" onclick="go('b2c')">Explore Experiences</button>
       <button class="navbtn outline" onclick="go('contact')">Create With MEMORA</button>
     </div>
   </div>
 </header>

 <section class="section tight">
  <div class="section-head"><div class="eyebrow">Two ways to work with MEMORA</div><h2>Choose your path.</h2></div>
  <div class="pathrow">
   <a class="pathcard" href="javascript:void(0)" onclick="go('b2c');return false"><div class="icon">💌</div><h3>Personal Experiences</h3><p>Birthdays, weddings, anniversaries, graduations, invitations and story websites — built around your memories.</p><div class="go">Explore B2C →</div></a>
   <a class="pathcard" href="javascript:void(0)" onclick="go('b2b');return false"><div class="icon">🏢</div><h3>Business Websites</h3><p>Cafes, boutiques, startups and small businesses — a polished website plus ongoing care.</p><div class="go">Explore B2B →</div></a>
   <a class="pathcard" href="javascript:void(0)" onclick="go('creations');return false"><div class="icon">✨</div><h3>Creations</h3><p>Real MEMORA websites, built for real people and businesses. See the craft for yourself.</p><div class="go">View Creations →</div></a>
  </div>
 </section>

 <section class="section">
  <div class="section-head"><div class="eyebrow">What's possible</div><h2>A website that feels like you.</h2></div>
  <div class="feature-grid">
   <div class="feature">💌<b>Storytelling</b><span>Timeline, letters, chapters and cinematic reveals.</span></div>
   <div class="feature">📸<b>Memories</b><span>Photos, videos, music and meaningful messages.</span></div>
   <div class="feature">📍<b>Event Ready</b><span>Countdowns, venue maps, RSVP and sharing.</span></div>
   <div class="feature">💻<b>Business Ready</b><span>Professional pages, brand assets and ongoing updates.</span></div>
  </div>
 </section>

 <section class="section">
  <div class="section-head"><div class="eyebrow">Featured</div><h2>MEMORA Creations</h2></div>
  ${demos.length?`<div class="demo-grid">${demos.map(demoCard).join('')}</div>`:emptyState('✨','No creations published yet.')}
  <div style="text-align:center;margin-top:28px"><button class="navbtn outline" onclick="go('creations')">View all Creations →</button></div>
 </section>

 <section class="section" id="contact"><div class="contact">
  <div class="eyebrow" style="color:var(--gold)">MEMORA</div><h2>Have a story worth remembering?</h2>
  <p>Tell us what you have in mind. We'll turn the idea into a digital experience.</p>
  <p><a href="mailto:hello@memora.example">hello@memora.example</a></p>
  <button class="goldbtn" onclick="go('order')">Start an Order</button>
 </div></section>
 `;
}

/* ============ OVERVIEW (choose category) ============ */
function viewOverview(type){
 const cats=type==='b2c'?B2C_CATEGORIES:B2B_CATEGORIES;
 const title=type==='b2c'?'Personal Experiences':'Business Websites';
 const sub=type==='b2c'?'Choose the moment you want to turn into a website.':'MEMORA designs, builds and cares for your business website — choose your category to see packages.';
 const icon=type==='b2c'?'💌':'🏢';
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:title}])}
 <div class="pagehero"><div class="icon">${icon}</div><h1>${title}</h1><p style="color:var(--muted);font-size:16px;margin-top:14px">${sub}</p></div>
 <section class="section tight">
   <div class="catgrid">
     ${cats.map(c=>`<a class="catcard" href="javascript:void(0)" onclick="go('${type}/${c.id}');return false"><span class="icon">${c.icon}</span><b>${c.name}</b></a>`).join('')}
   </div>
 </section>
 <section class="section" style="padding-top:0">
   <div class="section-head"><div class="eyebrow">Every category includes</div><h2>${type==='b2c'?'The same premium standard, every time.':'A real website plus ongoing care.'}</h2></div>
   <div class="feature-grid">
    ${type==='b2c'?`
     <div class="feature">📦<b>2 clear packages</b><span>Standard and Premium — pick what fits the moment.</span></div>
     <div class="feature">⏱<b>Transparent delivery</b><span>Every package shows its estimated delivery time upfront.</span></div>
     <div class="feature">🎨<b>Full customization</b><span>Theme, colors, photos, music and structure — all yours to choose.</span></div>
     <div class="feature">🧾<b>Simple ordering</b><span>Add to cart, review your order and send your enquiry in minutes.</span></div>`
     :`
     <div class="feature">🛠<b>Setup + care</b><span>A one-time build, then optional monthly maintenance plans.</span></div>
     <div class="feature">🔍<b>SEO-ready</b><span>Basic SEO included on every build.</span></div>
     <div class="feature">📱<b>Responsive by default</b><span>Looks sharp on mobile, tablet and desktop.</span></div>
     <div class="feature">🧾<b>Flexible billing</b><span>Monthly or annual — switch anytime during onboarding.</span></div>`}
   </div>
 </section>
 `;
}

/* ============ CATEGORY DETAIL ============ */
function viewCategory(type,catId){
 const cat=catById(catId);
 if(!cat){return `<div class="section"><div class="empty-state"><span class="icon">🔎</span>Category not found.<br><button class="navbtn" style="margin-top:14px" onclick="go(''+'${type}')">Back to ${type.toUpperCase()}</button></div></div>`}
 const typeLabel=type==='b2c'?'Personal Experiences':'Business Websites';
 const demoCount=getDemos().filter(d=>d.published&&d.category===catId).length;
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:typeLabel,href:'/'+type},{label:cat.name}])}
 <div class="pagehero"><div class="icon">${cat.icon}</div><h1>${cat.name}${type==='b2c'?' Experiences':' Websites'}</h1>
   <p style="color:var(--muted);font-size:16px;margin-top:10px">${type==='b2c'?(cat.tag||''):'A custom business website plus ongoing care — designed for '+cat.name.toLowerCase()+'.'}</p>
 </div>
 <section class="section tight">
  ${type==='b2c'?monthlyToggleNote() : annualToggleRow()}
  <div class="grid" id="pkgGrid">${type==='b2c'?renderB2CCards(catId):renderB2BCards(catId,false)}</div>
 </section>
 <section class="section" style="padding-top:0">
  <div class="section-head"><div class="eyebrow">Real examples</div><h2>${cat.name} demos</h2></div>
  ${demoCount?`<div style="text-align:center"><button class="navbtn outline" onclick="go('creations/${catId}')">View ${demoCount} ${cat.name} demo${demoCount>1?'s':''} →</button></div>`:emptyState(cat.icon,'No published '+cat.name.toLowerCase()+' demos yet — check back soon.')}
 </section>
 `;
}
function monthlyToggleNote(){return '';}
function annualToggleRow(){
 return `<div class="toggle-wrap"><span class="on" id="lblMonthly">Monthly</span><button class="switch" id="annualSwitch" onclick="toggleAnnual()"><span class="dot"></span></button><span id="lblAnnual">Annual (2 months free)</span></div>`;
}
let annualBilling=false;
function toggleAnnual(){
 annualBilling=!annualBilling;
 document.getElementById('annualSwitch').classList.toggle('on',annualBilling);
 document.getElementById('lblMonthly').classList.toggle('on',!annualBilling);
 document.getElementById('lblAnnual').classList.toggle('on',annualBilling);
 const grid=document.getElementById('pkgGrid');
 if(grid){const catId=parts()[1];grid.innerHTML=renderB2BCards(catId,false)}
 const pg=document.getElementById('pkgGridPricing');
 if(pg){pg.innerHTML=renderB2BCards(null,true)}
}
function renderB2CCards(catId){
 const pk=getPackages();
 return Object.values(pk).map(p=>`
  <div class="card ${p.badge?'popular':''}">
   ${p.badge?`<div class="badge">${p.badge}</div>`:''}
   <div class="icon">${p.icon}</div>
   <h3>${p.name}</h3>
   <div class="ideal">${p.ideal}</div>
   <div class="price">${p.price} <span>${p.priceNote}</span></div>
   <div class="delivery-chip">⏱ ${p.delivery}</div>
   <ul>${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
   <div class="spec-grid">${Object.entries(p.specs).map(([k,v])=>`<div class="spec-row"><div>${k}</div><div>${v}</div></div>`).join('')}</div>
   <div class="btnrow">${p.available?`
    <button onclick="addToCart('b2c','${catId||''}','${p.id}')">Add to Cart</button>
    <button class="ghost" onclick="orderNow('b2c','${catId||''}','${p.id}')">Order Now</button>`:`
    <button disabled style="opacity:.55;cursor:not-allowed">Currently Unavailable</button>
    <button class="ghost" onclick="go('contact')">Enquire Instead</button>`}
   </div>
  </div>`).join('');
}
function renderB2BCards(catId,forPricingPage){
 const pl=getPlans();
 return Object.values(pl).map(p=>{
  let priceHtml;
  if(p.recurring){
   const shown=annualBilling?(p.priceMonthly*10):p.priceMonthly;
   priceHtml=`<div class="price">₹${shown.toLocaleString('en-IN')} <span>${annualBilling?'/ year':'/ month'}</span></div>`;
  }else{
   priceHtml=`<div class="price">${p.price} <span>${p.priceNote}</span></div>`;
  }
  return `
  <div class="card ${p.badge?'popular':''}">
   ${p.badge?`<div class="badge">${p.badge}</div>`:''}
   <div class="icon">${p.icon}</div>
   <h3>${p.name}</h3>
   <div class="ideal">${p.ideal}</div>
   ${priceHtml}
   <div class="delivery-chip">⏱ ${p.delivery}</div>
   <ul>${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
   <div class="btnrow">${p.available?`
    <button onclick="addToCart('b2b','${catId||''}','${p.id}')">Add to Cart</button>
    <button class="ghost" onclick="orderNow('b2b','${catId||''}','${p.id}')">Order Now</button>`:`
    <button disabled style="opacity:.55;cursor:not-allowed">Currently Unavailable</button>
    <button class="ghost" onclick="go('contact')">Enquire Instead</button>`}
   </div>
  </div>`;
 }).join('');
}

/* ============ PRICING PAGE ============ */
function viewPricing(){
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:'Pricing'}])}
 <div class="pagehero"><div class="icon">🧾</div><h1>Simple, transparent pricing</h1><p style="color:var(--muted);font-size:16px;margin-top:10px">Compare B2C and B2B packages side by side. Final scope and price are always confirmed before production.</p></div>
 <section class="section tight">
  <div class="tabs"><button class="tab active" onclick="switchPricingTab('b2c',this)">B2C · Personal & Events</button><button class="tab" onclick="switchPricingTab('b2b',this)">B2B · Businesses</button></div>
  <div id="pricingB2C"><div class="grid">${renderB2CCards(null)}</div></div>
  <div id="pricingB2B" style="display:none">
   ${annualToggleRow()}
   <div class="grid" id="pkgGridPricing">${renderB2BCards(null,true)}</div>
  </div>
 </section>
 `;
}
function switchPricingTab(mode,btn){
 document.getElementById('pricingB2C').style.display=mode==='b2c'?'block':'none';
 document.getElementById('pricingB2B').style.display=mode==='b2b'?'block':'none';
 document.querySelectorAll('#pricingB2C, #pricingB2B').forEach(()=>{});
 btn.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
 btn.classList.add('active');
}

/* ============ HOW IT WORKS ============ */
function viewHowItWorks(){
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:'How It Works'}])}
 <div class="pagehero"><div class="icon">🧭</div><h1>From idea to experience.</h1></div>
 <section class="section tight">
  <div class="process">
   <div class="step"><div class="num">1</div><h3>Choose</h3><p>Pick a B2C package or B2B plan for your moment or business.</p></div>
   <div class="step"><div class="num">2</div><h3>Tell us</h3><p>Share your photos, videos, story, brand or requirements.</p></div>
   <div class="step"><div class="num">3</div><h3>We craft</h3><p>MEMORA designs and builds the experience.</p></div>
   <div class="step"><div class="num">4</div><h3>Review</h3><p>You review the details and request changes.</p></div>
   <div class="step"><div class="num">5</div><h3>Launch</h3><p>Your website goes live and is ready to share.</p></div>
  </div>
 </section>
 <section class="section" style="padding-top:0">
  <div class="section-head"><div class="eyebrow">Ready?</div><h2>Start your MEMORA order.</h2></div>
  <div style="text-align:center"><button class="navbtn" onclick="go('order')">Go to My Order</button></div>
 </section>
 `;
}

/* ============ CREATIONS ============ */
function demoCard(d){
 const cat=catById(d.category);
 const img=d.image?`style="background-image:url('${escapeAttr(d.image)}')"`:'';
 return `<div class="demo">
  <div class="demo-img" ${img}>${d.image?'':(cat?cat.icon:'✨')}</div>
  <div class="demo-body">
   <small>${cat?cat.name:'MEMORA Creation'}</small>
   <h3>${escapeHtml(d.title)}</h3>
   <p>${escapeHtml(d.desc)}</p>
   <div class="demo-tags">${d.featured?'<span class="pill gold">Featured</span>':''}</div>
   ${d.url?`<a class="viewlink" href="${escapeAttr(d.url)}" target="_blank" rel="noopener">View live website ↗</a>`:''}
  </div>
 </div>`;
}
function viewCreations(filter){
 const demos=getDemos().filter(d=>d.published);
 const cats=[...new Set(demos.map(d=>d.category))].map(catById).filter(Boolean);
 const shown=filter==='all'?demos:demos.filter(d=>d.category===filter);
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:'Creations'}])}
 <div class="pagehero"><div class="icon">✨</div><h1>MEMORA Creations</h1><p style="color:var(--muted);font-size:16px;margin-top:10px">Real websites MEMORA has created — a growing portfolio, not a template gallery.</p></div>
 <section class="section tight">
  <div class="demo-filterbar">
   <button class="${filter==='all'?'active':''}" onclick="go('creations')">All</button>
   ${cats.map(c=>`<button class="${filter===c.id?'active':''}" onclick="go('creations/${c.id}')">${c.icon} ${c.name}</button>`).join('')}
  </div>
  ${shown.length?`<div class="demo-grid">${shown.map(demoCard).join('')}</div>`:emptyState('✨','No creations in this category yet.')}
 </section>
 `;
}
function emptyState(icon,msg){return `<div class="empty-state"><span class="icon">${icon}</span>${msg}</div>`}

/* ============ CONTACT ============ */
function viewContact(){
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:'Contact'}])}
 <section class="section tight"><div class="contact">
  <div class="eyebrow" style="color:var(--gold)">MEMORA</div><h2>Let's talk about your website.</h2>
  <p>Email us directly, or start a full order with all your details.</p>
  <p><a href="mailto:hello@memora.example">hello@memora.example</a></p>
  <button class="goldbtn" onclick="go('order')">Start an Order</button>
 </div></section>
 <section class="section tight">
  <div class="section-head"><div class="eyebrow">Not ready to book yet?</div><h2>Have questions? Send an Enquiry.</h2><p>Tell us what you're thinking, and we'll help you figure out the right package — no commitment needed.</p></div>
  <div class="wizard-card" id="enquiryFormCard">
   <div class="form-grid">
    <div class="field"><label>NAME</label><input id="eqName" placeholder="Your name"></div>
    <div class="field"><label>EMAIL</label><input id="eqEmail" type="email" placeholder="you@example.com"></div>
    <div class="field"><label>WHATSAPP</label><input id="eqWhatsapp" placeholder="+91 ..."></div>
    <div class="field"><label>INTERESTED IN</label><select id="eqOrderType"><option value="B2C">B2C — Personal Experience</option><option value="B2B">B2B — Business Website</option></select></div>
    <div class="field"><label>CATEGORY</label><input id="eqCategory" placeholder="e.g. Wedding, Cafe"></div>
    <div class="field"><label>DESIRED PACKAGE</label><input id="eqPackage" placeholder="e.g. Premium Celebration"></div>
    <div class="field"><label>EVENT / BUSINESS DATE</label><input id="eqDate" type="date"></div>
    <div class="field"><label>BUDGET (OPTIONAL)</label><input id="eqBudget" placeholder="e.g. ₹10,000"></div>
    <div class="field full"><label>REQUIREMENTS / QUESTIONS / MESSAGE</label><textarea id="eqMessage" rows="3" placeholder="Tell us more"></textarea></div>
   </div>
   <div class="wizard-nav" style="justify-content:flex-end"><button class="navbtn" onclick="submitEnquiry()">Send Enquiry</button></div>
  </div>
 </section>
 `;
}
function submitEnquiry(){
 const val=id=>{const el=document.getElementById(id);return el?el.value.trim():''};
 const name=val('eqName'),email=val('eqEmail');
 if(!name||!email){alert('Please add your name and email.');return}
 const data={name,email,whatsapp:val('eqWhatsapp'),orderType:val('eqOrderType'),category:val('eqCategory'),package:val('eqPackage'),date:val('eqDate'),budget:val('eqBudget'),message:val('eqMessage')};
 if(!currentCustomer()){
  saveJSON('memora_pending_enquiry',data);
  showEnquiryAuthGate();
  return;
 }
 finalizeEnquiry(data);
}
function showEnquiryAuthGate(){
 authMode='signin';
 const card=document.getElementById('enquiryFormCard');
 if(card){card.innerHTML=`<div id="customerAuthBox">${authInnerHtml()}</div>`;card.scrollIntoView({behavior:'smooth',block:'center'})}
}
function finalizeEnquiry(data){
 const cust=currentCustomer();
 const enq={
  enquiryId:newEnquiryId(),createdAt:Date.now(),
  ...data,interest:data.orderType,status:'NEW',
  customerUid:(cust&&cust.uid)||''
 };
 createEnquiryRecord(enq);
 sendEnquiryEmail(enq);
 showModal(`<div class="icon">💌</div><h2>Enquiry sent.</h2><p>Thank you — MEMORA will review your questions and get back to you shortly at ${escapeHtml(enq.email)}.</p><div class="modal-summary"><div class="row"><span>Enquiry ID</span><b>${enq.enquiryId}</b></div></div><button class="navbtn" onclick="closeModal();go('contact')">Close</button>`);
}

/* ============ CART ============ */
function cartHasItems(){return getCart().length>0}
function updateCartBadge(){
 const n=getCart().length;const el=document.getElementById('cartCount');
 if(!el)return; el.style.display=n?'grid':'none'; el.textContent=n;
}
function addToCart(type,catId,pkgId){
 const cat=catById(catId);
 const item=type==='b2c'?getPackages()[pkgId]:getPlans()[pkgId];
 if(!item)return;
 if(item.available===false){toast('This package is currently unavailable.');return}
 const cart=getCart();
 let price,priceLabel;
 if(type==='b2c'){price=item.price;priceLabel=item.priceNote}
 else if(item.recurring){const amt=annualBilling?item.priceMonthly*10:item.priceMonthly;price='₹'+amt.toLocaleString('en-IN');priceLabel=annualBilling?'/ year':'/ month'}
 else{price=item.price;priceLabel=item.priceNote}
 cart.push({uid:Date.now()+Math.random(),type,categoryId:catId||'',categoryName:cat?cat.name:(type==='b2c'?'General':'General Business'),pkgId,pkgName:item.name,price,priceLabel,delivery:item.delivery});
 saveCart(cart);
 toast(`${item.name} added to your order.`);
}
function orderNow(type,catId,pkgId){addToCart(type,catId,pkgId);go('order')}
function removeCartItem(uid){const cart=getCart().filter(c=>c.uid!==uid);saveCart(cart);renderWizardStep()}

/* ============ ORDER WIZARD ============ */
let wizardStep=0;
function viewOrder(){
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:'My Order'}])}
 <div class="pagehero"><div class="icon">🧾</div><h1>My MEMORA Order</h1></div>
 <section class="section tight">
  <div class="stepper" id="stepper"></div>
  <div id="wizardBody"></div>
 </section>
 `;
}
const STEP_LABELS=['Review Cart','Your Details','Order Summary','Confirm'];
function renderStepper(){
 document.getElementById('stepper').innerHTML=STEP_LABELS.map((l,i)=>{
  const n=i+1;const cls=n===wizardStep?'active':(n<wizardStep?'done':'');
  return `<div class="stepdot ${cls}"><span class="n">${n<wizardStep?'✓':n}</span>${l}</div>`;
 }).join('');
}
function renderWizardStep(){
 const body=document.getElementById('wizardBody');
 if(!body)return;
 const cart=getCart();
 if(!cart.length){
  body.innerHTML=`<div class="wizard-card">${emptyState('🛒','Your order is empty.')}<div style="text-align:center;margin-top:18px"><button class="navbtn" onclick="go('b2c')">Explore Experiences</button> <button class="navbtn outline" onclick="go('b2b')">Explore Businesses</button></div></div>`;
  document.getElementById('stepper').innerHTML='';
  return;
 }
 if(!currentCustomer()){
  body.innerHTML=customerSignInFormHtml();
  document.getElementById('stepper').innerHTML='';
  return;
 }
 if(wizardStep<1)wizardStep=1;
 renderStepper();
 const cust=currentCustomer();
 if(cust&&(cust.email||cust.phone)){
  const bar=document.createElement('div');
  bar.style.cssText='text-align:right;font-size:12px;color:var(--muted);margin-bottom:6px';
  bar.innerHTML=`Signed in as ${escapeHtml(cust.email||cust.phone)} · <a href="javascript:void(0)" onclick="customerSignOut()" style="color:var(--burgundy);font-weight:700">Sign out</a>`;
  body.parentNode.insertBefore(bar,body);
 }
 if(wizardStep===1)return renderStep1();
 if(wizardStep===2)return renderStep2();
 if(wizardStep===3)return renderStep3();
 if(wizardStep===4)return renderStep4();
}
function renderStep1(){
 const cart=getCart();
 document.getElementById('wizardBody').innerHTML=`
 <div class="wizard-card">
  <h2 style="margin-top:0">Review your selections</h2>
  ${cart.map(c=>`<div class="cartline"><div><b>${escapeHtml(c.pkgName)}</b><small>${escapeHtml(c.categoryName)} · ${escapeHtml(c.type.toUpperCase())} · ⏱ ${escapeHtml(c.delivery)}</small></div><div style="text-align:right"><div>${escapeHtml(c.price)} <small>${escapeHtml(c.priceLabel)}</small></div><button class="remove" onclick="removeCartItem(${JSON.stringify(c.uid)})">Remove</button></div></div>`).join('')}
  <div class="wizard-nav"><span></span><button class="navbtn" onclick="wizardStep=2;renderWizardStep()">Continue →</button></div>
 </div>`;
}
function renderStep2(){
 const cart=getCart();
 const hasB2C=cart.some(c=>c.type==='b2c'), hasB2B=cart.some(c=>c.type==='b2b');
 const saved=loadJSON('memora_order_details',{});
 document.getElementById('wizardBody').innerHTML=`
 <div class="wizard-card">
  <h2 style="margin-top:0">Your details</h2>
  <div class="form-grid">
   <div class="field"><label>YOUR NAME</label><input id="ofName" value="${escapeAttr(saved.ofName||'')}" placeholder="Your name"></div>
   <div class="field"><label>EMAIL</label><input id="ofEmail" type="email" value="${escapeAttr(saved.ofEmail||'')}" placeholder="you@example.com"></div>
   <div class="field"><label>WHATSAPP NUMBER</label><input id="ofPhone" value="${escapeAttr(saved.ofPhone||'')}" placeholder="+91 ..."></div>
  </div>
  ${hasB2C?`
  <div class="subhead">Event details</div>
  <div class="form-grid">
   <div class="field"><label>EVENT TYPE</label><input id="cEventType" value="${escapeAttr(saved.cEventType||'')}" placeholder="e.g. Birthday, Wedding"></div>
   <div class="field"><label>EVENT DATE</label><input id="cEventDate" type="date" value="${escapeAttr(saved.cEventDate||'')}"></div>
   <div class="field"><label>NUMBER OF PHOTOS</label><input id="cPhotos" value="${escapeAttr(saved.cPhotos||'')}" placeholder="e.g. 30"></div>
   <div class="field"><label>NUMBER OF VIDEOS</label><input id="cVideos" value="${escapeAttr(saved.cVideos||'')}" placeholder="e.g. 2"></div>
   <div class="field"><label>MUSIC REQUIRED?</label><select id="cMusic"><option ${saved.cMusic==='Yes'?'selected':''}>Yes</option><option ${saved.cMusic==='No'?'selected':''}>No</option></select></div>
   <div class="field"><label>THEME / STYLE</label><input id="cTheme" value="${escapeAttr(saved.cTheme||'')}" placeholder="Romantic, royal, minimal, pastel..."></div>
   <div class="field"><label>PREFERRED COLORS</label><input id="cColors" value="${escapeAttr(saved.cColors||'')}" placeholder="e.g. navy & gold"></div>
   <div class="field"><label>NUMBER OF SECTIONS/PAGES</label><input id="cSections" value="${escapeAttr(saved.cSections||'')}" placeholder="e.g. 4"></div>
   <div class="field"><label>CUSTOM DOMAIN REQUIRED?</label><select id="cDomain"><option ${saved.cDomain==='Yes'?'selected':''}>Yes</option><option ${saved.cDomain==='No'?'selected':''}>No</option></select></div>
   <div class="field"><label>RSVP REQUIRED?</label><select id="cRsvp"><option ${saved.cRsvp==='Yes'?'selected':''}>Yes</option><option ${saved.cRsvp==='No'?'selected':''}>No</option></select></div>
   <div class="field full"><label>VENUE / LOCATION</label><input id="cVenue" value="${escapeAttr(saved.cVenue||'')}" placeholder="Venue name / address"></div>
   <div class="field full"><label>SPECIAL MESSAGE</label><textarea id="cMessage" rows="2" placeholder="A note, quote or story you want featured">${escapeHtml(saved.cMessage||'')}</textarea></div>
  </div>`:''}
  ${hasB2B?`
  <div class="subhead">Business details</div>
  <div class="form-grid">
   <div class="field"><label>BUSINESS NAME</label><input id="bName" value="${escapeAttr(saved.bName||'')}" placeholder="Business name"></div>
   <div class="field"><label>BUSINESS CATEGORY</label><input id="bCategory" value="${escapeAttr(saved.bCategory||'')}" placeholder="e.g. Cafe, Boutique"></div>
   <div class="field"><label>OWNER / CONTACT NAME</label><input id="bOwner" value="${escapeAttr(saved.bOwner||'')}" placeholder="Contact person"></div>
   <div class="field"><label>EXISTING WEBSITE?</label><input id="bExisting" value="${escapeAttr(saved.bExisting||'')}" placeholder="URL or 'No'"></div>
   <div class="field"><label>DOMAIN?</label><input id="bDomain" value="${escapeAttr(saved.bDomain||'')}" placeholder="Owned domain, or 'need one'"></div>
   <div class="field"><label>LOGO AVAILABLE?</label><select id="bLogo"><option ${saved.bLogo==='Yes'?'selected':''}>Yes</option><option ${saved.bLogo==='No'?'selected':''}>No</option></select></div>
   <div class="field"><label>BRAND COLORS</label><input id="bColors" value="${escapeAttr(saved.bColors||'')}" placeholder="e.g. green & cream"></div>
   <div class="field"><label>REQUIRED PAGES</label><input id="bPages" value="${escapeAttr(saved.bPages||'')}" placeholder="e.g. Home, Menu, Contact"></div>
   <div class="field"><label>WHATSAPP INTEGRATION?</label><select id="bWhatsapp"><option ${saved.bWhatsapp==='Yes'?'selected':''}>Yes</option><option ${saved.bWhatsapp==='No'?'selected':''}>No</option></select></div>
   <div class="field"><label>CONTACT FORMS?</label><select id="bForms"><option ${saved.bForms==='Yes'?'selected':''}>Yes</option><option ${saved.bForms==='No'?'selected':''}>No</option></select></div>
   <div class="field"><label>SEO REQUIREMENT?</label><select id="bSeo"><option ${saved.bSeo==='Yes'?'selected':''}>Yes</option><option ${saved.bSeo==='No'?'selected':''}>No</option></select></div>
   <div class="field"><label>MONTHLY MAINTENANCE PLAN?</label><input id="bMaint" value="${escapeAttr(saved.bMaint||'')}" placeholder="Basic Care / None"></div>
   <div class="field full"><label>SERVICES / MENU / PRODUCTS</label><textarea id="bServices" rows="2" placeholder="What you offer">${escapeHtml(saved.bServices||'')}</textarea></div>
  </div>`:''}
  <div class="field full"><label>ADDITIONAL REQUIREMENTS</label><textarea id="ofExtra" rows="2" placeholder="Anything else MEMORA should know">${escapeHtml(saved.ofExtra||'')}</textarea></div>
  <div class="wizard-nav"><button class="navbtn outline" onclick="wizardStep=1;renderWizardStep()">← Back</button><button class="navbtn" onclick="saveStep2AndContinue()">Continue →</button></div>
 </div>`;
}
function saveStep2AndContinue(){
 const ids=['ofName','ofEmail','ofPhone','cEventType','cEventDate','cPhotos','cVideos','cMusic','cTheme','cColors','cSections','cDomain','cRsvp','cVenue','cMessage','bName','bCategory','bOwner','bExisting','bDomain','bLogo','bColors','bPages','bWhatsapp','bForms','bSeo','bMaint','bServices','ofExtra'];
 const data={};
 ids.forEach(id=>{const el=document.getElementById(id);if(el)data[id]=el.value});
 if(!data.ofName||!data.ofEmail){alert('Please enter your name and email.');return}
 saveJSON('memora_order_details',data);
 wizardStep=3;renderWizardStep();
}
function renderStep3(){
 const cart=getCart();
 const oneTime=cart.filter(c=>!c.priceLabel.includes('month')&&!c.priceLabel.includes('year'));
 const recurring=cart.filter(c=>c.priceLabel.includes('month')||c.priceLabel.includes('year'));
 document.getElementById('wizardBody').innerHTML=`
 <div class="wizard-card">
  <h2 style="margin-top:0">Order summary</h2>
  <div class="eyebrow">MEMORA</div>
  ${cart.map(c=>`<div class="cartline"><div><b>${escapeHtml(c.pkgName)}</b><small>${escapeHtml(c.categoryName)}</small></div><div>${escapeHtml(c.price)} <small>${escapeHtml(c.priceLabel)}</small></div></div>`).join('')}
  <div class="summary-box">
   ${oneTime.length?`<div class="totalrow"><span>One-time total (approx.)</span><span>${sumPrices(oneTime)}</span></div>`:''}
   ${recurring.length?`<div class="totalrow"><span>Recurring total</span><span>${sumPrices(recurring)} ${annualBilling?'/ year':'/ month'}</span></div>`:''}
   <p style="color:var(--muted);font-size:12.5px;margin:10px 0 0">Estimated delivery: ${cart.map(c=>c.delivery).join(' · ')}. Final scope, price and delivery date are confirmed by MEMORA before production begins.</p>
  </div>
  ${advanceBoxHtml(cart)}
  <p style="color:var(--muted);font-size:12px;line-height:1.6">By continuing you agree to MEMORA's <a href="javascript:void(0)" onclick="go('terms');return false" style="color:var(--burgundy);font-weight:700">Terms &amp; Conditions</a> and <a href="javascript:void(0)" onclick="go('privacy');return false" style="color:var(--burgundy);font-weight:700">Privacy Policy</a>, including the 24-hour cancellation window on the booking advance.</p>
  <div class="wizard-nav"><button class="navbtn outline" onclick="wizardStep=2;renderWizardStep()">← Back</button><button class="navbtn" onclick="wizardStep=4;renderWizardStep()">Continue →</button></div>
 </div>`;
}
function cartTotalAmount(cart){return cart.reduce((sum,c)=>sum+amountNumber(c.price),0)}
function advanceBoxHtml(cart){
 const total=cartTotalAmount(cart);
 const {advance,remaining}=calcAdvance(total);
 return `<div class="summary-box" style="border-color:var(--gold)">
  <div class="totalrow" style="border-top:0;padding-top:0;margin-top:0"><span>Original order price</span><span>${money(total)}</span></div>
  <div class="totalrow" style="color:var(--burgundy)"><span>Booking Advance — 10%</span><span>${money(advance)}</span></div>
  <div class="totalrow"><span>Remaining Balance — 90%</span><span>${money(remaining)}</span></div>
  <p style="color:var(--muted);font-size:12px;margin:10px 0 0">Your 10% booking advance is part of your total order amount and will be deducted from the remaining balance. The advance is only required once MEMORA has reviewed and accepted your order.</p>
 </div>`;
}
function sumPrices(items){
 let total=0,hasPlus=false;
 items.forEach(c=>{const n=parseInt(String(c.price).replace(/[^\d]/g,''))||0;total+=n;if(String(c.price).includes('+'))hasPlus=true});
 return '₹'+total.toLocaleString('en-IN')+(hasPlus?'+':'');
}
function renderStep4(){
 document.getElementById('wizardBody').innerHTML=`
 <div class="wizard-card" style="text-align:center">
  <h2 style="margin-top:0">Ready to send</h2>
  <p style="color:var(--muted)">Submitting creates your MEMORA order. MEMORA will review it and get back to you before any payment is requested.</p>
  <div style="display:flex;flex-direction:column;gap:12px;max-width:360px;margin:20px auto 0">
   <button class="navbtn" onclick="submitOrder()">Submit My Order</button>
   <a class="navbtn outline" ...instagram...>
  <div class="wizard-nav" style="justify-content:center;margin-top:26px"><button class="navbtn outline" onclick="wizardStep=3;renderWizardStep()">← Back to Summary</button></div>
 </div>`;
}
function submitOrder(){
 const cart=getCart();const d=loadJSON('memora_order_details',{});
 if(!cart.length||!d.ofName||!d.ofEmail){toast('Please complete your details first.');wizardStep=2;renderWizardStep();return}
 const total=cartTotalAmount(cart);
 const {advance,remaining}=calcAdvance(total);
 const orderId=newOrderId();
 const now=Date.now();
 const cust=currentCustomer();
 const order={
  orderId,createdAt:now,_ts:now,
  customerUid:cust&&cust.uid||'',
  customerName:d.ofName,customerEmail:d.ofEmail,customerPhone:d.ofPhone||'',customerWhatsapp:(cust&&cust.whatsapp)||d.ofPhone||'',
  orderType:cart.some(c=>c.type==='b2b')?(cart.some(c=>c.type==='b2c')?'B2C + B2B':'B2B'):'B2C',
  items:cart,category:cart.map(c=>c.categoryName).join(', '),
  packageSummary:cart.map(c=>c.pkgName).join(', '),
  amount:total,advance,remaining,
  eventDate:d.cEventDate||'',
  delivery:cart.map(c=>c.delivery).join(' · '),
  status:'PENDING REVIEW',paymentStatus:'NOT REQUIRED YET',
  notes:'',requirements:d.ofExtra||'',
  details:d,
  acceptedAt:null,confirmedAt:null,cancellationDeadline:null
 };
 createOrderRecord(order);
 addMyOrderId(orderId);
 saveCart([]);
 sendOrderEmail(order);
 sendCustomerEmail(orderId,'REQUEST_RECEIVED');
 showModal(`
  <div class="icon">📩</div>
  <h2>Booking Request Received</h2>
  <p>Thank you for choosing MEMORA. Your booking request has been received and is now under review. No payment is required at this stage — MEMORA will review your request first.</p>
  <div class="modal-summary">
   <div class="row"><span>Order ID</span><b>${order.orderId}</b></div>
   <div class="row"><span>Package</span><b>${escapeHtml(order.packageSummary)}</b></div>
   <div class="row"><span>Original price</span><b>${money(order.amount)}</b></div>
   <div class="row"><span>Status</span><b>PENDING REVIEW</b></div>
  </div>
  <button class="navbtn" onclick="closeModal();go('my-booking/'+'${order.orderId}')">View My Booking</button>
 `);
 wizardStep=1;
}
/* Email flow — prototype only.
   This uses a mailto: link, which opens the visitor's own email app; it is NOT
   automated server-side email delivery. Before production, replace this function's
   body with a call to a real transactional email service (EmailJS, Resend,
   SendGrid, or a Supabase/Firebase function) so MEMORA reliably receives every
   order and enquiry without depending on the customer's device/email client. */
function sendOrderEmail(order){
 const d=order.details||{};const cart=order.items||[];
 const lines=[];
 lines.push('Hello MEMORA,');
 lines.push('');
 lines.push(`New order — ${order.orderId}`);
 lines.push('I would like to place the following order:');
 cart.forEach(c=>lines.push(`- ${c.pkgName} (${c.categoryName}) — ${c.price} ${c.priceLabel}, est. delivery ${c.delivery}`));
 lines.push('');
 lines.push(`Order price: ${money(order.amount)}  |  10% advance: ${money(order.advance)}  |  Remaining: ${money(order.remaining)}`);
 lines.push('');
 lines.push(`Name: ${d.ofName||''}`);
 lines.push(`Email: ${d.ofEmail||''}`);
 lines.push(`WhatsApp: ${d.ofPhone||''}`);
 if(cart.some(c=>c.type==='b2c')){
  lines.push('');lines.push('Event details:');
  lines.push(`Event type: ${d.cEventType||''}`);lines.push(`Event date: ${d.cEventDate||''}`);
  lines.push(`Photos: ${d.cPhotos||''}`);lines.push(`Videos: ${d.cVideos||''}`);lines.push(`Music required: ${d.cMusic||''}`);
  lines.push(`Theme/style: ${d.cTheme||''}`);lines.push(`Preferred colors: ${d.cColors||''}`);lines.push(`Sections/pages: ${d.cSections||''}`);
  lines.push(`Custom domain: ${d.cDomain||''}`);lines.push(`RSVP required: ${d.cRsvp||''}`);lines.push(`Venue/location: ${d.cVenue||''}`);
  lines.push(`Special message: ${d.cMessage||''}`);
 }
 if(cart.some(c=>c.type==='b2b')){
  lines.push('');lines.push('Business details:');
  lines.push(`Business name: ${d.bName||''}`);lines.push(`Business category: ${d.bCategory||''}`);lines.push(`Owner/contact: ${d.bOwner||''}`);
  lines.push(`Existing website: ${d.bExisting||''}`);lines.push(`Domain: ${d.bDomain||''}`);lines.push(`Logo available: ${d.bLogo||''}`);
  lines.push(`Brand colors: ${d.bColors||''}`);lines.push(`Required pages: ${d.bPages||''}`);lines.push(`WhatsApp integration: ${d.bWhatsapp||''}`);
  lines.push(`Contact forms: ${d.bForms||''}`);lines.push(`SEO requirement: ${d.bSeo||''}`);lines.push(`Monthly maintenance plan: ${d.bMaint||''}`);
  lines.push(`Services/menu/products: ${d.bServices||''}`);
 }
 lines.push('');lines.push(`Additional requirements: ${d.ofExtra||''}`);
 lines.push('');lines.push('Thank you.');
 const subject=encodeURIComponent('MEMORA Order — '+order.orderId);
 const body=encodeURIComponent(lines.join('\n'));
 // Graceful fallback: opens the customer's email client pre-filled. Does not guarantee delivery.
 try{
  const a=document.createElement('a');
  a.href=`mailto:?subject=${subject}&body=${body}`;
  a.click();
 }catch(e){/* no-op: order is still saved locally and visible in My Booking / Creator Studio */}
}
/* Enquiry-only email — same prototype limitations as sendOrderEmail above. */
function sendEnquiryEmail(enq){
 const lines=[`Hello MEMORA,`,'',`New enquiry — ${enq.enquiryId}`,`Name: ${enq.name}`,`Email: ${enq.email}`,`WhatsApp: ${enq.whatsapp||''}`,
  `Interested in: ${enq.interest||''} (${enq.orderType||''})`,`Category: ${enq.category||''}`,`Desired package: ${enq.package||''}`,
  `Event/business date: ${enq.date||''}`,`Budget: ${enq.budget||''}`,'',`Requirements/questions:`,enq.message||''];
 const subject=encodeURIComponent('MEMORA Enquiry — '+enq.enquiryId);
 const body=encodeURIComponent(lines.join('\n'));
 try{
  const a=document.createElement('a');
  a.href=`mailto:?subject=${subject}&body=${body}`;
  a.click();
 }catch(e){}
}

/* ============ MY BOOKING (customer order center) ============ */
function viewMyBooking(orderId){
 if(!currentCustomer()){
  return `${breadcrumb([{label:'Home',href:'/'},{label:'My Booking'}])}
  <div class="pagehero"><div class="icon">🧾</div><h1>My Order</h1></div>
  <section class="section tight">
   <div class="wizard-card" style="text-align:center">
    ${emptyState('🔒','Sign in to view your orders')}
    <button class="navbtn" style="margin-top:10px" onclick="showMyBookingAuthGate()">Sign in</button>
    <div id="myBookingAuthMount"></div>
   </div>
  </section>`;
 }
 const ids=myOrderIds();
 const orders=getOrders().filter(o=>ids.includes(o.orderId)).sort((a,b)=>b.createdAt-a.createdAt);
 if(!orders.length){
  return `${breadcrumb([{label:'Home',href:'/'},{label:'My Booking'}])}
  <div class="pagehero"><div class="icon">🧾</div><h1>My Booking</h1></div>
  <section class="section tight">${emptyState('🗂','No orders yet on this account. Submit an order to see its status here.')}
  <div style="text-align:center;margin-top:18px"><button class="navbtn" onclick="go('b2c')">Explore Experiences</button></div></section>`;
 }
 const active=orderId?orders.find(o=>o.orderId===orderId):orders[0];
 return `
 ${breadcrumb([{label:'Home',href:'/'},{label:'My Booking'}])}
 <div class="pagehero"><div class="icon">🧾</div><h1>My Booking</h1><p style="color:var(--muted);font-size:15px;margin-top:8px">Orders belonging to your MEMORA account only.</p></div>
 <section class="section tight">
  ${orders.length>1?`<div class="owner-filters" style="justify-content:center">${orders.map(o=>`<button class="tab ${o.orderId===active.orderId?'active':''}" onclick="go('my-booking/${o.orderId}')">${o.orderId}</button>`).join('')}</div>`:''}
  ${myBookingCard(active)}
 </section>`;
}
function showMyBookingAuthGate(){
 authMode='signin';
 const mount=document.getElementById('myBookingAuthMount');
 if(mount)mount.innerHTML=`<div style="text-align:left;margin-top:14px">${customerAuthBoxHtml()}</div>`;
}
function myBookingCard(o){
 const deadline=o.cancellationDeadline;
 const deadlinePassed=deadline&&Date.now()>deadline;
 return `<div class="wizard-card">
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
   <div><div class="eyebrow">Order ${o.orderId}</div><h2 style="margin:4px 0">${escapeHtml(o.packageSummary)}</h2></div>
   <span class="status-pill ${statusClass(o.status)}">${o.status}</span>
  </div>
  <div class="summary-box">
   <div class="totalrow" style="border-top:0;padding-top:0;margin-top:0"><span>Original price</span><span>${money(o.amount)}</span></div>
   <div class="totalrow"><span>Booking Advance — 10%</span><span>${money(o.advance)}</span></div>
   <div class="totalrow"><span>Remaining Balance — 90%</span><span>${money(o.remaining)}</span></div>
   <div class="totalrow"><span>Payment status</span><span class="status-pill ${['ADVANCE RECEIVED','PAID','FULL PAYMENT RECEIVED'].includes(o.paymentStatus)?'status-paid':'status-pending'}">${o.paymentStatus}</span></div>
  </div>
  <div class="subhead">Booking timeline</div>
  ${timelineHtml(o)}
  ${paymentSectionHtml(o)}
  ${o.status==='CONFIRMED'||['IN PROGRESS','DELIVERED','COMPLETED'].includes(o.status)?`<div class="summary-box"><b style="color:var(--navy)">Cancellation deadline</b><p style="margin:6px 0 0">${deadline?fmtDateTime(deadline):'—'}${deadlinePassed?' — passed. The 10% advance is now non-refundable.':' — cancel before this time for a full advance refund.'}</p></div>`:''}
  <div class="subhead">Order details</div>
  <div class="spec-grid">
   <div class="spec-row"><div>Category</div><div>${escapeHtml(o.category)}</div></div>
   <div class="spec-row"><div>Received</div><div>${fmtDateTime(o.createdAt)}</div></div>
   <div class="spec-row"><div>Estimated delivery</div><div>${escapeHtml(o.delivery)}</div></div>
   ${o.eventDate?`<div class="spec-row"><div>Event date</div><div>${escapeHtml(o.eventDate)}</div></div>`:''}
   ${o.notes?`<div class="spec-row"><div>Notes from MEMORA</div><div>${escapeHtml(o.notes)}</div></div>`:''}
  </div>
  <p style="color:var(--muted);font-size:12px;margin-top:16px">Need to cancel or make a change? Email <a href="mailto:" style="color:var(--burgundy)"></a> with your Order ID, referencing our <a href="javascript:void(0)" onclick="go('terms');return false" style="color:var(--burgundy)">cancellation policy</a>.</p>
 </div>`;
}

/* ============ TERMS & PRIVACY ============ */
function viewTerms(){
 return `${breadcrumb([{label:'Home',href:'/'},{label:'Terms & Conditions'}])}
 <div class="pagehero"><div class="icon">📜</div><h1>Terms &amp; Conditions</h1></div>
 <section class="section tight"><div class="wizard-card" style="text-align:left;max-width:820px">
  <p style="background:var(--ivory);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:13px;color:var(--muted)">These terms are provided as a business-policy draft and should be reviewed by a qualified legal professional before production use.</p>
  <div class="subhead">Order confirmation</div>
  <p>Submitting an order creates an enquiry, not a confirmed booking. A booking is only CONFIRMED once MEMORA has accepted the order and received the 10% booking advance.</p>
  <div class="subhead">Booking advance</div>
  <p>A booking advance of 10% of the original order price is required to confirm a booking. This advance is deducted from the final order price — it is part of the total, not an additional charge.</p>
  <div class="subhead">Cancellation &amp; refund window</div>
  <p>If you cancel a confirmed order within 24 hours of your booking being confirmed, your 10% booking advance will be refunded. After 24 hours, the booking advance is non-refundable because work may have already started.</p>
  <div class="subhead">Your content</div>
  <p>You are responsible for providing accurate content and for holding the necessary rights and permissions for any photos, videos, music or other material you upload or share with MEMORA.</p>
  <div class="subhead">Delivery timelines</div>
  <p>Delivery timelines shown on the website are estimates. Actual delivery may depend on how quickly you provide feedback and content, and on the final agreed scope.</p>
  <div class="subhead">Scope &amp; changes</div>
  <p>The final scope of your project must be confirmed with MEMORA. Changes to scope after confirmation may affect price and/or delivery timeline.</p>
  <div class="subhead">Hosting &amp; revisions</div>
  <p>Hosting duration and the number of included revisions depend on the package or plan you choose, as shown on the Pricing page.</p>
  <div class="subhead">Payment balance</div>
  <p>The remaining 90% balance is due as agreed with MEMORA before final delivery/handover, unless otherwise agreed in writing.</p>
  <div class="subhead">Project completion</div>
  <p>A project is considered complete once it has been delivered and any agreed revisions are finished.</p>
  <div class="subhead">Limitation of responsibility</div>
  <p>MEMORA is a small, independent digital studio. MEMORA is not responsible for third-party service outages (hosting, domain registrars, payment providers) beyond its reasonable control.</p>
  <div class="subhead">Contact</div>
  <p>Questions about these terms: <a href="mailto:" style="color:var(--burgundy)"></a></p>
 </div></section>`;
}
function viewPrivacy(){
 return `${breadcrumb([{label:'Home',href:'/'},{label:'Privacy Policy'}])}
 <div class="pagehero"><div class="icon">🔒</div><h1>Privacy Policy</h1></div>
 <section class="section tight"><div class="wizard-card" style="text-align:left;max-width:820px">
  <div class="subhead">What MEMORA may receive</div>
  <p>Depending on what you share with us, MEMORA may receive: your name, email, WhatsApp number, event or business details, photos, videos, messages and other materials you provide for your project.</p>
  <div class="subhead">How it's used</div>
  <p>Customer-provided photos, videos and content are used only for creating and delivering the MEMORA experience or website you requested.</p>
  <div class="subhead">Content deletion</div>
  <p>Customer photos, videos and personal content will be deleted from MEMORA's working storage after successful delivery/completion of the project, subject to any backups or systems that may temporarily retain data. We do not claim permanent deletion from every possible system.</p>
  <p style="background:var(--ivory);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:13px">Your submitted photos, videos and personal materials are used for your MEMORA project and are intended to be deleted from our working project storage after successful delivery. Please only upload content you have permission to use.</p>
  <div class="subhead">This prototype</div>
  <p>This standalone dashboard currently stores enquiry and order information in your browser's local storage for demonstration purposes. It is not a secure, centralized database — see the Terms page and the architecture notes provided to the site owner.</p>
  <div class="subhead">Contact</div>
  <p>Questions about this policy: <a href="mailto:" style="color:var(--burgundy)"></a></p>
 </div></section>`;
}

/* ============ OWNER LOGIN ============ */
function viewOwnerLogin(){
 return `<div class="login-box">
  <div class="eyebrow">MEMORA</div><h2>Owner Login</h2>
  <p style="color:var(--muted);font-size:13.5px">Enter your owner credentials to open Creator Studio.</p>
  <input type="text" id="ownerUser" placeholder="Username" autocomplete="off" style="width:100%;padding:12px;border:1px solid #d8cdbd;border-radius:12px;background:var(--ivory);margin:14px 0 8px;font-size:14px" onkeydown="if(event.key==='Enter')document.getElementById('ownerPass').focus()">
  <input type="password" id="ownerPass" placeholder="Password" style="width:100%;padding:12px;border:1px solid #d8cdbd;border-radius:12px;background:var(--ivory);margin:0 0 14px;font-size:14px" onkeydown="if(event.key==='Enter')ownerLogin()">
  <p id="ownerLoginErr" style="display:none;color:var(--burgundy);font-size:12.5px;margin:-6px 0 10px">Incorrect username or password.</p>
  <button class="navbtn" style="width:100%" onclick="ownerLogin()">Enter Creator Studio</button>
  <p style="color:var(--muted);font-size:11px;margin-top:16px">Prototype authentication — replace with server-side authentication before production.</p>
 </div>`;
}

/* ============ STUDIO (Creator / Admin) ============ */
let studioTab='overview';
function setStudioTab(t){studioTab=t;document.getElementById('studioBody').innerHTML=studioTabBody();afterStudioRender()}
function afterStudioRender(){if(studioTab==='orders'&&document.getElementById('ordSearch'))renderOrderTable();if(studioTab==='notify'&&document.getElementById('notifyHistoryWrap'))renderNotifyHistory()}
function viewStudio(){
 return `
 <div class="studio-shell">
  ${breadcrumb([{label:'Home',href:'/'},{label:'Creator Studio'}])}
  <div class="studio-topbar">
   <div><div class="eyebrow">Owner-only area</div><h1 style="margin:4px 0">Creator Studio</h1></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="navbtn outline" onclick="downloadDashboardHtml()">⬇ Download HTML</button><button class="navbtn outline" onclick="shareMemora()">Share MEMORA</button><button class="navbtn outline" onclick="go('')">Exit Studio</button><button class="navbtn outline" onclick="ownerLogout()">Logout</button></div>
  </div>
  ${studioBackendBannerHtml()}
  <div class="tabs" style="justify-content:flex-start">
   ${Object.entries({overview:'Overview',orders:'Orders',enquiries:'Enquiries',notify:'Notifications',demos:'Creations',pricing:'Pricing'}).map(([t,label])=>`<button class="tab ${studioTab===t?'active':''}" onclick="setStudioTab('${t}')">${label}</button>`).join('')}
  </div>
  <div id="studioBody">${studioTabBody()}</div>
 </div>`;
}
function studioBackendBannerHtml(){
 const items=[
  ['Shared cross-device backend (Firestore)',backendConfigured()],
  ['Real email delivery (EmailJS)',emailjsConfigured()],
  ['Real SMS OTP delivery (Firebase Phone Auth)',fbReady],
 ];
 const allOn=items.every(i=>i[1]);
 if(allOn)return `<div style="background:#eef7ee;border:1px solid #bfe3bf;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:12.5px;color:#2b5e2b"><b>✓ Live backend connected</b> — orders, OTP and email are real and shared across devices.</div>`;
 return `<div style="background:#fbeef0;border:1px solid #f0c9cf;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:12.5px;color:var(--navy)">
  <b>⚠ Running in LOCAL-ONLY mode</b> — this browser only. Orders won't sync between the customer's phone and this Studio until these are connected:
  <ul style="margin:8px 0 0;padding-left:18px">
   ${items.map(([label,ok])=>`<li style="margin:2px 0">${ok?'✓':'✕'} ${label}${ok?'':' — see MEMORA_CONFIG at the top of the file'}</li>`).join('')}
  </ul>
 </div>`;
}
function studioTabBody(){
 if(studioTab==='orders')return studioOrders();
 if(studioTab==='enquiries')return studioEnquiries();
 if(studioTab==='notify')return studioNotify();
 if(studioTab==='demos')return studioDemosPanel();
 if(studioTab==='pricing')return studioPricingPanel();
 return studioOverview();
}
function studioOverview(){
 const orders=getOrders();const enquiries=getEnquiries();
 const today=new Date();today.setHours(0,0,0,0);
 const isToday=ts=>ts>=today.getTime();
 const stats=[
  ['Total enquiries',enquiries.length],
  ['Total bookings',orders.length],
  ['Pending enquiries',enquiries.filter(e=>e.status==='NEW'||e.status==='UNDER REVIEW').length],
  ['Pending confirmations',orders.filter(o=>o.status==='ACCEPTED — PAYMENT PENDING').length],
  ['Confirmed bookings',orders.filter(o=>o.status==='CONFIRMED').length],
  ['Payment pending',orders.filter(o=>o.paymentStatus==='PENDING').length],
  ['Payment received',orders.filter(o=>o.paymentStatus==='ADVANCE RECEIVED'||o.paymentStatus==='PAID').length],
  ['Cancelled bookings',orders.filter(o=>o.status==='CANCELLED').length],
  ['Completed bookings',orders.filter(o=>o.status==='COMPLETED').length],
  ['Upcoming bookings',orders.filter(o=>['CONFIRMED','IN PROGRESS'].includes(o.status)).length],
  ["Today's bookings",orders.filter(o=>isToday(o.createdAt)).length],
  ['Delivered',orders.filter(o=>o.status==='DELIVERED').length]
 ];
 const recentOrders=[...orders].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
 const recentEnq=[...enquiries].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
 return `
  <div class="stat-grid">${stats.map(([l,n])=>`<div class="stat-card"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('')}</div>
  <div class="studio-panel" style="border-style:solid">
   <h3>Recent orders</h3>
   ${recentOrders.length?recentOrders.map(o=>`<div class="studio-item"><div class="meta"><b>${o.orderId}</b><small>${escapeHtml(o.customerName)} · ${escapeHtml(o.packageSummary)} · ${fmtDateTime(o.createdAt)}</small></div><span class="status-pill ${statusClass(o.status)}">${o.status}</span></div>`).join(''):'<p style="color:var(--muted)">No orders yet.</p>'}
  </div>
  <div class="studio-panel" style="border-style:solid">
   <h3>Recent enquiries</h3>
   ${recentEnq.length?recentEnq.map(e=>`<div class="studio-item"><div class="meta"><b>${escapeHtml(e.name)}</b><small>${escapeHtml(e.category||'')} · ${fmtDateTime(e.createdAt)}</small></div><span class="pill">${e.status}</span></div>`).join(''):'<p style="color:var(--muted)">No enquiries yet.</p>'}
  </div>`;
}
function studioOrders(){
 const all=getOrders().sort((a,b)=>b.createdAt-a.createdAt);
 return `
  <div class="studio-panel" style="border-style:solid">
   <h3>Orders (${all.length})</h3>
   <div class="owner-filters">
    <input id="ordSearch" placeholder="Search name / email / Order ID" oninput="renderOrderTable()">
    <select id="ordStatusFilter" onchange="renderOrderTable()"><option value="">All statuses</option>${['ENQUIRY',...ORDER_STAGES.slice(1),'CANCELLED','REFUNDED'].filter((v,i,a)=>a.indexOf(v)===i).map(s=>`<option>${s}</option>`).join('')}</select>
    <select id="ordPaymentFilter" onchange="renderOrderTable()"><option value="">All payment</option><option>NOT REQUIRED YET</option><option>PENDING</option><option>ADVANCE RECEIVED</option><option>PAID</option></select>
    <select id="ordDateFilter" onchange="renderOrderTable()"><option value="">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
    <select id="ordSort" onchange="renderOrderTable()"><option value="new">Newest first</option><option value="old">Oldest first</option></select>
   </div>
   <div id="orderTableWrap"></div>
  </div>`;
}
function renderOrderTable(){
 const wrap=document.getElementById('orderTableWrap');if(!wrap)return;
 let all=getOrders();
 const q=(document.getElementById('ordSearch').value||'').toLowerCase();
 const statusF=document.getElementById('ordStatusFilter').value;
 const payF=document.getElementById('ordPaymentFilter').value;
 const dateF=document.getElementById('ordDateFilter').value;
 const sort=document.getElementById('ordSort').value;
 if(q)all=all.filter(o=>o.orderId.toLowerCase().includes(q)||o.customerName.toLowerCase().includes(q)||o.customerEmail.toLowerCase().includes(q));
 if(statusF)all=all.filter(o=>o.status===statusF);
 if(payF)all=all.filter(o=>o.paymentStatus===payF);
 if(dateF){
  const now=new Date();const start=new Date();start.setHours(0,0,0,0);
  if(dateF==='today')all=all.filter(o=>o.createdAt>=start.getTime());
  if(dateF==='yesterday'){const y=start.getTime()-86400000;all=all.filter(o=>o.createdAt>=y&&o.createdAt<start.getTime())}
  if(dateF==='7')all=all.filter(o=>o.createdAt>=now.getTime()-7*86400000);
  if(dateF==='30')all=all.filter(o=>o.createdAt>=now.getTime()-30*86400000);
 }
 all.sort((a,b)=>sort==='old'?a.createdAt-b.createdAt:b.createdAt-a.createdAt);
 wrap.innerHTML=all.length?`<table class="owner-table"><thead><tr><th>Order</th><th>Customer</th><th>Package</th><th>Amount</th><th>Status</th><th>Payment</th><th></th></tr></thead><tbody>
  ${all.map(o=>`<tr><td><b>${o.orderId}</b><br><small style="color:var(--muted)">${fmtDateTime(o.createdAt)}</small></td>
   <td>${escapeHtml(o.customerName)}<br><small style="color:var(--muted)">${escapeHtml(o.customerEmail)}</small></td>
   <td>${escapeHtml(o.packageSummary)}<br><small style="color:var(--muted)">${escapeHtml(o.orderType)}</small></td>
   <td>${money(o.amount)}<br><small style="color:var(--muted)">Adv ${money(o.advance)}</small></td>
   <td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td>
   <td>${o.paymentStatus}</td>
   <td><button class="studio-actions" style="border:1px solid var(--line);background:var(--ivory);padding:6px 10px;border-radius:999px;font-size:11.5px;font-weight:800" onclick="toggleOrderDetail('${o.orderId}')">Manage</button></td>
  </tr><tr id="detail-${o.orderId}" style="display:none"><td colspan="7"><div class="order-detail open">${orderDetailForm(o)}</div></td></tr>`).join('')}
 </tbody></table>`:'<p style="color:var(--muted)">No orders match these filters.</p>';
}
function toggleOrderDetail(id){
 const row=document.getElementById('detail-'+id);
 row.style.display=row.style.display==='none'?'table-row':'none';
}
function orderDetailForm(o){
 return `
  <div class="spec-grid" style="margin-bottom:10px">
   <div class="spec-row"><div>WhatsApp</div><div>${escapeHtml(o.customerPhone||'—')}</div></div>
   <div class="spec-row"><div>Category</div><div>${escapeHtml(o.category)}</div></div>
   <div class="spec-row"><div>Event date</div><div>${escapeHtml(o.eventDate||'—')}</div></div>
   <div class="spec-row"><div>Delivery estimate</div><div>${escapeHtml(o.delivery)}</div></div>
   <div class="spec-row"><div>Remaining balance</div><div>${money(o.remaining)}</div></div>
   <div class="spec-row"><div>Cancellation deadline</div><div>${o.cancellationDeadline?fmtDateTime(o.cancellationDeadline):'—'}</div></div>
   <div class="spec-row"><div>Requirements</div><div>${escapeHtml(o.requirements||'—')}</div></div>
   ${o.utr?`<div class="spec-row"><div>UTR / Transaction ID (advance)</div><div>${escapeHtml(o.utr)}</div></div>
   <div class="spec-row"><div>Advance payment submitted</div><div>${escapeHtml(o.paymentDate||'—')} ${escapeHtml(o.paymentTime||'')}</div></div>`:''}
   ${o.finalUtr?`<div class="spec-row"><div>UTR / Transaction ID (final)</div><div>${escapeHtml(o.finalUtr)}</div></div>
   <div class="spec-row"><div>Final payment submitted</div><div>${escapeHtml(o.finalPaymentDate||'—')} ${escapeHtml(o.finalPaymentTime||'')}</div></div>`:''}
  </div>
  <div class="studio-actions" style="margin-bottom:12px">
   ${o.status==='PENDING REVIEW'?`<button onclick="confirmAcceptOrder('${o.orderId}')">✓ Accept Booking</button><button class="danger" onclick="rejectOrder('${o.orderId}')">✕ Reject Booking</button><button onclick="sendCustomerEmail('${o.orderId}','REQUEST_RECEIVED')">✉ Email Receipt</button><button onclick="sendCustomerWhatsApp('${o.orderId}','REQUEST_RECEIVED')">💬 WhatsApp Receipt</button>`:''}
   ${o.status==='ACCEPTED — PAYMENT PENDING'?`<button onclick="sendCustomerEmail('${o.orderId}','BOOKING_ACCEPTED')">✉ Send Acceptance Email</button><button onclick="sendCustomerWhatsApp('${o.orderId}','BOOKING_ACCEPTED')">💬 Send Acceptance WhatsApp</button><button onclick="copyNotificationText('${o.orderId}','BOOKING_ACCEPTED')">📋 Copy Email</button>`:''}
   ${o.utr&&o.paymentStatus!=='ADVANCE RECEIVED'&&o.paymentStatus!=='PAID'?`<button onclick="confirmVerifyPayment('${o.orderId}')">✓ Verify Payment</button><button class="danger" onclick="rejectPayment('${o.orderId}')">✕ Reject Payment</button>`:''}
   ${o.paymentStatus==='ADVANCE RECEIVED'&&o.status==='CONFIRMED'?`<button onclick="sendCustomerEmail('${o.orderId}','BOOKING_CONFIRMED')">✉ Send Confirmation Email</button><button onclick="sendCustomerWhatsApp('${o.orderId}','BOOKING_CONFIRMED')">💬 Send Confirmation WhatsApp</button><button onclick="copyNotificationText('${o.orderId}','BOOKING_CONFIRMED')">📋 Copy Email</button>`:''}
   ${o.status==='CONFIRMED'?`<button onclick="quickSetStatus('${o.orderId}','IN PROGRESS');sendCustomerEmail('${o.orderId}','IN_PROGRESS')">Mark In Progress</button>`:''}
   ${o.status==='IN PROGRESS'&&(o.paymentStatus==='ADVANCE RECEIVED'||o.paymentStatus==='PAID')?`<button onclick="confirmFinalPaymentDue('${o.orderId}')">Mark Final Payment Due</button>`:''}
   ${o.paymentStatus==='FINAL PAYMENT DUE'?`<button onclick="sendCustomerEmail('${o.orderId}','FINAL_PAYMENT_DUE')">✉ Send Final Payment Request</button><button onclick="sendCustomerWhatsApp('${o.orderId}','FINAL_PAYMENT_DUE')">💬 Send Final Payment Request</button>`:''}
   ${o.finalUtr&&o.paymentStatus==='FINAL PAYMENT DUE'?`<button onclick="confirmVerifyFinalPayment('${o.orderId}')">✓ Verify Final Payment</button><button class="danger" onclick="rejectFinalPayment('${o.orderId}')">✕ Reject Final Payment</button>`:''}
   ${o.status==='IN PROGRESS'&&o.paymentStatus==='FULL PAYMENT RECEIVED'?`<button onclick="markDelivered('${o.orderId}')">Mark Delivered</button>`:''}
   ${o.status==='DELIVERED'?`<button onclick="markCompleted('${o.orderId}')">Mark Completed</button><button onclick="sendCustomerWhatsApp('${o.orderId}','DELIVERED')">💬 Send Delivered WhatsApp</button>`:''}
   ${o.status==='COMPLETED'?`<button onclick="sendCustomerWhatsApp('${o.orderId}','COMPLETED')">💬 Send Completed WhatsApp</button>`:''}
  </div>
  <div class="form-grid">
   <div class="field"><label>STATUS</label><select id="stStatus-${o.orderId}">${['ENQUIRY','PENDING REVIEW','ACCEPTED — PAYMENT PENDING','CONFIRMED','IN PROGRESS','DELIVERED','COMPLETED','CANCELLED','REFUNDED'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
   <div class="field"><label>PAYMENT STATUS</label><select id="stPay-${o.orderId}">${['NOT REQUIRED YET','PENDING','ADVANCE RECEIVED','PAID','FINAL PAYMENT DUE','FULL PAYMENT RECEIVED'].map(s=>`<option ${o.paymentStatus===s?'selected':''}>${s}</option>`).join('')}</select></div>
   <div class="field full"><label>NOTES (visible to customer)</label><textarea id="stNotes-${o.orderId}" rows="2">${escapeHtml(o.notes||'')}</textarea></div>
  </div>
  <p style="color:var(--muted);font-size:12px">Marking payment status here is a manual prototype action — no real payment gateway is connected yet. Setting status to CONFIRMED starts the 24-hour cancellation window automatically. This dropdown remains as an advanced/manual option — the buttons above are the main workflow.</p>
  <div class="studio-actions"><button onclick="saveOrderUpdate('${o.orderId}')">Save changes</button></div>
 `;
}
function saveOrderUpdate(id){
 const status=document.getElementById(`stStatus-${id}`).value;
 const paymentStatus=document.getElementById(`stPay-${id}`).value;
 const notes=document.getElementById(`stNotes-${id}`).value;
 const o=getOrder(id);
 const statusChanged=o.status!==status;
 const patch={status,paymentStatus,notes};
 if(status==='ACCEPTED — PAYMENT PENDING'&&!o.acceptedAt)patch.acceptedAt=Date.now();
 if(status==='CONFIRMED'&&!o.confirmedAt){patch.confirmedAt=Date.now();patch.cancellationDeadline=Date.now()+24*60*60*1000}
 updateOrder(id,patch);
 toast('Order updated.');
 /* Every status change notifies the customer by email automatically (real send if
    EmailJS is configured, composer fallback otherwise) — WhatsApp stays a one-click
    button above since opening wa.me needs a direct user click, not an automatic call. */
 if(statusChanged&&STATUS_TEMPLATE_MAP[status])sendCustomerEmail(id,STATUS_TEMPLATE_MAP[status]);
 renderOrderTable();
}
function confirmAcceptOrder(id){
 const o=getOrder(id);
 if(!confirm(`Accept this booking?\n\nCustomer: ${o.customerName}\nOrder: ${o.orderId}\nOriginal price: ${money(o.amount)}\n10% advance: ${money(o.advance)}\nRemaining: ${money(o.remaining)}`))return;
 acceptOrder(id);
}
function acceptOrder(id){
 const o=getOrder(id);
 const patch={status:'ACCEPTED — PAYMENT PENDING',paymentStatus:'PENDING'};
 if(!o.acceptedAt)patch.acceptedAt=Date.now();
 updateOrder(id,patch);
 toast('Booking accepted — payment unlocked for the customer.');
 sendCustomerEmail(id,'BOOKING_ACCEPTED');
 renderOrderTable();
}
function confirmVerifyPayment(id){
 const o=getOrder(id);
 if(!confirm(`Verify this payment?\n\nCustomer: ${o.customerName}\nOrder: ${o.orderId}\n10% advance: ${money(o.advance)}\nUTR: ${o.utr||'—'}`))return;
 markPaymentReceived(id);
}
function confirmFinalPaymentDue(id){
 const o=getOrder(id);
 if(!confirm(`Mark final payment (remaining 90%) as due for this order?\n\nCustomer: ${o.customerName}\nOrder: ${o.orderId}\nRemaining: ${money(o.remaining)}`))return;
 updateOrder(id,{paymentStatus:'FINAL PAYMENT DUE'});
 toast('Final payment marked as due — customer can now pay the remaining 90%.');
 sendCustomerEmail(id,'FINAL_PAYMENT_DUE');
 renderOrderTable();
}
function confirmVerifyFinalPayment(id){
 const o=getOrder(id);
 if(!confirm(`Verify this final payment?\n\nCustomer: ${o.customerName}\nOrder: ${o.orderId}\nRemaining: ${money(o.remaining)}\nUTR: ${o.finalUtr||'—'}`))return;
 verifyFinalPayment(id);
}
function verifyFinalPayment(id){
 updateOrder(id,{paymentStatus:'FULL PAYMENT RECEIVED'});
 toast('Final payment verified — order fully paid.');
 renderOrderTable();
}
function markDelivered(id){
 updateOrder(id,{status:'DELIVERED'});
 toast('Order marked DELIVERED.');
 sendCustomerEmail(id,'DELIVERED');
 renderOrderTable();
}
function markCompleted(id){
 updateOrder(id,{status:'COMPLETED'});
 toast('Order marked COMPLETED.');
 sendCustomerEmail(id,'COMPLETED');
 renderOrderTable();
}
function rejectFinalPayment(id){
 if(!confirm('Reject this final payment submission? The customer will need to resubmit their UTR.'))return;
 updateOrder(id,{finalUtr:'',finalPaymentDate:'',finalPaymentTime:'',finalPaymentSubmittedAt:null});
 toast('Final payment rejected — customer can resubmit.');
 renderOrderTable();
}
function quickSetStatus(id,status){
 updateOrder(id,{status});
 toast(`Order marked ${status}.`);
 renderOrderTable();
}
function rejectOrder(id){
 if(!confirm('Reject this booking request?'))return;
 updateOrder(id,{status:'CANCELLED'});
 toast('Booking rejected.');
 sendCustomerEmail(id,'CANCELLED');
 renderOrderTable();
}
function markPaymentReceived(id){
 const o=getOrder(id);
 const patch={paymentStatus:'ADVANCE RECEIVED',status:'CONFIRMED'};
 if(!o.confirmedAt){patch.confirmedAt=Date.now();patch.cancellationDeadline=Date.now()+24*60*60*1000}
 updateOrder(id,patch);
 toast('Payment verified — booking confirmed.');
 sendCustomerEmail(id,'BOOKING_CONFIRMED');
 renderOrderTable();
}
function rejectPayment(id){
 if(!confirm('Reject this payment submission? The customer will need to resubmit their UTR.'))return;
 updateOrder(id,{paymentStatus:'PENDING',utr:'',paymentDate:'',paymentTime:'',paymentSubmittedAt:null});
 toast('Payment rejected — customer can resubmit.');
 renderOrderTable();
}
/* ============ NOTIFICATION LAYER ============
   Central service for every customer notification (email + WhatsApp), per template.
   Prototype behaviour: opens the OWNER's own mailto:/wa.me composer, pre-filled — this is a
   real, working action, but it is the owner sending it manually, not automated delivery. It is
   never reported as "sent" or "delivered", only "composer opened" / "message window opened".
   Production behaviour: if BACKEND_API_BASE is set, the same call also POSTs to
   /api/notifications/email or /api/notifications/whatsapp so a real backend can deliver it
   automatically without depending on the owner's device. No secrets live in this file. */
const NOTIFICATION_TEMPLATES={
 REQUEST_RECEIVED:o=>({
  subject:`MEMORA Booking Request Received — ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nThank you for choosing MEMORA.\n\nWe have received your booking request.\n\nOrder ID: ${o.orderId}\nPackage: ${o.packageSummary}\nOriginal Order Price: ${money(o.amount)}\nCurrent Status: PENDING REVIEW\n\nMEMORA will review your request and notify you once your booking has been accepted.\n\nNo payment is required at this stage.\n\nThank you,\nMEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nMEMORA has received your booking request (Order ${o.orderId}).\nPackage: ${o.packageSummary}\nPrice: ${money(o.amount)}\nStatus: PENDING REVIEW\n\nWe'll notify you once it's reviewed. No payment is needed yet.\n\n— MEMORA`
 }),
 BOOKING_ACCEPTED:o=>({
  subject:`MEMORA Booking Accepted — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nGood news — MEMORA has accepted your booking request.\n\nOrder ID: ${o.orderId}\nPackage: ${o.packageSummary}\nOriginal Order Price: ${money(o.amount)}\nBooking Advance — 10%: ${money(o.advance)}\nRemaining Balance — 90%: ${money(o.remaining)}\n\nYour booking can now be confirmed by paying the 10% booking advance.\n\nUPI ID: ${UPI_ID}\n\nAfter payment, please submit your transaction/UTR details through your MEMORA My Booking page.\n\nThank you,\nMEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nYour MEMORA booking has been accepted.\n\nOrder ID: ${o.orderId}\nOriginal Price: ${money(o.amount)}\n10% Booking Advance: ${money(o.advance)}\nRemaining 90%: ${money(o.remaining)}\n\nPlease complete the 10% booking advance using the payment option in your MEMORA My Booking page.\n\nUPI ID: ${UPI_ID}\n\nAfter payment, submit your UTR / transaction ID.\n\n— MEMORA`
 }),
 BOOKING_CONFIRMED:o=>({
  subject:`MEMORA Booking Confirmed — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA booking is now confirmed.\n\nOrder ID: ${o.orderId}\n10% booking advance: RECEIVED\nRemaining balance: ${money(o.remaining)}\n\nYour order has now entered the production workflow. You will receive further updates as your order progresses.\n\nThank you,\nMEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nYour MEMORA booking (${o.orderId}) is confirmed — 10% advance received.\nRemaining balance: ${money(o.remaining)}\n\nWe'll keep you updated as work progresses.\n\n— MEMORA`
 }),
 IN_PROGRESS:o=>({
  subject:`MEMORA Order Update — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA project (Order ${o.orderId}) has entered production and is now IN PROGRESS.\n\nWe'll notify you again once it's ready.\n\nThank you,\nMEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nYour MEMORA project (${o.orderId}) has entered production and is now IN PROGRESS.\n\n— MEMORA`
 }),
 FINAL_PAYMENT_DUE:o=>({
  subject:`MEMORA Final Payment Due — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA project has reached the final payment stage.\n\nOrder ID: ${o.orderId}\nOriginal Order Price: ${money(o.amount)}\n10% Advance Received: ${money(o.advance)}\nRemaining 90%: ${money(o.remaining)}\n\nPlease complete the remaining payment using the PAY REMAINING 90% button on your MEMORA My Booking page.\n\nUPI ID: ${UPI_ID}\n\nThank you,\nMEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nYour MEMORA project (${o.orderId}) is ready for final payment.\nRemaining 90%: ${money(o.remaining)}\n\nPlease pay via the MEMORA My Booking page (UPI ID: ${UPI_ID}) and submit your UTR.\n\n— MEMORA`
 }),
 DELIVERED:o=>({
  subject:`MEMORA Order Delivered — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA website/project (Order ${o.orderId}) has been delivered.\n\nPlease check your MEMORA My Booking page for details.\n\nThank you,\nMEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nYour MEMORA project (${o.orderId}) has been delivered! Check your My Booking page for details.\n\n— MEMORA`
 }),
 COMPLETED:o=>({
  subject:`MEMORA Order Completed — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA order (${o.orderId}) has been marked completed. Thank you for choosing MEMORA!\n\n— MEMORA`,
  whatsapp:`Hello ${o.customerName} 👋\n\nYour MEMORA order (${o.orderId}) is now COMPLETED. Thank you for choosing MEMORA! 🎉\n\n— MEMORA`
 }),
 CANCELLED:o=>({
  subject:`MEMORA Order Cancelled — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA order (${o.orderId}) has been cancelled. If you believe this is a mistake, please reply to this email.\n\n— MEMORA`,
  whatsapp:`Hello ${o.customerName},\n\nYour MEMORA order (${o.orderId}) has been cancelled.\n\n— MEMORA`
 }),
 REFUNDED:o=>({
  subject:`MEMORA Payment Refunded — Order ${o.orderId}`,
  email:`Hello ${o.customerName},\n\nYour MEMORA payment for order ${o.orderId} has been refunded. Please allow a few business days for it to reflect in your account.\n\n— MEMORA`,
  whatsapp:`Hello ${o.customerName},\n\nYour MEMORA payment for order ${o.orderId} has been refunded.\n\n— MEMORA`
 })
};
const STATUS_TEMPLATE_MAP={'PENDING REVIEW':'REQUEST_RECEIVED','ACCEPTED — PAYMENT PENDING':'BOOKING_ACCEPTED','CONFIRMED':'BOOKING_CONFIRMED','IN PROGRESS':'IN_PROGRESS','DELIVERED':'DELIVERED','COMPLETED':'COMPLETED','CANCELLED':'CANCELLED','REFUNDED':'REFUNDED'};
function getNotifications(){return loadJSON('memora_notifications',[])}
function saveNotifications(n){saveJSON('memora_notifications',n)}
function logNotification(order,channel,template,status){
 const ts=Date.now();
 const rec={ts,orderId:order.orderId,customer:order.customerName,channel,template,status};
 const list=getNotifications();
 list.unshift(rec);
 saveNotifications(list.slice(0,500));
 cloudSet('memora_notifications_coll',order.orderId+'_'+ts,{...rec,_ts:ts});
 if(document.getElementById('notifyHistoryWrap'))renderNotifyHistory();
}
function lastNotificationFor(orderId){return getNotifications().find(n=>n.orderId===orderId)}
/* Production adapter placeholder — POST /api/notifications/email or /whatsapp.
   Safely no-ops unless BACKEND_API_BASE is set; never put provider secrets here. */
function attemptBackendNotify(kind,payload){
 if(!BACKEND_API_BASE)return;
 try{fetch(`${BACKEND_API_BASE}/api/notifications/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{})}catch(e){}
}
function emailjsConfigured(){const c=window.MEMORA_CONFIG&&window.MEMORA_CONFIG.emailjs;return !!(c&&c.publicKey&&c.serviceId&&c.templateId&&window.emailjs)}
function sendCustomerEmail(orderId,templateKey){
 const o=getOrder(orderId);if(!o)return;
 const t=(NOTIFICATION_TEMPLATES[templateKey]||NOTIFICATION_TEMPLATES.BOOKING_ACCEPTED)(o);
 if(emailjsConfigured()){
  emailjs.send(window.MEMORA_CONFIG.emailjs.serviceId,window.MEMORA_CONFIG.emailjs.templateId,{to_email:o.customerEmail,to_name:o.customerName,subject:t.subject,message:t.email},window.MEMORA_CONFIG.emailjs.publicKey)
   .then(()=>{toast('Email sent to '+o.customerEmail);logNotification(o,'EMAIL',templateKey,'SENT')})
   .catch(e=>{console.error('EmailJS send failed',e);toast('Automatic email failed — opening your email app instead.');mailtoFallback(o,t);logNotification(o,'EMAIL',templateKey,'SEND FAILED — MAILTO FALLBACK')});
  return;
 }
 mailtoFallback(o,t);
 logNotification(o,'EMAIL',templateKey,'COMPOSER OPENED (EmailJS not configured)');
}
function mailtoFallback(o,t){
 try{
  const a=document.createElement('a');
  a.href=`mailto:${o.customerEmail}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.email)}`;
  a.click();
  toast('Email composer opened.');
 }catch(e){toast('Could not open email composer.')}
}
function sendCustomerWhatsApp(orderId,templateKey){
 const o=getOrder(orderId);if(!o)return;
 const digits=(o.customerPhone||'').replace(/[^\d]/g,'');
 if(!digits){toast('No WhatsApp number on file for this order.');return}
 const waNumber=digits.length===10?'91'+digits:digits;
 const t=(NOTIFICATION_TEMPLATES[templateKey]||NOTIFICATION_TEMPLATES.BOOKING_ACCEPTED)(o);
 try{
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(t.whatsapp)}`,'_blank');
  toast('WhatsApp message window opened.');
  logNotification(o,'WHATSAPP',templateKey,'COMPOSER OPENED');
  attemptBackendNotify('whatsapp',{orderId:o.orderId,customerName:o.customerName,whatsappNumber:waNumber,template:templateKey,message:t.whatsapp});
 }catch(e){toast('Could not open WhatsApp.')}
}
function copyNotificationText(orderId,templateKey){
 const o=getOrder(orderId);if(!o)return;
 const t=(NOTIFICATION_TEMPLATES[templateKey]||NOTIFICATION_TEMPLATES.BOOKING_ACCEPTED)(o);
 const text=`Subject: ${t.subject}\n\n${t.email}`;
 if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(text).then(()=>toast('Email text copied.')).catch(()=>toast('Could not copy — select and copy manually.'));
 }else{toast('Clipboard not available in this browser.')}
}
/* Backward-compatible wrappers used by earlier buttons in this file. */
function emailAcceptance(id){sendCustomerEmail(id,'BOOKING_ACCEPTED')}
function emailConfirmation(id){sendCustomerEmail(id,'BOOKING_CONFIRMED')}
function copyEmailText(id,kind){copyNotificationText(id,kind==='confirmation'?'BOOKING_CONFIRMED':'BOOKING_ACCEPTED')}
/* Owner-only Notification Center: quick per-order Email/WhatsApp actions plus a
   best-effort log of what's been opened (never claims delivery — see logNotification). */
function studioNotify(){
 const all=getOrders().sort((a,b)=>b.createdAt-a.createdAt);
 return `<div class="studio-panel" style="border-style:solid">
  <h3>Notification Center</h3>
  <p style="color:var(--muted);font-size:12.5px;margin-top:-6px">Owner-only. Opens your own email/WhatsApp composer pre-filled with the customer's details — nothing here is automatically delivered.</p>
  <div style="overflow-x:auto"><table class="owner-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Last notification</th><th></th></tr></thead><tbody>
   ${all.map(o=>{
    const key=STATUS_TEMPLATE_MAP[o.status]||'BOOKING_ACCEPTED';
    const last=lastNotificationFor(o.orderId);
    return `<tr><td><b>${o.orderId}</b></td>
     <td>${escapeHtml(o.customerName)}<br><small style="color:var(--muted)">${escapeHtml(o.customerEmail)}</small></td>
     <td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td>
     <td>${o.paymentStatus}</td>
     <td><small style="color:var(--muted)">${last?`${fmtDateTime(last.ts)}<br>${last.channel} · ${last.template} · ${last.status}`:'—'}</small></td>
     <td><div class="studio-actions">
      <button onclick="sendCustomerEmail('${o.orderId}','${key}')">✉ Email</button>
      <button onclick="sendCustomerWhatsApp('${o.orderId}','${key}')">💬 WhatsApp</button>
     </div></td>
    </tr>`;
   }).join('')||'<tr><td colspan="6" style="color:var(--muted)">No orders yet.</td></tr>'}
  </tbody></table></div>
 </div>
 <div class="studio-panel">
  <h3>Notification History</h3>
  <div id="notifyHistoryWrap"></div>
 </div>`;
}
function renderNotifyHistory(){
 const wrap=document.getElementById('notifyHistoryWrap');if(!wrap)return;
 const list=getNotifications().slice(0,50);
 wrap.innerHTML=list.length?`<table class="owner-table"><thead><tr><th>Time</th><th>Order</th><th>Customer</th><th>Channel</th><th>Template</th><th>Status</th></tr></thead><tbody>
  ${list.map(n=>`<tr><td>${fmtDateTime(n.ts)}</td><td>${n.orderId}</td><td>${escapeHtml(n.customer)}</td><td>${n.channel}</td><td>${n.template}</td><td>${n.status}</td></tr>`).join('')}
 </tbody></table>`:'<p style="color:var(--muted)">No notifications sent yet.</p>';
}
function studioEnquiries(){
 const all=[...getEnquiries()].sort((a,b)=>b.createdAt-a.createdAt);
 return `<div class="studio-panel" style="border-style:solid">
  <h3>Enquiries (${all.length})</h3>
  ${all.length?`<div style="overflow-x:auto"><table class="owner-table"><thead><tr><th>Enquiry</th><th>Contact</th><th>Interested in</th><th>Status</th><th></th></tr></thead><tbody>
   ${all.map(e=>`<tr><td><b>${e.enquiryId}</b><br><small style="color:var(--muted)">${fmtDateTime(e.createdAt)}</small></td>
    <td>${escapeHtml(e.name)}<br><small style="color:var(--muted)">${escapeHtml(e.email)} · ${escapeHtml(e.whatsapp||'')}</small></td>
    <td>${escapeHtml(e.orderType||'')} ${escapeHtml(e.category||'')}<br><small style="color:var(--muted)">${escapeHtml(e.package||'')}</small></td>
    <td><select onchange="updateEnquiry('${e.enquiryId}',{status:this.value});toast('Enquiry updated.')">${['NEW','UNDER REVIEW','REPLIED','ACCEPTED','CONVERTED TO BOOKING','CLOSED'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
    <td><small style="color:var(--muted)">${escapeHtml(e.message||'').slice(0,60)}</small></td>
   </tr>`).join('')}</tbody></table></div>`:'<p style="color:var(--muted)">No enquiries yet.</p>'}
 </div>`;
}
let addCreationOpen=false;
function toggleAddCreation(){
 addCreationOpen=!addCreationOpen;
 document.getElementById('studioDemosPanel').innerHTML=studioDemosPanel();
}
function creationCategoryOptions(type){
 const cats=type==='b2b'?B2B_CATEGORIES:B2C_CATEGORIES;
 return cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}
function onCreationTypeChange(){
 const type=document.getElementById('dType').value;
 document.getElementById('dCategory').innerHTML=creationCategoryOptions(type);
}
function studioDemosPanel(){
 const demos=getDemos();
 return `<div id="studioDemosPanel">
  <div class="studio-panel">
   <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <h3 style="margin:0">Manage Creations</h3>
    <button class="navbtn" style="border-radius:999px" onclick="toggleAddCreation()">${addCreationOpen?'✕ Close':'+ Add New Creation'}</button>
   </div>
   ${addCreationOpen?`
   <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px">
    <label style="font-size:12px;font-weight:800;color:var(--navy)">TITLE</label>
    <input id="dTitle" placeholder="e.g. Arjun & Aanya — Anniversary">
    <label style="font-size:12px;font-weight:800;color:var(--navy)">TYPE</label>
    <select id="dType" onchange="onCreationTypeChange()">
     <option value="b2c">B2C — Personal Experiences</option>
     <option value="b2b">B2B — Business Websites</option>
    </select>
    <label style="font-size:12px;font-weight:800;color:var(--navy)">CATEGORY</label>
    <select id="dCategory">${creationCategoryOptions('b2c')}</select>
    <label style="font-size:12px;font-weight:800;color:var(--navy)">SHORT DESCRIPTION</label>
    <textarea id="dDesc" rows="3" placeholder="Short description"></textarea>
    <label style="font-size:12px;font-weight:800;color:var(--navy)">LIVE DEMO URL</label>
    <input id="dUrl" placeholder="https://...">
    <label style="font-size:12px;font-weight:800;color:var(--navy)">PREVIEW IMAGE</label>
    <input id="dImage" type="file" accept="image/*">
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px"><input type="checkbox" id="dFeatured" style="width:auto"> Featured</label>
    <div class="studio-actions" style="margin-top:14px">
     <button onclick="addDemo(false)">Save Draft</button>
     <button class="navbtn" style="border-radius:999px" onclick="addDemo(true)">Publish Creation</button>
     <button onclick="toggleAddCreation()">Cancel</button>
    </div>
   </div>`:''}
  </div>
  <div class="studio-panel">
   <h3>All Creations (${demos.length})</h3>
   <div class="studio-list" id="studioDemoList">${demos.map((d,i)=>studioDemoRow(d,i)).join('')||'<p style="color:var(--muted)">No creations yet — use + Add New Creation above.</p>'}</div>
  </div>
 </div>`;
}
let editCreationIndex=-1;
function toggleEditCreation(i){
 editCreationIndex=editCreationIndex===i?-1:i;
 document.getElementById('studioDemoList').innerHTML=getDemos().map((d,idx)=>studioDemoRow(d,idx)).join('');
}
function saveCreationEdit(i){
 const demos=getDemos();
 const d=demos[i];
 if(!d)return;
 const title=document.getElementById(`edTitle-${i}`).value.trim();
 if(!title){alert('Please add a creation title.');return}
 d.title=title;
 d.category=document.getElementById(`edCategory-${i}`).value;
 d.desc=document.getElementById(`edDesc-${i}`).value.trim();
 d.url=document.getElementById(`edUrl-${i}`).value.trim();
 const fileInput=document.getElementById(`edImage-${i}`);
 const finish=()=>{saveDemos(demos);editCreationIndex=-1;toast('Creation updated.');render()};
 if(fileInput.files&&fileInput.files[0]){
  const reader=new FileReader();
  reader.onload=e=>{d.image=e.target.result;finish()};
  reader.readAsDataURL(fileInput.files[0]);
 }else{finish()}
}
function studioPricingPanel(){
 return `
  <div class="studio-panel">
   <h3>Edit pricing &amp; availability</h3>
   <p class="admin-note" style="color:var(--muted);font-size:13px;line-height:1.6">Edit prices, delivery times and availability shown across the whole dashboard — no rebuild needed. Unavailable packages stay visible to customers but can't be booked.</p>
   <div class="subhead" style="margin-top:6px">B2C packages</div>
   ${Object.values(getPackages()).map(p=>priceEditRow('pkg',p)).join('')}
   <div class="subhead">B2B plans</div>
   ${Object.values(getPlans()).map(p=>priceEditRow('plan',p)).join('')}
  </div>`;
}
function studioDemoRow(d,i){
 const cat=catById(d.category);
 const img=d.image?`style="background-image:url('${escapeAttr(d.image)}')"`:'style="display:grid;place-items:center;color:#fff;font-size:20px"';
 const editing=editCreationIndex===i;
 return `<div class="studio-item" style="${editing?'flex-direction:column;align-items:stretch':''}">
  <div style="display:flex;gap:12px;align-items:center;width:100%">
   <div class="imgpreview" ${img}>${d.image?'':(cat?cat.icon:'✨')}</div>
   <div class="meta" style="flex:1"><b>${escapeHtml(d.title)}</b><small>${cat?cat.name:'—'} ${d.featured?'· <span class="pill gold">Featured</span>':''} ${d.published?'<span class="pill live">Published</span>':'<span class="pill draft">Draft</span>'}</small></div>
   <div class="studio-actions">
    <button onclick="toggleEditCreation(${i})">${editing?'Close':'Edit'}</button>
    <button onclick="toggleFeatured(${i})">${d.featured?'Unfeature':'Feature'}</button>
    <button onclick="togglePublish(${i})">${d.published?'Unpublish':'Publish'}</button>
    <button class="danger" onclick="deleteDemo(${i})">Delete</button>
   </div>
  </div>
  ${editing?`<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px;width:100%">
   <label style="font-size:12px;font-weight:800;color:var(--navy)">TITLE</label>
   <input id="edTitle-${i}" value="${escapeAttr(d.title)}">
   <label style="font-size:12px;font-weight:800;color:var(--navy)">CATEGORY</label>
   <select id="edCategory-${i}">${ALL_CATS.map(c=>`<option value="${c.id}" ${c.id===d.category?'selected':''}>${c.icon} ${c.name} (${c.type.toUpperCase()})</option>`).join('')}</select>
   <label style="font-size:12px;font-weight:800;color:var(--navy)">DESCRIPTION</label>
   <textarea id="edDesc-${i}" rows="3">${escapeHtml(d.desc||'')}</textarea>
   <label style="font-size:12px;font-weight:800;color:var(--navy)">LIVE DEMO URL</label>
   <input id="edUrl-${i}" value="${escapeAttr(d.url||'')}">
   <label style="font-size:12px;font-weight:800;color:var(--navy)">REPLACE PREVIEW IMAGE (optional)</label>
   <input id="edImage-${i}" type="file" accept="image/*">
   <div class="studio-actions" style="margin-top:10px"><button class="navbtn" style="border-radius:999px" onclick="saveCreationEdit(${i})">Save Changes</button></div>
  </div>`:''}
 </div>`;
}
function priceEditRow(kind,p){
 const priceField=p.priceMonthly!==undefined?`<input type="number" id="${kind}_${p.id}_priceMonthly" value="${p.priceMonthly}" placeholder="Monthly price">`:`<input id="${kind}_${p.id}_price" value="${escapeAttr(p.price)}" placeholder="Price">`;
 return `<div class="studio-panel" style="border-style:solid;border-width:1px;border-color:var(--line);padding:16px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
   <b style="font-family:var(--serif)">${p.icon} ${p.name}</b>
   <span class="status-pill ${p.available?'status-confirmed':'status-cancelled'}">${p.available?'AVAILABLE':'CURRENTLY UNAVAILABLE'}</span>
  </div>
  <div class="priceedit-grid" style="margin-top:8px">
   ${priceField}
   <input id="${kind}_${p.id}_delivery" value="${escapeAttr(p.delivery)}" placeholder="Delivery time">
  </div>
  <div class="studio-actions" style="margin-top:8px">
   <button onclick="savePriceEdit('${kind}','${p.id}')">Save</button>
   <button onclick="setAvailability('${kind}','${p.id}',${!p.available});toast('Availability updated.');setStudioTab('pricing')">${p.available?'Mark Unavailable':'Mark Available'}</button>
  </div>
 </div>`;
}
function savePriceEdit(kind,id){
 const key=kind==='pkg'?'memora_pkg_overrides':'memora_plan_overrides';
 const o=loadJSON(key,{});
 o[id]=o[id]||{};
 const priceEl=document.getElementById(`${kind}_${id}_price`);
 const monthlyEl=document.getElementById(`${kind}_${id}_priceMonthly`);
 const deliveryEl=document.getElementById(`${kind}_${id}_delivery`);
 if(priceEl)o[id].price=priceEl.value;
 if(monthlyEl)o[id].priceMonthly=parseInt(monthlyEl.value)||0;
 if(deliveryEl)o[id].delivery=deliveryEl.value;
 saveJSON(key,o);
 toast('Pricing updated.');
}
function addDemo(published){
 const category=document.getElementById('dCategory').value;
 const title=document.getElementById('dTitle').value.trim();
 const desc=document.getElementById('dDesc').value.trim();
 const url=document.getElementById('dUrl').value.trim();
 const featured=document.getElementById('dFeatured').checked;
 const fileInput=document.getElementById('dImage');
 if(!title){alert('Please add a creation title.');return}
 const finish=(image)=>{
  const demos=getDemos();
  demos.push({id:Date.now(),title,category,url,desc:desc||'A MEMORA website creation.',image:image||'',featured,published:!!published});
  saveDemos(demos);
  toast(published?'Creation published — now visible in public Creations.':'Creation saved as draft.');
  addCreationOpen=false;
  render();
 };
 if(fileInput.files&&fileInput.files[0]){
  const reader=new FileReader();
  reader.onload=e=>finish(e.target.result);
  reader.readAsDataURL(fileInput.files[0]);
 }else{finish('')}
}
/* ============ DOWNLOAD / SHARE ============ */
/* Download saves the current dashboard, including its live localStorage-based
   package/demo/order data, as a standalone .html file the owner can keep as a backup
   or open on another device. It is NOT the same as publishing a public website —
   the file still needs hosting (e.g. Netlify, Vercel) to get a shareable public URL. */
function downloadDashboardHtml(){
 try{
  const html='<!DOCTYPE html>\n'+document.documentElement.outerHTML;
  const blob=new Blob([html],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`MEMORA-Dashboard-${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  toast('Dashboard downloaded.');
 }catch(e){toast('Could not download — try again from a desktop browser.')}
}
function shareMemora(){
 const url=window.location.href;
 if(navigator.share){
  navigator.share({title:'MEMORA',text:'Your memories, turned into a website.',url}).catch(()=>{});
 }else if(navigator.clipboard){
  navigator.clipboard.writeText(url).then(()=>toast('Page URL copied to clipboard.'));
 }else{
  toast('Copy this page\'s URL from your address bar to share it. Note: this is only a public link if MEMORA is hosted online.');
 }
}
function toggleFeatured(i){const d=getDemos();d[i].featured=!d[i].featured;saveDemos(d);render()}
function togglePublish(i){const d=getDemos();d[i].published=!d[i].published;saveDemos(d);render()}
