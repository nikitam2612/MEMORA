/* =========================================================
   MEMORA OWNER DASHBOARD
   ========================================================= */

let ownerApp = null;
let ownerAuth = null;
let ownerDb = null;
let ownerOrdersUnsubscribe = null;
let ownerOrdersCache = [];


/* =========================================================
   FIREBASE INITIALIZATION
   ========================================================= */

function initOwnerFirebase() {

  try {

    if (!window.MEMORA_CONFIG ||
        !window.MEMORA_CONFIG.firebase) {

      throw new Error('Firebase configuration missing.');

    }

    ownerApp = firebase.initializeApp(
      window.MEMORA_CONFIG.firebase,
      'memoraOwnerApp'
    );

    ownerAuth = ownerApp.auth();
    ownerDb = ownerApp.firestore();

    console.log('MEMORA Owner Firebase initialized.');

    watchOwnerAuth();

  } catch (error) {

    console.error(
      'Owner Firebase initialization failed:',
      error
    );

    showLoginMessage(
      'Unable to connect to the owner system.'
    );

  }

}


/* =========================================================
   OWNER AUTH
   ========================================================= */

function watchOwnerAuth() {

  ownerAuth.onAuthStateChanged(async user => {

    if (!user) {

      showOwnerLogin();
      return;

    }

    const allowed =
      Array.isArray(window.MEMORA_CONFIG.ownerEmails) &&
      window.MEMORA_CONFIG.ownerEmails
        .map(e => String(e).toLowerCase())
        .includes(String(user.email).toLowerCase());

    if (!allowed) {

      await ownerAuth.signOut();

      showLoginMessage(
        'This account is not authorized for Owner Access.'
      );

      return;

    }

    showOwnerDashboard(user);

    startOwnerOrdersListener();

  });

}


/* =========================================================
   LOGIN FORM
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  initOwnerFirebase();

  const form =
    document.getElementById('ownerLoginForm');

  if (form) {

    form.addEventListener('submit', async e => {

      e.preventDefault();

      const email =
        document.getElementById('ownerEmail').value.trim();

      const password =
        document.getElementById('ownerPassword').value;

      showLoginMessage('Signing in...');

      try {

        await ownerAuth.signInWithEmailAndPassword(
          email,
          password
        );

      } catch (error) {

        console.error(error);

        showLoginMessage(
          'Sign in failed. Please check your email and password.'
        );

      }

    });

  }


  const logout =
    document.getElementById('ownerLogoutBtn');

  if (logout) {

    logout.addEventListener('click', async () => {

      if (ownerAuth) {
        await ownerAuth.signOut();
      }

    });

  }

});


/* =========================================================
   OWNER UI
   ========================================================= */

function showOwnerLogin() {

  const login =
    document.getElementById('ownerLogin');

  const dashboard =
    document.getElementById('ownerDashboard');

  if (login) login.style.display = '';
  if (dashboard) dashboard.style.display = 'none';

}


function showOwnerDashboard(user) {

  const login =
    document.getElementById('ownerLogin');

  const dashboard =
    document.getElementById('ownerDashboard');

  if (login) login.style.display = 'none';
  if (dashboard) dashboard.style.display = '';

  const emailDisplay =
    document.getElementById('ownerEmailDisplay');

  if (emailDisplay) {
    emailDisplay.textContent =
      user.email || '';
  }

}


function showLoginMessage(message) {

  const el =
    document.getElementById('ownerLoginMessage');

  if (el) {
    el.textContent = message;
  }

}


/* =========================================================
   REAL-TIME ORDER LISTENER
   ========================================================= */

function startOwnerOrdersListener() {

  if (!ownerDb) return;

  if (ownerOrdersUnsubscribe) {
    ownerOrdersUnsubscribe();
  }

  setLiveStatus('● Connecting...');

  ownerOrdersUnsubscribe =
    ownerDb
      .collection('memora_orders_coll')
      .orderBy('_ts', 'desc')
      .onSnapshot(

        snapshot => {

          ownerOrdersCache =
  snapshot.docs.map(doc => ({
    ...doc.data(),
    _firestoreId: doc.id
  }));

setLiveStatus('● Live');

renderOwnerOrders(ownerOrdersCache);

        },

        error => {

          console.error(
            'Owner orders listener failed:',
            error
          );

          setLiveStatus(
            '● Connection error'
          );

        }

      );

}


/* =========================================================
   LIVE STATUS
   ========================================================= */

function setLiveStatus(text) {

  const el =
    document.getElementById('liveStatus');

  if (el) {
    el.textContent = text;
  }

}


/* =========================================================
   ORDER RENDERING
   ========================================================= */

function renderOwnerOrders(orders) {

  updateStats(orders);

  const container =
    document.getElementById('ownerOrders');

  if (!container) return;

  if (!orders.length) {

    container.innerHTML = `
      <div class="owner-empty">
        No customer orders yet.
      </div>
    `;

    return;

  }


  container.innerHTML =
    orders.map(renderOwnerOrder).join('');

}


/* =========================================================
   ORDER CARD
   ========================================================= */

function renderOwnerOrder(order) {

  const amount =
    Number(order.amount || 0);

  const advance =
    Number(order.advance || 0);

  const remaining =
    Number(order.remaining || 0);

  return `

    <article class="owner-order-card">

      <div class="owner-order-top">

        <div>

          <h3>
            ${escapeOwnerHtml(order.packageSummary || 'MEMORA Order')}
          </h3>

          <div class="owner-order-id">
            ${escapeOwnerHtml(order.orderId || '')}
          </div>

        </div>

        <span class="owner-status">
          ${escapeOwnerHtml(order.status || 'UNKNOWN')}
        </span>

      </div>


      <div class="owner-order-grid">

        <div>
          <span>Customer</span>
          <strong>
            ${escapeOwnerHtml(order.customerName || '—')}
          </strong>
        </div>

        <div>
          <span>Email</span>
          <strong>
            ${escapeOwnerHtml(order.customerEmail || '—')}
          </strong>
        </div>

        <div>
          <span>Phone</span>
          <strong>
            ${escapeOwnerHtml(order.customerPhone || '—')}
          </strong>
        </div>

        <div>
          <span>Event Date</span>
          <strong>
            ${escapeOwnerHtml(order.eventDate || '—')}
          </strong>
        </div>

        <div>
          <span>Total</span>
          <strong>
            ₹${amount.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </strong>
        </div>

        <div>
          <span>Advance 10%</span>
          <strong>
            ₹${advance.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </strong>
        </div>

        <div>
          <span>Final 90%</span>
          <strong>
            ₹${remaining.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </strong>
        </div>

        <div>
          <span>Payment</span>
          <strong>
            ${escapeOwnerHtml(order.paymentStatus || '—')}
          </strong>
        </div>

      </div>


      <div class="owner-order-actions">

        <button
          class="navbtn"
          onclick="openOwnerOrder('${escapeOwnerAttr(order.orderId)}')"
        >
          View Order
        </button>

      </div>

    </article>

  `;

}


/* =========================================================
   STATS
   ========================================================= */

function updateStats(orders) {

  const pending =
    orders.filter(o =>
      String(o.status || '').toUpperCase() ===
      'PENDING REVIEW'
    ).length;

  const completed =
    orders.filter(o =>
      String(o.status || '').toUpperCase() ===
      'COMPLETED'
    ).length;

  const active =
    orders.length -
    pending -
    completed;


  document.getElementById('statTotal').textContent =
    orders.length;

  document.getElementById('statPending').textContent =
    pending;

  document.getElementById('statActive').textContent =
    Math.max(active, 0);

  document.getElementById('statCompleted').textContent =
    completed;

}


/* =========================================================
   TEMPORARY ORDER VIEW
   ========================================================= */

function openOwnerOrder(orderId) {

  const order = ownerOrdersCache.find(
    o => String(o.orderId) === String(orderId)
  );

  if (!order) {
    alert('Order not found.');
    return;
  }

  const existing = document.getElementById('ownerOrderModal');

  if (existing) {
    existing.remove();
  }

  const amount = Number(order.amount || 0);
  const advance = Number(order.advance || 0);
  const remaining = Number(order.remaining || 0);

  const modal = document.createElement('div');

  modal.id = 'ownerOrderModal';
  modal.className = 'owner-modal-overlay';

  modal.innerHTML = `
    <div class="owner-modal-box">

      <div class="owner-modal-header">

        <div>
          <div class="owner-modal-eyebrow">
            MEMORA ORDER
          </div>

          <h2>
            ${escapeOwnerHtml(order.packageSummary || 'Order')}
          </h2>

          <div class="owner-modal-order-id">
            ${escapeOwnerHtml(order.orderId || '')}
          </div>
        </div>

        <button
          type="button"
          class="owner-modal-close"
          onclick="closeOwnerOrder()"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="owner-modal-status-row">

        <span class="owner-status">
          ${escapeOwnerHtml(order.status || 'UNKNOWN')}
        </span>

        <span class="owner-payment-status">
          ${escapeOwnerHtml(order.paymentStatus || '—')}
        </span>

      </div>


      <div class="owner-detail-section">

        <h3>Customer</h3>

        <div class="owner-detail-grid">

          <div>
            <span>Name</span>
            <strong>
              ${escapeOwnerHtml(order.customerName || '—')}
            </strong>
          </div>

          <div>
            <span>Email</span>
            <strong>
              ${escapeOwnerHtml(order.customerEmail || '—')}
            </strong>
          </div>

          <div>
            <span>Phone</span>
            <strong>
              ${escapeOwnerHtml(order.customerPhone || '—')}
            </strong>
          </div>

          <div>
            <span>WhatsApp</span>
            <strong>
              ${escapeOwnerHtml(order.customerWhatsapp || '—')}
            </strong>
          </div>

        </div>

      </div>


      <div class="owner-detail-section">

        <h3>Booking</h3>

        <div class="owner-detail-grid">

          <div>
            <span>Order Type</span>
            <strong>
              ${escapeOwnerHtml(order.orderType || '—')}
            </strong>
          </div>

          <div>
            <span>Category</span>
            <strong>
              ${escapeOwnerHtml(order.category || '—')}
            </strong>
          </div>

          <div>
            <span>Event Date</span>
            <strong>
              ${escapeOwnerHtml(order.eventDate || '—')}
            </strong>
          </div>

          <div>
            <span>Delivery</span>
            <strong>
              ${escapeOwnerHtml(order.delivery || '—')}
            </strong>
          </div>

        </div>

      </div>


      <div class="owner-detail-section">

        <h3>Payment</h3>

        <div class="owner-payment-summary">

          <div>
            <span>Total</span>
            <strong>
              ₹${amount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </strong>
          </div>

          <div>
            <span>Advance — 10%</span>
            <strong>
              ₹${advance.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </strong>
          </div>

          <div>
            <span>Final — 90%</span>
            <strong>
              ₹${remaining.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </strong>
          </div>

        </div>

      </div>


      <div class="owner-detail-section">

        <h3>Customer Requirements</h3>

        <div class="owner-requirements">
          ${escapeOwnerHtml(order.requirements || 'No additional requirements provided.')}
        </div>

      </div>


      <div class="owner-detail-section">

        <h3>Order Information</h3>

        <div class="owner-detail-grid">

          <div>
            <span>Created</span>
            <strong>
              ${formatOwnerDate(order.createdAt)}
            </strong>
          </div>

          <div>
            <span>Accepted</span>
            <strong>
              ${formatOwnerDate(order.acceptedAt)}
            </strong>
          </div>

          <div>
            <span>Confirmed</span>
            <strong>
              ${formatOwnerDate(order.confirmedAt)}
            </strong>
          </div>

          <div>
            <span>Cancellation Deadline</span>
            <strong>
              ${formatOwnerDate(order.cancellationDeadline)}
            </strong>
          </div>

        </div>

      </div>


      <div class="owner-detail-actions">

        ${ownerOrderActionButtons(order)}

      </div>


    </div>
  `;

  modal.addEventListener('click', function(e) {

    if (e.target === modal) {
      closeOwnerOrder();
    }

  });

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

}

function closeOwnerOrder() {

  const modal = document.getElementById('ownerOrderModal');

  if (!modal) return;

  modal.classList.remove('open');

  setTimeout(() => {

    if (modal) {
      modal.remove();
    }

  }, 180);

}


function formatOwnerDate(value) {

  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

}


function ownerOrderActionButtons(order) {

  const id = escapeOwnerAttr(order.orderId);

  let html = '';

  if (order.status === 'PENDING REVIEW') {

    html += `
      <button
        type="button"
        class="navbtn"
        onclick="acceptOwnerOrder('${id}')"
      >
        Accept Booking
      </button>

      <button
        type="button"
        class="navbtn outline"
        onclick="rejectOwnerOrder('${id}')"
      >
        Reject Booking
      </button>
    `;

  }

  if (
    order.paymentStatus === 'PENDING' &&
    order.status === 'ACCEPTED — PAYMENT PENDING'
  ) {

    html += `
      <div class="owner-action-note">
        Waiting for customer's advance payment.
      </div>
    `;

  }

  if (order.paymentStatus === 'PENDING' && order.utr) {

    html += `
      <button
        type="button"
        class="goldbtn"
        onclick="verifyOwnerAdvancePayment('${id}')"
      >
        Verify Advance Payment
      </button>

      <button
        type="button"
        class="navbtn outline"
        onclick="rejectOwnerAdvancePayment('${id}')"
      >
        Reject Payment
      </button>
    `;

  }

  if (order.paymentStatus === 'ADVANCE RECEIVED') {

    html += `
      <div class="owner-action-note">
        Advance payment received. Booking is confirmed.
      </div>

      <button
        type="button"
        class="navbtn"
        onclick="setOwnerStatus('${id}','IN PROGRESS')"
      >
        Start Production
      </button>
    `;

  }

  if (
    order.status === 'IN PROGRESS' &&
    order.paymentStatus === 'ADVANCE RECEIVED'
  ) {

    html += `
      <button
        type="button"
        class="goldbtn"
        onclick="requestOwnerFinalPayment('${id}')"
      >
        Request Final Payment
      </button>
    `;

  }

  if (order.paymentStatus === 'FINAL PAYMENT DUE' && order.finalUtr) {

    html += `
      <button
        type="button"
        class="goldbtn"
        onclick="verifyOwnerFinalPayment('${id}')"
      >
        Verify Final Payment
      </button>

      <button
        type="button"
        class="navbtn outline"
        onclick="rejectOwnerFinalPayment('${id}')"
      >
        Reject Final Payment
      </button>
    `;

  }

  if (order.paymentStatus === 'FULL PAYMENT RECEIVED') {

    html += `
      <button
        type="button"
        class="navbtn"
        onclick="setOwnerStatus('${id}','DELIVERED')"
      >
        Mark Delivered
      </button>
    `;

  }

  if (order.status === 'DELIVERED') {

    html += `
      <button
        type="button"
        class="navbtn"
        onclick="setOwnerStatus('${id}','COMPLETED')"
      >
        Mark Completed
      </button>
    `;

  }

  if (!html) {

    html = `
      <div class="owner-action-note">
        No actions are currently available for this order.
      </div>
    `;

  }

  return html;

}

/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeOwnerHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


function escapeOwnerAttr(value) {

  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

}

/* =========================================================
   OWNER ORDER ACTIONS
   ========================================================= */

async function acceptOwnerOrder(orderId) {

  const order = ownerOrdersCache.find(
    o => String(o.orderId) === String(orderId)
  );

  if (!order) {
    alert('Order not found.');
    return;
  }

  if (!confirm(
    'Accept this booking?\n\nThe customer will move to the payment stage.'
  )) {
    return;
  }

  try {

    const patch = {
      status: 'ACCEPTED — PAYMENT PENDING',
      paymentStatus: 'PENDING'
    };

    if (!order.acceptedAt) {
      patch.acceptedAt = Date.now();
    }

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        ...patch,
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Accept booking failed:', error);

    alert(
      'Could not accept this booking. Please check Firebase.'
    );

  }
}


async function rejectOwnerOrder(orderId) {

  if (!confirm(
    'Reject this booking?\n\nThis will mark the order as CANCELLED.'
  )) {
    return;
  }

  try {

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        status: 'CANCELLED',
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Reject booking failed:', error);

    alert('Could not reject this booking.');

  }
}


async function verifyOwnerAdvancePayment(orderId) {

  const order = ownerOrdersCache.find(
    o => String(o.orderId) === String(orderId)
  );

  if (!order) {
    alert('Order not found.');
    return;
  }

  if (!order.utr) {
    alert('No advance payment proof has been submitted yet.');
    return;
  }

  if (!confirm(
    'Verify the advance payment?\n\nUTR: ' + order.utr
  )) {
    return;
  }

  try {

    const patch = {
      paymentStatus: 'ADVANCE RECEIVED',
      status: 'CONFIRMED'
    };

    if (!order.confirmedAt) {
      patch.confirmedAt = Date.now();
      patch.cancellationDeadline =
        Date.now() + (24 * 60 * 60 * 1000);
    }

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        ...patch,
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Verify advance payment failed:', error);

    alert('Could not verify the advance payment.');

  }
}


async function rejectOwnerAdvancePayment(orderId) {

  if (!confirm(
    'Reject this payment proof?\n\nThe customer will need to submit it again.'
  )) {
    return;
  }

  try {

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        paymentStatus: 'PENDING',
        utr: '',
        paymentDate: '',
        paymentTime: '',
        paymentSubmittedAt: null,
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Reject advance payment failed:', error);

    alert('Could not reject the payment proof.');

  }
}


async function setOwnerStatus(orderId, status) {

  let message = 'Change order status to:\n\n' + status + '?';

  if (status === 'IN PROGRESS') {
    message = 'Start production for this order?';
  }

  if (status === 'DELIVERED') {
    message = 'Mark this order as delivered?';
  }

  if (status === 'COMPLETED') {
    message = 'Mark this order as completed?';
  }

  if (!confirm(message)) {
    return;
  }

  try {

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        status: status,
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Change order status failed:', error);

    alert('Could not update the order status.');

  }
}


async function requestOwnerFinalPayment(orderId) {

  if (!confirm(
    'Request the final 90% payment from the customer?'
  )) {
    return;
  }

  try {

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        paymentStatus: 'FINAL PAYMENT DUE',
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Request final payment failed:', error);

    alert('Could not request final payment.');

  }
}


async function verifyOwnerFinalPayment(orderId) {

  const order = ownerOrdersCache.find(
    o => String(o.orderId) === String(orderId)
  );

  if (!order) {
    alert('Order not found.');
    return;
  }

  if (!order.finalUtr) {
    alert('No final payment proof has been submitted yet.');
    return;
  }

  if (!confirm(
    'Verify the final payment?\n\nUTR: ' + order.finalUtr
  )) {
    return;
  }

  try {

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        paymentStatus: 'FULL PAYMENT RECEIVED',
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Verify final payment failed:', error);

    alert('Could not verify the final payment.');

  }
}


async function rejectOwnerFinalPayment(orderId) {

  if (!confirm(
    'Reject this final payment proof?\n\nThe customer will need to submit it again.'
  )) {
    return;
  }

  try {

    await ownerDb
      .collection('memora_orders_coll')
      .doc(String(orderId))
      .set({
        finalUtr: '',
        finalPaymentDate: '',
        finalPaymentTime: '',
        finalPaymentSubmittedAt: null,
        _ts: Date.now()
      }, {
        merge: true
      });

    closeOwnerOrder();

  } catch (error) {

    console.error('Reject final payment failed:', error);

    alert('Could not reject the final payment.');

  }
}