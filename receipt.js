let activeReceiptPayment = null;

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

function receiptDetails(payment) {
  const project = projects.find(item => item.id === payment.project?.projectNumber || item.name === payment.project?.name || item.name === payment.projectName);
  const client = clients.find(item => item.name === project?.client || item.name === payment.clientName);
  const amount = Number(payment.amount) || 0;
  const contract = Number(project?.amount) || 0;
  const totalPaid = Number(project?.paid) || 0;
  const paidBefore = Math.max(0, totalPaid - amount);
  const balance = Math.max(0, contract - totalPaid);
  const customer = project?.client || payment.clientName || 'Customer';
  const projectName = project?.name || payment.project?.name || payment.projectName || 'Construction project';
  const customerPhone = payment.whatsapp || project?.whatsapp || client?.phone || '+231 __________';
  const email = payment.clientEmail || project?.clientEmail || client?.email || '';
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
  const receiverName = currentUser?.displayName || document.getElementById('profile-name').textContent;
  const receiverPosition = currentUser?.role || document.getElementById('profile-role').textContent;
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
    if (activeView === 'payments') paymentsView();
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
