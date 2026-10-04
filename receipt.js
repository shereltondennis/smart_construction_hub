let activeReceiptPayment = null;
const projectPaymentsStorageKey = 'smart-construction-hub-project-payments';
let payments = [];

try {
  const savedPayments = JSON.parse(localStorage.getItem(projectPaymentsStorageKey) || '[]');
  if (Array.isArray(savedPayments)) {
    payments = savedPayments.filter(payment =>
      payment &&
      payment.project &&
      typeof payment.project.projectNumber === 'string' &&
      Number.isFinite(Number(payment.amount))
    );
    payments.forEach(payment => {
      const project = projects.find(item => item.id === payment.project.projectNumber);
      if (!project) return;
      project.paid = Math.max(Number(project.paid) || 0, Number(payment.projectPaidAfter) || 0);
      if (!project.paymentScheduleRestored) {
        project.nextPaymentDate = payment.nextPaymentDate || '';
        project.nextPaymentAmount = Number(payment.nextPaymentAmount) || 0;
        project.paymentScheduleRestored = true;
      }
      if (project.paid >= Number(project.amount) || !project.nextPaymentDate) {
        if (project.status === 'Pending payment') project.status = 'In progress';
      } else {
        project.status = project.nextPaymentDate <= localDateString() ? 'Pending payment' : 'In progress';
      }
    });
    projects.forEach(project => { delete project.paymentScheduleRestored; });
  }
} catch (error) {
  console.error('Project payments could not be restored from this browser.', error);
}

function openPaymentModal(projectId) {
  const project = projects.find(item => item.id === projectId);
  const form = document.getElementById('payment-form');
  if (!project || !form) {
    window.alert('The selected project could not be loaded for payment.');
    return;
  }

  form.reset();
  const projectSelect = form.elements.project;
  projectSelect.replaceChildren();
  projects.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} · ${item.client}`;
    projectSelect.appendChild(option);
  });
  projectSelect.value = project.id;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  form.elements.paymentDate.value = now.toISOString().slice(0, 16);
  form.elements.amount.max = Math.max(0, Number(project.amount) - (Number(project.paid) || 0)).toFixed(2);
  form.elements.amount.value = '';
  form.elements.nextPaymentDate.value = '';
  form.elements.nextPaymentAmount.value = '';
  form.elements.client.value = project.client || '';
  form.elements.clientEmail.value = project.clientEmail || '';
  form.elements.whatsapp.value = project.whatsapp || project.clientPhone || '';
  updatePaymentBalance(form, project);
  document.getElementById('payment-modal-backdrop').hidden = false;
  form.elements.amount.focus();
}

function updatePaymentBalance(form, project) {
  const balance = Math.max(0, Number(project.amount) - (Number(project.paid) || 0));
  const paymentAmount = Number(form.elements.amount.value) || 0;
  const balanceAfter = Math.max(0, balance - paymentAmount);
  form.elements.balanceBefore.value = balance.toFixed(2);
  form.elements.balanceAfter.value = balanceAfter.toFixed(2);
  form.elements.nextPaymentDate.required = balanceAfter > 0;
  form.elements.nextPaymentAmount.required = balanceAfter > 0;
  form.elements.nextPaymentDate.disabled = balanceAfter <= 0;
  form.elements.nextPaymentAmount.disabled = balanceAfter <= 0;
  if (balanceAfter <= 0) {
    form.elements.nextPaymentDate.value = '';
    form.elements.nextPaymentAmount.value = '';
  } else {
    form.elements.nextPaymentAmount.max = balanceAfter.toFixed(2);
  }
}

function closePaymentModal() {
  document.getElementById('payment-modal-backdrop').hidden = true;
}

const paymentForm = document.getElementById('payment-form');
paymentForm.elements.project.addEventListener('change', () => {
  const project = projects.find(item => item.id === paymentForm.elements.project.value);
  if (!project) return;
  paymentForm.elements.nextPaymentDate.value = '';
  paymentForm.elements.nextPaymentAmount.value = '';
  paymentForm.elements.client.value = project.client || '';
  paymentForm.elements.clientEmail.value = project.clientEmail || '';
  paymentForm.elements.whatsapp.value = project.whatsapp || project.clientPhone || '';
  paymentForm.elements.amount.max = Math.max(0, Number(project.amount) - (Number(project.paid) || 0)).toFixed(2);
  updatePaymentBalance(paymentForm, project);
});
paymentForm.elements.amount.addEventListener('input', () => {
  const project = projects.find(item => item.id === paymentForm.elements.project.value);
  if (project) updatePaymentBalance(paymentForm, project);
});
paymentForm.elements.paymentDate.addEventListener('change', () => {
  const project = projects.find(item => item.id === paymentForm.elements.project.value);
  if (project) updatePaymentBalance(paymentForm, project);
});
paymentForm.addEventListener('submit', event => {
  if (paymentForm.dataset.paymentMode === 'edit') return;
  event.preventDefault();
  if (!paymentForm.reportValidity()) return;

  const project = projects.find(item => item.id === paymentForm.elements.project.value);
  const amount = Number(paymentForm.elements.amount.value);
  if (!project || !Number.isFinite(amount) || amount <= 0) {
    window.alert('Select a project and enter a valid payment amount.');
    return;
  }
  const paidBefore = Number(project.paid) || 0;
  const paidAfter = Math.round((paidBefore + amount) * 100) / 100;
  if (paidAfter > Number(project.amount) + 0.001) {
    window.alert('The payment cannot be greater than the project balance.');
    return;
  }
  const remainingBalance = Math.max(0, Number(project.amount) - paidAfter);
  const nextPaymentDateValue = paymentForm.elements.nextPaymentDate.value;
  const nextPaymentAmount = Number(paymentForm.elements.nextPaymentAmount.value);
  if (remainingBalance > 0) {
    if (!nextPaymentDateValue || !Number.isFinite(nextPaymentAmount) || nextPaymentAmount <= 0 || nextPaymentAmount > remainingBalance) {
      window.alert('Set a valid next payment date and an amount no greater than the remaining balance.');
      return;
    }
  }
  const paymentDate = new Date(paymentForm.elements.paymentDate.value);
  if (Number.isNaN(paymentDate.getTime())) {
    window.alert('Enter a valid payment date and time.');
    return;
  }
  if (remainingBalance > 0 && nextPaymentDateValue <= paymentForm.elements.paymentDate.value.slice(0, 10)) {
    window.alert('The next payment date must be after the payment date.');
    return;
  }
  const payment = {
    id: `local-${Date.now()}`,
    receiptNumber: `SCH-${String(Date.now()).slice(-8).padStart(6, '0')}`,
    project: { projectNumber: project.id, name: project.name },
    projectName: project.name,
    clientName: project.client,
    clientEmail: project.clientEmail || '',
    whatsapp: project.whatsapp || project.clientPhone || '',
    paymentDate: paymentDate.toISOString(),
    amount,
    paymentMethod: paymentForm.elements.paymentMethod.value,
    notes: paymentForm.elements.notes.value.trim(),
    projectPaidAfter: paidAfter,
    nextPaymentDate: remainingBalance > 0 ? nextPaymentDateValue : '',
    nextPaymentAmount: remainingBalance > 0 ? nextPaymentAmount : 0
  };
  const nextPayments = [payment, ...payments];

  try {
    localStorage.setItem(projectPaymentsStorageKey, JSON.stringify(nextPayments));
  } catch (error) {
    console.error('Project payment could not be saved in this browser.', error);
    window.alert('The payment could not be saved in this browser. Check available storage and try again.');
    return;
  }

  payments = nextPayments;
  project.paid = paidAfter;
  project.nextPaymentDate = payment.nextPaymentDate;
  project.nextPaymentAmount = payment.nextPaymentAmount;
  project.status = payment.nextPaymentDate && payment.nextPaymentDate <= localDateString() ? 'Pending payment' : 'In progress';
  paymentForm.reset();
  closePaymentModal();
  if (activeView === 'payments') setView('payments');
  showReceipt(payment);
});
paymentForm.addEventListener('reset', event => {
  const form = event.currentTarget;
  form.dataset.paymentMode = '';
  form.onsubmit = null;
});
document.getElementById('payment-modal-close').addEventListener('click', closePaymentModal);
document.getElementById('payment-form-cancel').addEventListener('click', closePaymentModal);
document.getElementById('payment-modal-backdrop').addEventListener('click', event => {
  if (event.target.id === 'payment-modal-backdrop') closePaymentModal();
});
document.getElementById('receipt-modal-backdrop').addEventListener('click', event => {
  if (event.target.id === 'receipt-modal-backdrop') closeReceipt();
});

function receiptEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function receiptCurrency(value) {
  return `US$ ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function receiptWords(value) {
  const small = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const underThousand = number => {
    const words = [];
    if (number >= 100) words.push(`${small[Math.floor(number / 100)]} Hundred`);
    number %= 100;
    if (number >= 20) words.push(`${tens[Math.floor(number / 10)]}${number % 10 ? ` ${small[number % 10]}` : ''}`);
    else if (number > 0) words.push(small[number]);
    return words.join(' ');
  };

  const totalCents = Math.round(Math.abs(Number(value) || 0) * 100);
  let dollars = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const groups = [];
  let scale = 0;
  while (dollars > 0 && scale < scales.length) {
    const group = dollars % 1000;
    if (group) groups.unshift(`${underThousand(group)}${scales[scale] ? ` ${scales[scale]}` : ''}`);
    dollars = Math.floor(dollars / 1000);
    scale += 1;
  }
  const amount = groups.join(' ') || 'Zero';
  return `${amount} United States Dollars${cents ? ` and ${String(cents).padStart(2, '0')}/100 Cents` : ''}`;
}

function receiptDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function receiptId(payment) {
  if (String(payment.receiptNumber || '').startsWith('SCH-')) return payment.receiptNumber;
  const storedId = Number(payment.id);
  const fallback = Number(String(payment.id || '').replace(/\D/g, '').slice(-6)) || Date.now() % 1000000;
  return `SCH-${String(Number.isFinite(storedId) && storedId > 0 ? storedId : fallback).padStart(6, '0')}`;
}

function closeReceipt() {
  document.getElementById('receipt-modal-backdrop').hidden = true;
}

function receiptDetails(payment) {
  const project = projects.find(item => item.id === payment.project?.projectNumber || item.name === payment.project?.name || item.name === payment.projectName);
  const amount = Number(payment.amount) || 0;
  const contract = Number(project?.amount) || 0;
  const totalPaid = Number(project?.paid) || 0;
  const paidBefore = Math.max(0, totalPaid - amount);
  const balance = Math.max(0, contract - totalPaid);
  const customer = project?.client || payment.clientName || 'Customer';
  const projectName = project?.name || payment.project?.name || payment.projectName || 'Construction project';
  const customerPhone = payment.whatsapp || project?.whatsapp || project?.clientPhone || '+231 __________';
  const email = payment.clientEmail || project?.clientEmail || '';
  const date = receiptDate(payment.paymentDate || new Date());
  const number = receiptId(payment);
  const paymentMethod = payment.paymentMethod || 'Cash';
  const description = payment.notes || 'Construction Deposit';
  const text = [
    'SMART CONSTRUCTION HUB',
    'Building Your Home Up to Standard',
    `Receipt No.: ${number}`,
    `Date: ${date}`,
    `Received From: ${customer}`,
    `Project: ${projectName}`,
    `Payment For: ${description}`,
    `Payment Method: ${paymentMethod}`,
    `Amount Received: ${receiptCurrency(amount)}`,
    `Amount in Words: ${receiptWords(amount)}`,
    `Total Contract Amount: ${receiptCurrency(contract)}`,
    `Previous Payments: ${receiptCurrency(paidBefore)}`,
    `Remaining Balance: ${receiptCurrency(balance)}`
  ].join('\n');
  return { project, customer, projectName, customerPhone, email, amount, contract, paidBefore, balance, date, number, paymentMethod, description, text };
}

function showReceipt(payment) {
  if (!payment) return;
  activeReceiptPayment = payment;
  const details = receiptDetails(payment);
  const receiverName = typeof currentUser !== 'undefined' && currentUser?.displayName || document.getElementById('profile-name')?.textContent || 'Administrator';
  const receiverPosition = typeof currentUser !== 'undefined' && currentUser?.role || document.getElementById('profile-role')?.textContent || 'Administrator';
  const documentNode = document.getElementById('receipt-content');
  documentNode.innerHTML = `
    <article class="receipt-document">
      <header class="receipt-heading">
        <img class="receipt-logo" src="logo.png" alt="Smart Construction Hub logo">
        <div class="receipt-company">SMART CONSTRUCTION HUB</div>
        <div class="receipt-tagline">Building Your Home Up to Standard</div>
        <div class="receipt-contact">Monrovia, Liberia<br>Phone: +231 888 827 060 | Email: info.smartconstructionhub@gmail.com</div>
      </header>
      <div class="receipt-title-row">
        <h2 id="receipt-modal-title">CASH RECEIPT</h2>
        <span class="receipt-status">PAID</span>
      </div>
      <section class="receipt-info-grid" aria-label="Receipt details">
        <div><span>Receipt No.:</span><strong>${receiptEscape(details.number)}</strong></div>
        <div><span>Date:</span><strong>${receiptEscape(details.date)}</strong></div>
      </section>
      <section class="receipt-section">
        <h3>CUSTOMER INFORMATION</h3>
        <div class="receipt-info-grid">
          <div><span>Received From:</span><strong>${receiptEscape(details.customer)}</strong></div>
          <div><span>Phone:</span><strong>${receiptEscape(details.customerPhone)}</strong></div>
          <div class="receipt-wide"><span>Project:</span><strong>${receiptEscape(details.projectName)}</strong></div>
        </div>
      </section>
      <section class="receipt-section">
        <h3>PAYMENT INFORMATION</h3>
        <table class="receipt-breakdown"><thead><tr><th>Description</th><th>Details</th></tr></thead><tbody>
          <tr><td>Payment For</td><td>${receiptEscape(details.description)}</td></tr>
          <tr><td>Payment Method</td><td>${receiptEscape(details.paymentMethod)}</td></tr>
          <tr class="receipt-highlight"><td>Amount Received</td><td>${receiptCurrency(details.amount)}</td></tr>
          <tr><td>Amount in Words</td><td>${receiptEscape(receiptWords(details.amount))}</td></tr>
          <tr><td>Total Contract Amount</td><td>${receiptCurrency(details.contract)}</td></tr>
          <tr><td>Previous Payments</td><td>${receiptCurrency(details.paidBefore)}</td></tr>
          <tr class="receipt-balance-row"><td>Remaining Balance</td><td>${receiptCurrency(details.balance)}</td></tr>
        </tbody></table>
      </section>
      <section class="receipt-section receipt-confirmation">
        <h3>PAYMENT CONFIRMATION</h3>
        <p>This receipt confirms that Smart Construction Hub has received the amount stated above from the customer for the project and purpose indicated on this receipt.</p>
        <div class="receipt-signoff">
          <div class="receipt-signatures">
            <div><span>Received By:</span><strong>${receiptEscape(receiverName)}</strong></div>
            <div><span>Position:</span><strong>${receiptEscape(receiverPosition)}</strong></div>
            <div><span>Date:</span><strong>${receiptEscape(details.date)}</strong></div>
            <div class="receipt-signature-line"><span>Customer Signature:</span><strong>${receiptEscape(details.customer)}</strong><span class="receipt-signature-rule">______________________</span></div>
          </div>
          <div class="receipt-verification"><strong>Digital Verification</strong><span>Receipt ID: ${receiptEscape(details.number)}</span><div class="receipt-qr" aria-label="QR code placeholder">QR<br>CODE</div></div>
        </div>
      </section>
      <footer class="receipt-generated">This receipt was digitally generated by Smart Construction Hub.</footer>
    </article>`;

  document.getElementById('receipt-modal-close').onclick = closeReceipt;
  document.getElementById('receipt-print').onclick = () => window.print();
  document.getElementById('receipt-download').onclick = () => window.print();
  document.getElementById('receipt-send').disabled = !details.email;
  document.getElementById('receipt-send').onclick = () => {
    if (!details.email) return;
    window.location.href = `mailto:${encodeURIComponent(details.email)}?subject=${encodeURIComponent(`Smart Construction Hub receipt ${details.number}`)}&body=${encodeURIComponent(details.text)}`;
  };
  document.getElementById('receipt-share').onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${details.number}`, text: details.text });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details.text);
        window.alert('Receipt details copied.');
      } else window.prompt('Copy receipt details:', details.text);
    } catch (error) {
      if (error.name !== 'AbortError') window.alert('Sharing is unavailable in this browser.');
    }
  };
  document.getElementById('receipt-edit').onclick = () => editReceiptPayment(payment);
  document.getElementById('receipt-modal-backdrop').hidden = false;
}

function editReceiptPayment(payment) {
  const details = receiptDetails(payment);
  const project = details.project;
  if (!project) return;
  const form = document.getElementById('payment-form');
  openPaymentModal(project.id);
  form.elements.project.disabled = true;
  form.elements.paymentDate.value = new Date(payment.paymentDate).toISOString().slice(0, 16);
  form.elements.amount.value = Number(payment.amount);
  form.elements.paymentMethod.value = payment.paymentMethod || 'Cash';
  form.elements.notes.value = payment.notes || '';
  form.dataset.paymentMode = 'edit';
  document.getElementById('payment-modal-title').textContent = 'Edit payment';
  form.querySelector('[type="submit"]').textContent = 'Save changes';
  form.onsubmit = event => saveReceiptPaymentEdit(event, payment, project);
  document.getElementById('receipt-modal-backdrop').hidden = true;
}

async function saveReceiptPaymentEdit(event, payment, project) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const amount = Number(data.get('amount'));
  const paymentDate = new Date(data.get('paymentDate')).toISOString();
  const updated = {
    paymentDate,
    amount,
    paymentMethod: data.get('paymentMethod'),
    notes: String(data.get('notes') || '').trim()
  };

  try {
    if (Number.isInteger(Number(payment.id)) && project.apiId) {
      const response = await fetch(`${API_BASE}/payments/${payment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!response.ok) throw new Error('Payment could not be updated. Restart the API and try again.');
    }
    project.paid = Math.max(0, project.paid - Number(payment.amount) + amount);
    Object.assign(payment, updated);
    payments = payments.map(item => String(item.id) === String(payment.id) ? payment : item);
    form.elements.project.disabled = false;
    form.reset();
    document.getElementById('payment-modal-backdrop').hidden = true;
    document.getElementById('payment-modal-title').textContent = 'Record a payment';
    form.querySelector('[type="submit"]').innerHTML = 'Record payment <span>→</span>';
    if (activeView === 'payments') setView('payments');
    showReceipt(payment);
  } catch (error) {
    window.alert(error.message);
  }
}

document.getElementById('payment-form').addEventListener('reset', event => {
  const form = event.currentTarget;
  form.elements.project.disabled = false;
  document.getElementById('payment-modal-title').textContent = 'Record a payment';
  form.querySelector('[type="submit"]').innerHTML = 'Record payment <span>→</span>';
});
