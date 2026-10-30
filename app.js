const API_BASE_URL = window.SCH_API_BASE_URL || 'http://localhost:5050/api';
const API_BASE = API_BASE_URL;
let databaseConnected = false;
let projects = [
  {
    id: 'PRJ-024',
    name: 'Willow Creek Residence',
    client: 'John Doe',
    type: 'New construction',
    location: 'Sinkor, Monrovia',
    status: 'In progress',
    amount: 25000,
    paid: 14800,
    progress: 62,
    progressReports: [
      { date: '2026-09-08', percent: 18, summary: 'Site cleared and foundation trenching completed.' },
      { date: '2026-09-10', percent: 34, summary: 'Concrete footing and reinforcement work completed.' },
      { date: '2026-09-12', percent: 62, summary: 'Block wall construction is progressing on schedule.' }
    ]
  },
  {
    id: 'PRJ-023',
    name: 'Mason Street Renovation',
    client: 'Amara Mensah',
    type: 'Renovation',
    location: 'Paynesville, Montserrado County',
    status: 'In progress',
    amount: 12600,
    paid: 8100,
    progress: 48,
    progressReports: [
      { date: '2026-09-06', percent: 15, summary: 'Demolition and material sorting completed.' },
      { date: '2026-09-09', percent: 32, summary: 'Plumbing rerouting and wall finishing started.' },
      { date: '2026-09-12', percent: 48, summary: 'Renovation work is advancing steadily.' }
    ]
  },
  {
    id: 'PRJ-022',
    name: 'Kofi Roof Replacement',
    client: 'David Kimani',
    type: 'Roofing',
    location: 'Gbarnga, Bong County',
    status: 'Awaiting review',
    amount: 8400,
    paid: 8400,
    progress: 91,
    progressReports: [
      { date: '2026-09-04', percent: 52, summary: 'Roof framing and sheet placement are finished.' },
      { date: '2026-09-11', percent: 91, summary: 'Final waterproofing and finishing are almost complete.' }
    ]
  },
  {
    id: 'PRJ-021',
    name: 'Palm Grove Interiors',
    client: 'Sarah Owusu',
    type: 'Interior finishing',
    location: 'Buchanan, Grand Bassa County',
    status: 'Complete',
    amount: 18900,
    paid: 18900,
    progress: 100,
    progressReports: [
      { date: '2026-09-05', percent: 40, summary: 'Interior trim and finishing started in the main rooms.' },
      { date: '2026-09-10', percent: 82, summary: 'Final paint and cabinetry work nearly completed.' },
      { date: '2026-09-13', percent: 100, summary: 'Project completed and client walkthrough scheduled.' }
    ]
  }
];

const createdProjectsStorageKey = 'smart-construction-hub-created-projects';
const projectContactsStorageKey = 'smart-construction-hub-project-contacts';
const projectClientEditsStorageKey = 'smart-construction-hub-project-client-edits';
let recordBeingEdited = null;
const projectWorkerAssignmentsStorageKey = 'smart-construction-hub-project-worker-assignments';
const projectWorkersStorageKey = 'smart-construction-hub-project-workers';
const estimatePdfDatabaseName = 'smart-construction-hub-documents';
const estimatePdfStoreName = 'estimate-pdfs';
let activeEstimatePdfUrl = '';
let projectWorkers = [];
let payments = [];
let dashboardWorkerPayments = [];
const builtInProjectIds = new Set(projects.map(project => project.id));

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (response.status === 401) {
    lockAdminWorkspace();
    throw new Error('Your session expired. Sign in again to continue.');
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

async function readReceiptCopy(file) {
  if (!file) return null;
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!supportedTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, or PDF copy of the paper receipt.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Receipt copies must be 8 MB or smaller.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The receipt copy could not be read.'));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, contentType: file.type, data: dataUrl.split(',')[1] };
}

async function openReceiptCopy(payment, kind) {
  if (!payment?.receiptCopyFileName) return;
  const preview = window.open('about:blank', '_blank');
  if (!preview) {
    window.alert('Allow pop-ups to view the uploaded receipt copy.');
    return;
  }
  try {
    let blob;
    if (payment.receiptCopyData) {
      const byteString = atob(payment.receiptCopyData);
      const bytes = Uint8Array.from(byteString, character => character.charCodeAt(0));
      blob = new Blob([bytes], { type: payment.receiptCopyContentType || 'application/octet-stream' });
    } else {
      const route = kind === 'worker' ? 'worker-payments' : 'payments';
      const response = await fetch(`${API_BASE_URL}/${route}/${payment.id}/receipt-copy`, { credentials: 'include' });
      if (response.status === 401) lockAdminWorkspace();
      if (!response.ok) throw new Error('The uploaded receipt copy could not be loaded.');
      blob = await response.blob();
    }
    const url = URL.createObjectURL(blob);
    preview.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    preview.close();
    window.alert(error.message);
  }
}

window.readReceiptCopy = readReceiptCopy;
window.openReceiptCopy = openReceiptCopy;

async function loadProjectsFromDatabase() {
  const records = await apiRequest('/projects');
  projects = records.map(record => {
    const paid = (record.payments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0);
    return {
      id: record.projectNumber || `PRJ-${String(record.id).padStart(3, '0')}`,
      databaseId: record.id,
      apiId: record.id,
      name: record.name,
      client: record.client?.fullName || 'Unknown client',
      clientId: record.client?.id,
      clientPhone: record.client?.phoneNumber || '',
      clientEmail: record.client?.email || '',
      type: record.typeOfWork || 'Construction',
      location: record.location || '',
      status: record.status,
      amount: Number(record.contractAmount || 0),
      paid,
      progress: record.status === 'Complete' ? 100 : 0,
      startDate: record.startDate || '',
      expectedCompletionDate: record.expectedCompletionDate || '',
      payments: record.payments || [],
      progressReports: [],
      workerAssignments: record.workers || []
    };
  });
  window.companyBalance = await apiRequest('/company-balance');
  const mainBalanceNode = document.querySelector('[data-main-balance]');
  if (mainBalanceNode) mainBalanceNode.textContent = money(window.companyBalance.amount);
  await apiRequest(`/workers/accrue?throughDate=${localDateString()}`, { method: 'POST' });
  const databasePayments = await apiRequest('/payments');
  const workerRecords = await apiRequest('/workers');
  dashboardWorkerPayments = await apiRequest('/worker-payments');
  window.setWorkerRecords?.(workerRecords);
  const legacyPayments = Array.isArray(payments) ? payments : [];
  payments = databasePayments.map(payment => ({
    ...payment,
    project: { projectNumber: payment.project?.projectNumber || projects.find(project => project.databaseId === payment.projectId)?.id, name: payment.project?.name },
    projectName: payment.project?.name || 'Project',
    clientName: payment.project?.client?.fullName || '',
    projectPaidAfter: projects.find(project => project.databaseId === payment.projectId)?.paid || 0
  }));
  const savedReceiptIds = new Set(payments.map(payment => String(payment.receiptNumber || payment.id)));
  payments.push(...legacyPayments.filter(payment => !savedReceiptIds.has(String(payment.receiptNumber || payment.id))));
  databaseConnected = true;
}

try {
  const savedProjects = JSON.parse(localStorage.getItem(createdProjectsStorageKey) || '[]');
  if (Array.isArray(savedProjects)) {
    projects.push(...savedProjects.filter(project =>
      project &&
      typeof project.id === 'string' &&
      !builtInProjectIds.has(project.id) &&
      typeof project.name === 'string' &&
      typeof project.client === 'string' &&
      typeof project.type === 'string' &&
      typeof project.location === 'string' &&
      Number.isFinite(Number(project.amount))
    ).map(project => ({
      ...project,
      paid: Number(project.paid) || 0,
      progress: Number(project.progress) || 0,
      progressReports: Array.isArray(project.progressReports) ? project.progressReports : []
    })));
  }
} catch (error) {
  console.error('Created projects could not be restored from this browser.', error);
}

let activeView = 'overview';
let projectCreationClientName = '';
const content = document.getElementById('app-content');
let dashboardClockTimer = null;

function getCurrentUserName() {
  const configuredName = window.SCH_CURRENT_USER?.displayName || window.SCH_CURRENT_USER?.name;
  if (configuredName) return String(configuredName).trim();

  try {
    const savedUser = sessionStorage.getItem('sch-current-user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const name = typeof parsed === 'string' ? parsed : parsed.displayName || parsed.name;
      if (name) return String(name).trim();
    }
  } catch (error) {
    console.warn('The signed-in profile could not be read.', error);
  }

  return document.getElementById('profile-name')?.textContent?.trim() || 'Administrator';
}

function renderDashboardDateTime() {
  const now = new Date();
  const dateElement = document.getElementById('dashboard-date');
  const timeElement = document.getElementById('dashboard-time');
  const greetingElement = document.getElementById('dashboard-greeting');
  if (dateElement) dateElement.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  if (timeElement) timeElement.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (greetingElement) {
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greetingElement.textContent = `${greeting}, ${getCurrentUserName()}.`;
  }
}
const progressStorageKey = 'smart-construction-hub-progress-reports';
const activityReadStorageKey = 'smart-construction-hub-activity-read';
const businessSettingsStorageKey = 'smart-construction-hub-business-settings';
const attendanceStorageKey = 'smart-construction-hub-attendance';
const defaultBusinessSettings = {
  companyName: 'Smart Construction Hub',
  email: '',
  phone: '',
  address: '',
  currency: 'USD'
};
const supportedCurrencies = ['USD', 'GHS', 'LRD'];
let allActivityRead = false;
let businessSettings = { ...defaultBusinessSettings };

try {
  const savedSettings = JSON.parse(localStorage.getItem(businessSettingsStorageKey) || 'null');
  if (savedSettings && typeof savedSettings === 'object') {
    businessSettings = {
      companyName: typeof savedSettings.companyName === 'string' ? savedSettings.companyName : defaultBusinessSettings.companyName,
      email: typeof savedSettings.email === 'string' ? savedSettings.email : '',
      phone: typeof savedSettings.phone === 'string' ? savedSettings.phone : '',
      address: typeof savedSettings.address === 'string' ? savedSettings.address : '',
      currency: supportedCurrencies.includes(savedSettings.currency) ? savedSettings.currency : defaultBusinessSettings.currency
    };
  }
} catch (error) {
  console.warn('Business settings could not be restored.', error);
}

try {
  allActivityRead = localStorage.getItem(activityReadStorageKey) === 'true';
} catch (error) {
  console.warn('Activity read status could not be restored.', error);
}

const recentActivities = [
  { icon: '↗', title: 'Payment received from John Doe', detail: '$4,500 · Willow Creek Residence · 2 hours ago' },
  { icon: '≡', iconClass: 'orange', title: 'Estimate sent for approval', detail: 'Willow Creek Residence · Yesterday' },
  { icon: '▤', iconClass: 'yellow', title: 'Low stock alert', detail: '2×4 Timber is below reorder level · Yesterday' },
  { icon: '□', title: 'Contract uploaded', detail: 'Mason Street Renovation · Sep 08' }
];

function renderActivityList() {
  return `<div class="activity-list">${recentActivities.map(activity => `
    <div class="activity${allActivityRead ? ' is-read' : ''}" aria-label="${allActivityRead ? 'Read' : 'Unread'} activity: ${activity.title}">
      <div class="activity-icon ${activity.iconClass || ''}">${activity.icon}</div>
      <div><strong>${activity.title}</strong><span>${activity.detail}</span></div>
    </div>
  `).join('')}</div>`;
}

function renderActivityMenu() {
  return `
    <div class="activity-menu-wrap">
      <button class="text-button activity-menu-button" type="button" aria-label="Activity options" aria-haspopup="menu" aria-expanded="false" aria-controls="activity-actions-menu" data-activity-menu-toggle>•••</button>
      <div class="activity-actions-menu" id="activity-actions-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-activity-action="view">View all activity</button>
        <button type="button" role="menuitem" data-activity-action="read"${allActivityRead ? ' disabled' : ''}>Mark all as read</button>
      </div>
    </div>
  `;
}

function closeActivityMenu() {
  const toggle = document.querySelector('[data-activity-menu-toggle]');
  const menu = document.getElementById('activity-actions-menu');
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
}

function setMobileNavigationOpen(isOpen) {
  const sidebar = document.getElementById('sidebar');
  const appShell = document.querySelector('.app-shell');
  const toggle = document.getElementById('mobile-menu');
  sidebar.classList.toggle('open', isOpen);
  appShell.classList.toggle('nav-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
}

function restoreProjectProgressReports() {
  try {
    const savedReports = JSON.parse(localStorage.getItem(progressStorageKey) || '{}');
    projects.forEach(project => {
      if (!Array.isArray(savedReports[project.id])) return;
      const existing = Array.isArray(project.progressReports) ? project.progressReports : [];
      const byReportNumber = new Map(existing.filter(report => report.reportNo).map(report => [report.reportNo, report]));
      savedReports[project.id].forEach(report => {
        if (report.reportNo) byReportNumber.set(report.reportNo, report);
      });
      project.progressReports = [...byReportNumber.values(), ...existing.filter(report => !report.reportNo)];
      const latestReport = getProjectReports(project).at(-1);
      if (latestReport) project.progress = latestReport.percent;
      project.status = project.progress >= 100 ? 'Complete' : 'In progress';
    });
  } catch (error) {
    console.warn('Saved progress reports could not be restored.', error);
  }
}

restoreProjectProgressReports();

try {
  const savedContacts = JSON.parse(localStorage.getItem(projectContactsStorageKey) || '{}');
  if (savedContacts && typeof savedContacts === 'object' && !Array.isArray(savedContacts)) {
    projects.forEach(project => {
      const contacts = savedContacts[project.id];
      if (!contacts || typeof contacts !== 'object') return;
      project.clientPhone = typeof contacts.clientPhone === 'string' ? contacts.clientPhone : '';
      project.whatsapp = typeof contacts.whatsapp === 'string' ? contacts.whatsapp : '';
      project.clientEmail = typeof contacts.clientEmail === 'string' ? contacts.clientEmail : '';
    });
  }
} catch (error) {
  console.warn('Saved client contact details could not be restored.', error);
}

try {
  const savedClientEdits = JSON.parse(localStorage.getItem(projectClientEditsStorageKey) || '{}');
  if (savedClientEdits && typeof savedClientEdits === 'object' && !Array.isArray(savedClientEdits)) {
    projects.forEach(project => {
      const edit = savedClientEdits[project.id];
      if (!edit) return;
      project.client = edit.client || project.client;
      project.clientPhone = edit.clientPhone ?? project.clientPhone;
      project.whatsapp = edit.whatsapp ?? project.whatsapp;
      project.clientEmail = edit.clientEmail ?? project.clientEmail;
    });
  }
} catch (error) {
  console.warn('Saved client edits could not be restored.', error);
}

try {
  const savedWorkers = JSON.parse(localStorage.getItem(projectWorkersStorageKey) || '[]');
  if (Array.isArray(savedWorkers)) {
    projectWorkers = savedWorkers.filter(worker =>
      worker &&
      typeof worker.workerNumber === 'string' &&
      typeof worker.fullName === 'string'
    );
  }
} catch (error) {
  console.error('Saved project workers could not be restored.', error);
}
window.workerRecords = [...projectWorkers];

try {
  const savedAssignments = JSON.parse(localStorage.getItem(projectWorkerAssignmentsStorageKey) || '{}');
  if (savedAssignments && typeof savedAssignments === 'object' && !Array.isArray(savedAssignments)) {
    projects.forEach(project => {
      const assignments = savedAssignments[project.id];
      if (Array.isArray(assignments)) project.workerAssignments = assignments;
    });
  }
} catch (error) {
  console.error('Project worker assignments could not be restored.', error);
}

projects.forEach(project => {
  (project.workerAssignments || []).forEach(assignment => {
    const worker = assignment.Worker || assignment.worker;
    if (!worker?.workerNumber || projectWorkers.some(item => item.workerNumber === worker.workerNumber)) return;
    projectWorkers.push({ ...worker, projects: [{ project: { name: project.name }, position: assignment.Position || assignment.position || '' }] });
  });
});

function persistProjectWorkerAssignments() {
  const savedAssignments = Object.fromEntries(projects.map(project => [
    project.id,
    Array.isArray(project.workerAssignments) ? project.workerAssignments : []
  ]));
  localStorage.setItem(projectWorkerAssignmentsStorageKey, JSON.stringify(savedAssignments));
}

function persistProjectWorkers() {
  localStorage.setItem(projectWorkersStorageKey, JSON.stringify(projectWorkers));
}

function openEstimatePdfDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(estimatePdfDatabaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(estimatePdfStoreName)) {
        database.createObjectStore(estimatePdfStoreName, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Estimate document storage could not be opened.'));
  });
}

async function getEstimatePdfs() {
  const database = await openEstimatePdfDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(estimatePdfStoreName, 'readonly').objectStore(estimatePdfStoreName).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt)));
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('Uploaded estimate documents could not be loaded.'));
    };
  });
}

async function saveEstimatePdf(documentRecord) {
  const database = await openEstimatePdfDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(estimatePdfStoreName, 'readwrite');
    transaction.objectStore(estimatePdfStoreName).put(documentRecord);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Estimate PDF could not be saved.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Estimate PDF save was canceled.'));
    };
  });
}

async function getEstimatePdf(id) {
  const database = await openEstimatePdfDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(estimatePdfStoreName, 'readonly').objectStore(estimatePdfStoreName).get(id);
    request.onsuccess = () => {
      database.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('Estimate PDF could not be opened.'));
    };
  });
}

function openEstimatePdfViewer(documentRecord) {
  if (!documentRecord?.file) {
    window.alert('This estimate PDF could not be found in browser storage.');
    return;
  }
  closeEstimatePdfViewer();
  activeEstimatePdfUrl = URL.createObjectURL(documentRecord.file);
  document.getElementById('estimate-pdf-viewer-title').textContent = documentRecord.fileName;
  document.getElementById('estimate-pdf-viewer-frame').src = activeEstimatePdfUrl;
  document.getElementById('estimate-pdf-viewer-backdrop').hidden = false;
  document.getElementById('estimate-pdf-viewer-close').focus();
}

function estimatePdfRow(documentRecord) {
  const project = projects.find(item => item.id === documentRecord.projectId);
  return `<tr>
    <td><button class="estimate-pdf-file-link" type="button" data-open-estimate-pdf="${escapeReportHtml(documentRecord.id)}">${escapeReportHtml(documentRecord.fileName)}</button><span class="project-client">${new Date(documentRecord.uploadedAt).toLocaleDateString()}</span></td>
    <td><strong>${escapeReportHtml(project?.name || documentRecord.projectName)}</strong><span class="project-client">${escapeReportHtml(project?.id || documentRecord.projectId)}</span></td>
    <td>${escapeReportHtml(project?.client || documentRecord.owner || 'Not recorded')}</td>
    <td>${escapeReportHtml(project?.location || documentRecord.location || 'Not recorded')}</td>
    <td><button class="button button-ghost" type="button" data-open-estimate-pdf="${escapeReportHtml(documentRecord.id)}">View PDF</button></td>
  </tr>`;
}

async function renderEstimatePdfList(container, emptyMessage) {
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Loading uploaded estimate PDFs…</div>';
  try {
    const documents = await getEstimatePdfs();
    container.innerHTML = documents.length
      ? `<div class="estimate-pdf-table-wrap"><table class="project-table full-table"><thead><tr><th>PDF / uploaded</th><th>Project</th><th>Owner / client</th><th>Location</th><th></th></tr></thead><tbody>${documents.map(estimatePdfRow).join('')}</tbody></table></div>`
      : `<div class="empty-state">${emptyMessage}</div>`;
  } catch (error) {
    console.error('Uploaded estimate PDFs could not be loaded.', error);
    container.innerHTML = '<div class="empty-state">Uploaded estimate PDFs could not be loaded. Try refreshing this view.</div>';
  }
}

function money(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: businessSettings.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

function applyBusinessSettings() {
  const companyName = document.querySelector('.brand-copy strong');
  if (companyName) companyName.textContent = businessSettings.companyName;
}

function settingsView() {
  content.innerHTML = `
    <div class="view-title">
      <div>
        <div class="eyebrow">WORKSPACE</div>
        <h1>Settings</h1>
        <p>Manage your company details and currency preference.</p>
      </div>
    </div>
    <section class="panel settings-panel">
      <div class="panel-header">
        <div><h2>Company profile</h2><p>These details are saved in this browser.</p></div>
      </div>
      <form id="business-settings-form" class="settings-form">
        <div class="form-grid">
          <label>Company name<input name="companyName" required maxlength="120" /></label>
          <label>Business email<input name="email" type="email" maxlength="180" /></label>
          <label>Business phone<input name="phone" type="tel" maxlength="40" /></label>
          <label>Business address<input name="address" maxlength="300" /></label>
          <label>Currency
            <select name="currency">
              <option value="USD">US dollar (USD)</option>
              <option value="GHS">Ghanaian cedi (GHS)</option>
              <option value="LRD">Liberian dollar (LRD)</option>
            </select>
          </label>
        </div>
        <div class="settings-actions">
          <span class="settings-save-status" role="status" aria-live="polite"></span>
          <button class="button button-primary" type="submit">Save settings</button>
        </div>
        <p class="settings-storage-note">These preferences are stored on this device only. They do not connect project records to an online database.</p>
      </form>
    </section>
  `;

  const form = document.getElementById('business-settings-form');
  Object.entries(businessSettings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

function statusClass(status) {
  if (status === 'In progress') return 'status-progress';
  if (status === 'Complete') return 'status-complete';
  return 'status-review';
}

function getProjectReports(project) {
  const reports = Array.isArray(project.progressReports) ? project.progressReports : [];
  return reports
    .map(report => ({
      ...report,
      date: String(report.date || new Date().toISOString().slice(0, 10)),
      percent: Number(report.percent) || 0,
      summary: String(report.summary || report.completedWork || '').trim()
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildProjectProgressShareText(project, overrideReport = null) {
  const reports = getProjectReports(project);
  const allReports = overrideReport && !reports.some(report => report.reportNo && report.reportNo === overrideReport.reportNo) ? [...reports, overrideReport] : reports;
  const lines = [
    'SMART CONSTRUCTION HUB — DAILY PROGRESS REPORT',
    `Project: ${project.name}`,
    `Client: ${project.client}`,
    `Location: ${project.location}`,
    `Overall completion: ${project.progress}%`,
    ''
  ];

  allReports.forEach(report => {
    lines.push(`${report.reportNo || 'Progress update'} · ${report.date} · ${report.percent}% complete`);
    if (report.weather) lines.push(`Weather: ${report.weather}`);
    if (report.workingHours) lines.push(`Working hours: ${report.workingHours}`);
    if (report.workforce) {
      const workforce = Object.entries(report.workforce).filter(([, count]) => Number(count) > 0);
      if (workforce.length) lines.push(`Workforce (${report.totalWorkers || workforce.reduce((sum, [, count]) => sum + Number(count), 0)}): ${workforce.map(([trade, count]) => `${trade} ${count}`).join(', ')}`);
    }
    if (report.completedWorkItems || report.completedWork) lines.push(`Work completed / current activities: ${report.completedWorkItems || report.completedWork}`);
    if (report.clientUpdate) lines.push(`Client update: ${report.clientUpdate}`);
    if (report.scheduleStatus) lines.push(`Status: ${report.scheduleStatus}`);
    if (report.activities?.length) {
      lines.push('Work area progress:');
      report.activities.forEach(activity => lines.push(`- ${activity.activity}: ${activity.percentComplete || 0}% · ${activity.status || 'In progress'}`));
    }
    if (report.materials?.length) {
      lines.push('Materials used:');
      report.materials.forEach(material => lines.push(`- ${material.material}: ${material.used || 0} used, ${material.balance || 0} balance`));
    }
    if (report.expenses?.length) {
      lines.push(`Expenses: ${report.expenses.map(expense => `${expense.description} ${money(Number(expense.amount) || 0)}`).join('; ')}`);
    }
    if (report.issues?.length) lines.push(`Site issues/delays: ${report.issues.join(', ')}`);
    if (report.issueDetails) lines.push(`Issues / delays: ${report.issueDetails}`);
    if (report.beforeWork) lines.push(`Before work: ${report.beforeWork}`);
    if (report.inProgressWork) lines.push(`Work in progress: ${report.inProgressWork}`);
    if (report.defects) lines.push(`Problems/defects: ${report.defects}`);
    if (report.tomorrowPlan) lines.push(`Tomorrow's plan: ${report.tomorrowPlan}`);
    if (report.photos?.length) lines.push(`Photos: ${report.photos.map(photo => photo.caption || photo.name).join('; ')}`);
    if (report.approvals) lines.push(`Prepared by ${report.approvals.preparedBy || '—'} · Checked by ${report.approvals.checkedBy || '—'} · Approved by ${report.approvals.approvedBy || '—'}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}

async function shareProjectProgressWithClient(projectId, overrideReport = null, shareWindow = null) {
  const project = projects.find(item => item.id === projectId);
  if (!project) {
    shareWindow?.close();
    return;
  }

  const shareText = buildProjectProgressShareText(project, overrideReport);

  if (project.whatsapp) {
    const whatsappNumber = project.whatsapp.replace(/\D/g, '');
    if (!/^\d{7,15}$/.test(whatsappNumber)) {
      shareWindow?.close();
      window.alert('The client WhatsApp number must include the country code and contain 7 to 15 digits.');
      return;
    }

    if (!shareWindow) {
      window.alert('Your report was saved, but WhatsApp could not open. Allow pop-ups for this site and try sharing again.');
      return;
    }

    shareWindow.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(shareText)}`;
    window.alert('WhatsApp opened with the progress report addressed to the client. Review it and press Send.');
    return;
  }

  if (!project.clientEmail) {
    shareWindow?.close();
    window.alert('Report saved, but no client WhatsApp number or email is recorded. Add contact details to this project to share reports.');
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareText);
    } else {
      const temp = document.createElement('textarea');
      temp.value = shareText;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
  } catch (error) {
    const copied = window.prompt('Copy this project progress report to send to the client:', shareText);
    if (copied === null) {
      shareWindow?.close();
      return;
    }
  }

  const subject = encodeURIComponent(`Project progress update - ${project.name}`);
  const body = encodeURIComponent(shareText);
  if (shareWindow) shareWindow.location.href = `mailto:${project.clientEmail}?subject=${subject}&body=${body}`;
  else window.location.href = `mailto:${project.clientEmail}?subject=${subject}&body=${body}`;
  window.alert('Progress report copied and ready to share with the client by email.');
}

function renderProjectRows(items) {
  return items.map(project => `
    <tr data-project="${project.id}">
      <td>
        <strong class="project-name">${project.name}</strong>
        <span class="project-client">${project.id} · ${project.client}</span>
      </td>
      <td>${project.type}<span class="project-client">${project.location}</span></td>
      <td><span class="status ${statusClass(project.status)}">${project.status}</span></td>
      <td class="project-amount">${money(project.amount)}<span class="project-client">${Math.round((project.paid / project.amount) * 100) || 0}% paid</span></td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><span style="width:${project.progress}%"></span></div>
          <div class="progress-meta">${project.progress}% complete</div>
        </div>
      </td>
    </tr>
  `).join('');
}

function overview() {
  if (dashboardClockTimer) clearInterval(dashboardClockTimer);
  const paymentChart = renderPaymentChart();
  content.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow"><span id="dashboard-date"></span> · <span id="dashboard-time"></span></div>
        <h1 id="dashboard-greeting"></h1>
        <p>Here is the pulse of your construction business today.</p>
      </div>
      <button class="button button-primary" data-view-link="projects">＋ View projects <span>→</span></button>
    </div>
    <div class="dashboard-grid">
      <div class="metric"><div class="metric-label">Active projects <span class="metric-icon">▱</span></div><strong>${projects.filter(project => project.status !== 'Complete').length}</strong><div class="metric-foot">Projects in progress</div></div>
      <div class="metric metric-orange"><div class="metric-label">Total outstanding <span class="metric-icon">◒</span></div><strong>$18,450</strong><div class="metric-foot"><span class="positive">↓ 8.4%</span> from last month</div></div>
      <div class="metric metric-yellow"><div class="metric-label">Payments this month <span class="metric-icon">↗</span></div><strong>$9,250</strong><div class="metric-foot"><span class="positive">↑ 12.6%</span> from last month</div></div>
      <div class="metric"><div class="metric-label">Main balance</div><strong data-main-balance>${money(Number(window.companyBalance?.amount) || 0)}</strong><div class="metric-foot">Client receipts less worker payments</div></div>
      <div class="metric"><div class="metric-label">Inventory items <span class="metric-icon">▤</span></div><strong>143</strong><div class="metric-foot">8 items need restocking</div></div>
    </div>
    <section class="panel dashboard-chart-panel">
      <div class="panel-header"><div><h2>Cash flow</h2><p>Client receipts and worker payments over the last 6 months</p></div><div class="chart-legend"><span><i class="chart-legend-in"></i>Received</span><span><i class="chart-legend-out"></i>Paid to workers</span></div></div>
      ${paymentChart}
    </section>
    <div class="lower-grid">
      <section class="panel">
        <div class="panel-header"><div><h2>Active projects</h2><p>Track the work currently moving forward.</p></div><button class="text-button" data-view-link="projects">View all →</button></div>
        <table class="project-table"><thead><tr><th>Project</th><th>Type & location</th><th>Status</th><th>Contract value</th><th>Progress</th></tr></thead><tbody>${renderProjectRows(projects)}</tbody></table>
      </section>
      <section class="panel">
        <div class="panel-header"><div><h2>Recent activity</h2><p>${allActivityRead ? 'All updates have been read.' : 'Latest updates across your workspace.'}</p></div>${renderActivityMenu()}</div>
        ${renderActivityList()}
      </section>
    </div>
  `;
  renderDashboardDateTime();
  dashboardClockTimer = setInterval(renderDashboardDateTime, 60_000);
}

function renderPaymentChart() {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const buckets = months.map(date => ({ date, received: 0, paid: 0 }));
  const addPayment = (payment, key) => {
    const date = new Date(payment.paymentDate || payment.PaymentDate);
    const bucket = buckets.find(item => item.date.getFullYear() === date.getFullYear() && item.date.getMonth() === date.getMonth());
    if (bucket) bucket[key] += Number(payment.amount ?? payment.Amount) || 0;
  };
  (Array.isArray(payments) ? payments : []).forEach(payment => addPayment(payment, 'received'));
  (Array.isArray(dashboardWorkerPayments) ? dashboardWorkerPayments : window.workerPayments || []).forEach(payment => addPayment(payment, 'paid'));

  const max = Math.max(1, ...buckets.flatMap(item => [item.received, item.paid]));
  const chartWidth = 720;
  const chartHeight = 220;
  const top = 16;
  const bottom = 184;
  const chartRange = bottom - top;
  const groupWidth = chartWidth / buckets.length;
  const barWidth = 26;
  const bars = buckets.map((item, index) => {
    const center = groupWidth * index + groupWidth / 2;
    const receivedHeight = item.received / max * chartRange;
    const paidHeight = item.paid / max * chartRange;
    const xReceived = center - barWidth - 3;
    const xPaid = center + 3;
    const label = item.date.toLocaleDateString(undefined, { month: 'short' });
    return `<rect class="cashflow-bar received" x="${xReceived}" y="${bottom - receivedHeight}" width="${barWidth}" height="${receivedHeight}" rx="4"><title>${label}: received ${money(item.received)}</title></rect><rect class="cashflow-bar paid" x="${xPaid}" y="${bottom - paidHeight}" width="${barWidth}" height="${paidHeight}" rx="4"><title>${label}: paid ${money(item.paid)}</title></rect><text class="cashflow-month" x="${center}" y="${chartHeight - 7}" text-anchor="middle">${label}</text>`;
  }).join('');
  const grid = [0, 1, 2, 3].map(index => {
    const y = top + chartRange * index / 3;
    return `<line class="cashflow-gridline" x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" />`;
  }).join('');
  const empty = buckets.every(item => !item.received && !item.paid);
  return `<div class="cashflow-chart-wrap"><svg class="cashflow-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Monthly client receipts and worker payments over the last six months">${grid}${bars}</svg>${empty ? '<p class="cashflow-empty">Payment records will appear here when available.</p>' : ''}</div>`;
}

function activityView() {
  content.innerHTML = `
    <div class="view-title">
      <div>
        <div class="eyebrow">WORKSPACE UPDATES</div>
        <h1>Activity</h1>
        <p>Recent updates across your workspace.</p>
      </div>
    </div>
    <section class="panel">
      <div class="panel-header"><div><h2>All activity</h2><p>${allActivityRead ? 'All updates have been read.' : 'Latest updates across your workspace.'}</p></div>${renderActivityMenu()}</div>
      ${renderActivityList()}
    </section>
  `;
}

function projectsView() {
  content.innerHTML = `
    <div class="view-title">
      <div>
        <div class="eyebrow">WORK MANAGEMENT</div>
        <h1>Projects</h1>
        <p>Every job, client, payment and plan in one connected view.</p>
      </div>
      <button class="button button-primary" id="add-project-button" type="button">＋ New project</button>
    </div>
    <section class="panel view-table-panel">
      <table class="project-table full-table"><thead><tr><th>Project</th><th>Type & location</th><th>Status</th><th>Contract value</th><th>Progress</th></tr></thead><tbody>${renderProjectRows(projects)}</tbody></table>
    </section>
  `;
}

function getClientProjects(clientName) {
  const normalizedName = clientName.trim().toLocaleLowerCase();
  return projects.filter(project => project.client.trim().toLocaleLowerCase() === normalizedName);
}

function renderClientCards() {
  const clients = [...new Map(projects.map(project => [project.client.trim().toLocaleLowerCase(), project.client.trim()])).values()];
  if (!clients.length) return '<section class="panel empty-state"><strong>No clients recorded yet.</strong><p>Add a project to create a connected client record.</p></section>';

  return `<div class="cards-grid">${clients.map(clientName => {
    const clientProjects = getClientProjects(clientName);
    const client = clientProjects.find(project => project.clientPhone || project.whatsapp || project.clientEmail) || clientProjects[0];
    const locations = [...new Set(clientProjects.map(project => project.location).filter(Boolean))];
    const initials = clientName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
    const contact = client.whatsapp || client.clientPhone || client.clientEmail || 'Contact details not recorded';
    const totalValue = clientProjects.reduce((sum, project) => sum + (Number(project.amount) || 0), 0);

    return `<article class="client-card client-card-interactive"><button class="client-card-open" type="button" data-client-name="${escapeReportHtml(clientName)}"><span class="avatar avatar-dark">${escapeReportHtml(initials)}</span><h3>${escapeReportHtml(clientName)}</h3><p>${escapeReportHtml(locations.join(' · ') || 'Location not recorded')}</p><p>${escapeReportHtml(contact)}</p><div class="client-project"><strong>${clientProjects.length} ${clientProjects.length === 1 ? 'project' : 'projects'}</strong><span>· ${money(totalValue)} total value</span></div><span class="client-open-hint">View client details →</span></button></article>`;
  }).join('')}</div>`;
}

function clientsView() {
  content.innerHTML = `
    <div class="view-title">
      <div><div class="eyebrow">RELATIONSHIPS</div><h1>Clients</h1><p>Review client details and the projects connected to each client.</p></div>
    </div>
    ${renderClientCards()}
  `;
}

function openClientDetail(clientName) {
  const clientProjects = getClientProjects(clientName);
  if (!clientProjects.length) {
    window.alert('No projects are linked to this client.');
    setView('clients');
    return;
  }

  const client = clientProjects.find(project => project.clientPhone || project.whatsapp || project.clientEmail) || clientProjects[0];
  const clientId = client.clientId || client.databaseClientId || '';
  const locations = [...new Set(clientProjects.map(project => project.location).filter(Boolean))];
  const initials = clientName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const phone = client.clientPhone || client.whatsapp || '';
  const whatsappNumber = (client.whatsapp || client.clientPhone || '').replace(/\D/g, '');
  const totalValue = clientProjects.reduce((sum, project) => sum + (Number(project.amount) || 0), 0);
  const outstanding = clientProjects.reduce((sum, project) => sum + Math.max(0, (Number(project.amount) || 0) - (Number(project.paid) || 0)), 0);
  const projectWithBalance = clientProjects
    .map(project => ({ project, balance: Math.max(0, (Number(project.amount) || 0) - (Number(project.paid) || 0)) }))
    .filter(item => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)[0]?.project;
  const projectRows = clientProjects.map(project => `
    <button class="client-project-row" type="button" data-client-project="${escapeReportHtml(project.id)}">
      <span><strong>${escapeReportHtml(project.name)}</strong><small>${escapeReportHtml(project.id)} · ${escapeReportHtml(project.type)} · ${escapeReportHtml(project.location)}</small></span>
      <span class="status ${statusClass(project.status)}">${escapeReportHtml(project.status)}</span>
      <strong>${money(project.amount)}</strong>
      <span class="client-project-progress">${Math.round(Number(project.progress) || 0)}% complete →</span>
    </button>
  `).join('');

  content.innerHTML = `
    <div class="view-title"><div><div class="eyebrow">CLIENT PROFILE</div><h1>${escapeReportHtml(clientName)}</h1><p>Client information and all connected projects.</p></div><button class="button button-ghost" data-view-link="clients">← Back to clients</button></div>
    <div class="client-detail-grid">
      <section class="panel client-contact-panel">
        <div class="avatar avatar-dark">${escapeReportHtml(initials)}</div>
        <h2>${escapeReportHtml(clientName)}</h2>
        <p>${escapeReportHtml(locations.join(' · ') || 'Location not recorded')}</p>
        <p>${escapeReportHtml(phone || 'Phone not recorded')}</p>
        <p>${escapeReportHtml(client.clientEmail || 'Email not recorded')}</p>
        <div class="client-contact-actions">
          <button class="button button-ghost" type="button" data-edit-client="${escapeReportHtml(clientId || '')}" data-client-name="${escapeReportHtml(clientName)}" data-client-phone="${escapeReportHtml(phone)}" data-client-whatsapp="${escapeReportHtml(client.whatsapp || '')}" data-client-email="${escapeReportHtml(client.clientEmail || '')}" data-client-location="${escapeReportHtml(clientProjects[0].location || '')}">Edit client details</button>
          ${phone ? `<a class="button button-ghost" href="tel:${escapeReportHtml(phone.replace(/[^\d+]/g, ''))}">Call client</a>` : ''}
          ${whatsappNumber ? `<a class="button button-primary" target="_blank" rel="noopener" href="https://wa.me/${escapeReportHtml(whatsappNumber)}">WhatsApp</a>` : ''}
        </div>
      </section>
      <section class="panel client-projects-panel">
        <div class="panel-header"><div><h2>Projects for ${escapeReportHtml(clientName)}</h2><p>${clientProjects.length} linked ${clientProjects.length === 1 ? 'project' : 'projects'}</p></div><button class="button button-primary" type="button" data-client-add-project="${escapeReportHtml(clientName)}">＋ Add new project</button></div>
        <div class="client-summary-metrics"><div><span>Total contract value</span><strong>${money(totalValue)}</strong></div><div><span>Outstanding balance</span><strong>${money(outstanding)}</strong>${projectWithBalance ? `<button class="button button-primary" type="button" data-record-payment="${escapeReportHtml(projectWithBalance.id)}">Record payment</button>` : ''}</div><div><span>Active projects</span><strong>${clientProjects.filter(project => project.status !== 'Complete').length}</strong></div></div>
        <div class="client-project-list">${projectRows}</div>
      </section>
    </div>
  `;
}

function openRecordEditForm(kind, record) {
  const form = document.getElementById('record-edit-form');
  const fields = document.querySelector('[data-record-edit-fields]');
  if (!form || !fields) return;
  recordBeingEdited = { kind, record };
  const isWorker = kind === 'worker';
  document.getElementById('record-edit-modal-title').textContent = isWorker ? 'Edit worker information' : 'Edit client information';
  const definitions = isWorker ? [
    ['fullName', 'Full name', 'text', record.fullName || record.FullName || '', true],
    ['phone', 'Phone number', 'tel', record.phone || record.Phone || '', false],
    ['address', 'Address', 'text', record.address || record.Address || '', false],
    ['skill', 'Skills', 'text', record.skill || record.Skill || '', false],
    ['position', 'Position', 'text', record.position || record.Position || '', false],
    ['employmentType', 'Employment type', 'text', record.employmentType || record.EmploymentType || '', false],
    ['rate', 'Pay amount', 'number', record.rate ?? record.Rate ?? 0, true],
    ['ratePeriod', 'Pay frequency', 'text', record.ratePeriod || record.RatePeriod || 'Daily', true],
    ['dateHired', 'Date hired', 'date', String(record.dateHired || record.DateHired || '').slice(0, 10), false],
    ['emergencyContactName', 'Emergency contact name', 'text', record.emergencyContactName || record.EmergencyContactName || '', false],
    ['emergencyContactPhone', 'Emergency contact phone', 'tel', record.emergencyContactPhone || record.EmergencyContactPhone || '', false],
    ['idDocumentType', 'ID / document type', 'text', record.idDocumentType || record.IdDocumentType || '', false],
    ['idDocumentNumber', 'ID / document number', 'text', record.idDocumentNumber || record.IdDocumentNumber || '', false],
    ['attendanceStatus', 'Attendance status', 'text', record.attendanceStatus || record.AttendanceStatus || 'Not recorded', false],
    ['workHours', 'Work hours', 'number', record.workHours ?? record.WorkHours ?? 0, false],
    ['amountOwed', 'Amount owed', 'number', record.amountOwed ?? record.AmountOwed ?? 0, false],
    ['attendanceNotes', 'Attendance notes', 'text', record.attendanceNotes || record.AttendanceNotes || '', false],
    ['status', 'Worker status', 'text', record.status || record.Status || 'Active', true]
  ] : [
    ['fullName', 'Full name', 'text', record.name || '', true],
    ['phone', 'Phone number', 'tel', record.phone || '', false],
    ['whatsapp', 'WhatsApp number', 'tel', record.whatsapp || '', false],
    ['email', 'Email', 'email', record.email || '', false],
    ['location', 'Client location', 'text', record.location || '', false]
  ];
  fields.innerHTML = definitions.map(([name, label, type, value, required]) => `<label>${label}<input name="${name}" type="${type}" value="${escapeReportHtml(value)}"${required ? ' required' : ''}${type === 'number' ? ' min="0" step="0.01"' : ''}></label>`).join('');
  document.getElementById('record-edit-modal-backdrop').hidden = false;
  fields.querySelector('input')?.focus();
}

document.getElementById('record-edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!recordBeingEdited || !form.reportValidity()) return;
  const { kind, record } = recordBeingEdited;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    if (kind === 'worker') {
      const worker = record;
      Object.assign(worker, {
        fullName: data.fullName.trim(), phone: data.phone.trim(), address: data.address.trim(),
        skill: data.skill.trim(), position: data.position.trim(), employmentType: data.employmentType,
        rate: Number(data.rate), ratePeriod: data.ratePeriod, dateHired: data.dateHired || null,
        emergencyContactName: data.emergencyContactName.trim(), emergencyContactPhone: data.emergencyContactPhone.trim(),
        idDocumentType: data.idDocumentType.trim(), idDocumentNumber: data.idDocumentNumber.trim(), status: data.status
      });
      worker.attendanceStatus = data.attendanceStatus;
      worker.workHours = Number(data.workHours) || 0;
      worker.amountOwed = Number(data.amountOwed) || 0;
      worker.attendanceNotes = data.attendanceNotes.trim();
      const workerId = worker.id || worker.Id;
      if (databaseConnected && workerId) {
        const saved = await apiRequest(`/workers/${workerId}`, { method: 'PUT', body: JSON.stringify({
          fullName: worker.fullName, phone: worker.phone, address: worker.address, skill: worker.skill,
          position: worker.position, employmentType: worker.employmentType, rate: worker.rate,
          ratePeriod: worker.ratePeriod, dateHired: worker.dateHired, emergencyContactName: worker.emergencyContactName,
          emergencyContactPhone: worker.emergencyContactPhone, idDocumentType: worker.idDocumentType,
          idDocumentNumber: worker.idDocumentNumber, status: worker.status, attendanceStatus: worker.attendanceStatus,
          workHours: worker.workHours, amountOwed: worker.amountOwed, attendanceNotes: worker.attendanceNotes,
          photoDataUrl: worker.photoDataUrl
        }) });
        Object.assign(worker, saved);
      } else {
        persistProjectWorkers();
      }
      projectWorkers = projectWorkers.map(item => item.workerNumber === worker.workerNumber ? { ...item, ...worker } : item);
      window.setWorkerRecords?.([...(window.workerRecords || []).filter(item => item.workerNumber !== worker.workerNumber), worker]);
      document.getElementById('record-edit-modal-backdrop').hidden = true;
      recordBeingEdited = null;
      setView('workers');
      return;
    }

    const oldName = record.name;
    const linkedProjects = getClientProjects(oldName);
    const clientId = Number(record.id) || linkedProjects.find(project => project.clientId)?.clientId;
    if (databaseConnected && clientId) {
      await apiRequest(`/clients/${clientId}`, { method: 'PUT', body: JSON.stringify({ fullName: data.fullName.trim(), phoneNumber: data.phone.trim() || null, email: data.email.trim() || null, propertyLocation: data.location.trim() || null }) });
    }
    linkedProjects.forEach(project => {
      project.client = data.fullName.trim();
      project.clientPhone = data.phone.trim();
      project.whatsapp = data.whatsapp.trim();
      project.clientEmail = data.email.trim();
      project.location = data.location.trim() || project.location;
    });
    persistProjectContacts();
    const savedClientEdits = Object.fromEntries(projects.map(project => [project.id, {
      client: project.client, clientPhone: project.clientPhone || '', whatsapp: project.whatsapp || '', clientEmail: project.clientEmail || ''
    }]));
    localStorage.setItem(projectClientEditsStorageKey, JSON.stringify(savedClientEdits));
    const savedProjects = projects.filter(project => !builtInProjectIds.has(project.id));
    localStorage.setItem(createdProjectsStorageKey, JSON.stringify(savedProjects));
    document.getElementById('record-edit-modal-backdrop').hidden = true;
    recordBeingEdited = null;
    openClientDetail(data.fullName.trim());
  } catch (error) {
    window.alert(`The ${kind} information could not be saved: ${error.message}`);
  }
});

const defaultActivities = ['Foundation block work', 'Column construction', 'Roofing', 'Plastering'];

function localDateString(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function workActivityRow(activity = '') {
  return `<tr data-work-activity-row><td><input name="activity" value="${escapeReportHtml(activity)}" aria-label="Work area" placeholder="e.g. Foundation" /></td><td><div class="dpr-activity-progress"><input name="activityPercent" type="number" min="0" max="100" step="1" value="0" aria-label="Work area progress percentage" /><span>%</span></div></td><td><output data-activity-status>Not started</output></td><td><button class="dpr-remove-row" type="button" aria-label="Remove work area">×</button></td></tr>`;
}

function escapeReportHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function openProject(id) {
  const project = projects.find(item => item.id === id);
  if (!project) return;
  project.progressReports = Array.isArray(project.progressReports) ? project.progressReports : [];
  const latestProgressReport = getProjectReports(project).at(-1);
  if (latestProgressReport) project.progress = latestProgressReport.percent;
  else project.progress = Number(project.progress) || 0;
  const latestProgressReportDate = latestProgressReport?.date
    ? new Date(`${latestProgressReport.date}T00:00:00`).toLocaleDateString()
    : '';
  let reportProject = project;
  const makeReportNumber = target => `DPR-${target.id}-${String(getProjectReports(target).filter(report => report.reportNo).length + 1).padStart(3, '0')}`;
  const reportNumber = makeReportNumber(reportProject);
  const paidPercent = Math.round((project.paid / project.amount) * 100) || 0;
  const paymentDue = Boolean(project.nextPaymentDate && project.nextPaymentDate <= localDateString() && Number(project.amount) > (Number(project.paid) || 0));
  const remainingBalance = Math.max(0, Number(project.amount) - (Number(project.paid) || 0));
  const paymentReminderText = `Hello ${project.client}, a scheduled payment of ${money(project.nextPaymentAmount)} for ${project.name} is due today. Remaining project balance: ${money(remainingBalance)}.`;
  const paymentWhatsApp = (project.whatsapp || project.clientPhone || '').replace(/\D/g, '');
  const paymentEmail = project.clientEmail || '';
  const paymentScheduleNotice = project.nextPaymentDate && Number(project.amount) > (Number(project.paid) || 0)
    ? `<section class="panel project-payment-notice${paymentDue ? ' project-payment-due' : ''}" role="${paymentDue ? 'alert' : 'status'}">
        <div><div class="eyebrow">${paymentDue ? 'PAYMENT DUE' : 'UPCOMING PAYMENT'}</div><h2>${paymentDue ? 'Scheduled payment is due' : 'Next payment scheduled'}</h2><p>${money(project.nextPaymentAmount)} due ${new Date(`${project.nextPaymentDate}T00:00:00`).toLocaleDateString()} · Remaining balance ${money(remainingBalance)}.</p></div>
        ${paymentDue ? `<div class="project-payment-notice-actions"><button class="button button-primary" type="button" data-record-payment="${escapeReportHtml(project.id)}">Record payment</button>${paymentWhatsApp ? `<a class="button button-ghost" target="_blank" rel="noopener" href="https://wa.me/${paymentWhatsApp}?text=${encodeURIComponent(paymentReminderText)}">Notify client on WhatsApp</a>` : ''}${paymentEmail ? `<a class="button button-ghost" href="mailto:${encodeURIComponent(paymentEmail)}?subject=${encodeURIComponent(`Payment due: ${project.name}`)}&body=${encodeURIComponent(paymentReminderText)}">Notify client by email</a>` : ''}</div>` : ''}
      </section>`
    : '';

  content.innerHTML = `
    <div class="view-title"><div><div class="eyebrow">${project.id} · ${project.type.toUpperCase()}</div><h1>${project.name}</h1><p>${project.location} · Client: ${project.client}</p></div><button class="button button-ghost" data-view-link="projects">← Back to projects</button></div>
    <div class="dashboard-grid"><div class="metric"><div class="metric-label">Contract value</div><strong>${money(project.amount)}</strong><div class="metric-foot">Approved contract</div></div><div class="metric metric-orange">${remainingBalance > 0 ? `<button class="balance-payment-trigger" type="button" data-record-payment="${escapeReportHtml(project.id)}" aria-label="Record payment for ${escapeReportHtml(project.name)}, balance ${escapeReportHtml(money(remainingBalance))}"><span class="metric-label">Balance due</span><strong>${money(remainingBalance)}</strong><span class="metric-foot">Click to record a client payment</span></button>` : `<div class="metric-label">Balance due</div><strong>${money(0)}</strong><div class="metric-foot">Project paid in full</div>`}</div><div class="metric"><button class="metric-progress-trigger project-construction-card" type="button" aria-expanded="false" aria-controls="project-progress-stack"><span class="metric-label">Construction progress</span><strong data-project-progress>${project.progress}%</strong><span class="project-construction-report-meta">${latestProgressReport ? `Latest report${latestProgressReport.reportNo ? ` · ${escapeReportHtml(latestProgressReport.reportNo)}` : ''}${latestProgressReportDate ? ` · ${latestProgressReportDate}` : ''}` : 'No progress report saved yet'}</span><span class="project-construction-track" role="progressbar" aria-label="Project completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${project.progress}"><span style="width:${project.progress}%"></span></span><span class="project-construction-update">${escapeReportHtml(latestProgressReport?.summary || latestProgressReport?.completedWorkItems || 'Save a daily progress report to show the latest construction update here.')}</span>${latestProgressReport?.scheduleStatus ? `<span class="status ${latestProgressReport.scheduleStatus === 'Complete' ? 'status-complete' : 'status-progress'}">${escapeReportHtml(latestProgressReport.scheduleStatus)}</span>` : ''}<span class="metric-foot">Click to view progress reports</span></button></div><div class="metric metric-yellow"><button class="metric-progress-trigger" type="button" data-project-files="${escapeReportHtml(project.id)}" aria-expanded="false" aria-controls="project-files-panel"><span class="metric-label">Connected files</span><strong data-project-file-count>View files</strong><span class="metric-foot">Click to view project files</span></button></div></div>
    <section class="panel project-files-panel" id="project-files-panel" data-project-files-panel hidden><div class="panel-header"><div><div class="eyebrow">PROJECT DOCUMENTS</div><h2>Connected files</h2><p>Files uploaded for ${escapeReportHtml(project.name)}.</p></div></div><div data-project-file-list></div></section>
    ${paymentScheduleNotice}
    <div class="project-progress-stack" id="project-progress-stack" hidden><section class="panel dpr-panel">
      <div class="panel-header"><div><div class="eyebrow">FIELD REPORTING</div><h2>Daily Progress Report</h2><p>Project-linked daily record · <span data-report-heading-number>${reportNumber}</span></p></div><span class="status ${statusClass(reportProject.status)}" data-dpr-progress>${reportProject.progress}%</span></div>
      <form id="daily-progress-form" class="project-progress-form dpr-form" data-project-id="${project.id}">
        <input type="hidden" name="reportNo" value="${reportNumber}">
        <section class="dpr-report-meta dpr-form-meta">
          <label><span>Project</span><select name="projectId" required>${projects.map(item => `<option value="${item.id}"${item.id === reportProject.id ? ' selected' : ''}>${item.name} · ${item.id}</option>`).join('')}</select><small data-report-number>${reportNumber}</small></label>
          <label><span>Client</span><input data-report-client value="${reportProject.client}" readonly></label>
          <label><span>Location</span><input data-report-location value="${reportProject.location}" readonly></label>
          <label><span>Report date</span><input name="reportDate" type="date" required></label>
          <label><span>Client phone</span><input name="clientPhone" type="tel" value="${reportProject.clientPhone || ''}" placeholder="+231 77 000 0000"></label>
          <label><span>Client WhatsApp</span><input name="whatsapp" type="tel" value="${reportProject.whatsapp || ''}" placeholder="+231 77 000 0000"></label>
          <label><span>Client email</span><input name="clientEmail" type="email" value="${reportProject.clientEmail || ''}" placeholder="client@example.com"></label>
        </section>
        <section class="dpr-report-progress dpr-form-progress">
          <label><span>Overall project progress</span><div><input name="reportPercent" type="number" min="0" max="100" step="1" value="${reportProject.progress}" required><strong>%</strong></div></label>
          <label><span>Status</span><select name="scheduleStatus"><option>On schedule</option><option>At risk</option><option>Delayed</option><option>Complete</option></select></label>
        </section>
        <section class="dpr-form-section">
          <div class="dpr-form-section-heading"><h3>Work area progress</h3><button class="text-button" type="button" data-add-activity>＋ Add work area</button></div>
          <div class="dpr-report-table-wrap"><table class="dpr-report-table dpr-form-table"><thead><tr><th>Work area</th><th>Progress</th><th>Status</th><th></th></tr></thead><tbody data-activity-rows>${defaultActivities.map(workActivityRow).join('')}</tbody></table></div>
        </section>
        <div class="dpr-report-columns dpr-form-columns">
          <section class="dpr-form-section"><label class="dpr-form-textarea"><span>Work completed / current activities</span><textarea name="completedWorkItems" rows="6" required placeholder="List the work completed and activities currently underway."></textarea></label></section>
          <section class="dpr-form-section dpr-report-planned"><label class="dpr-form-textarea"><span>Next work planned</span><textarea name="tomorrowPlan" rows="6" placeholder="List the next work planned for the project."></textarea></label></section>
        </div>
        <section class="dpr-form-section dpr-form-photo-section">
          <h3>Project photos</h3>
          <label class="dpr-photo-picker">＋ Add project photos<input name="photos" type="file" accept="image/*" multiple></label><div class="dpr-photo-previews" data-photo-previews></div>
        </section>
        <div class="dpr-report-columns dpr-form-columns dpr-form-bottom">
          <section class="dpr-form-section"><label class="dpr-form-textarea"><span>Client update</span><textarea name="clientUpdate" rows="4" placeholder="Write the progress update to share with the client."></textarea></label></section>
          <section class="dpr-form-section dpr-report-planned"><label class="dpr-form-textarea"><span>Issues / delays</span><textarea name="issueDetails" rows="4" placeholder="Describe any issues, delays, or write 'None'."></textarea></label></section>
        </div>
        <div class="dpr-form-footer"><span>Project completion updates when this report is saved. Sharing opens WhatsApp or email with the report ready to send.</span><div class="project-progress-actions"><button class="button button-primary" type="submit">Save report <span>→</span></button><button class="button button-ghost project-share-progress" type="button">Save &amp; share with client</button></div></div>
      </form>
      <section class="dpr-history" aria-live="polite">
        <div class="panel-header"><div><h3>Project progress history</h3><p>Saved updates for ${escapeReportHtml(project.name)}</p></div><strong>${getProjectReports(project).length}</strong></div>
        ${getProjectReports(project).length ? `<div class="dpr-history-list">${[...getProjectReports(project)].reverse().map(report => `<article class="dpr-history-item"><div class="dpr-history-heading"><div><strong>${escapeReportHtml(report.reportNo || 'Progress report')}</strong><span>${escapeReportHtml(new Date(`${report.date}T00:00:00`).toLocaleDateString())}</span></div><span class="progress-badge">${report.percent}% complete</span></div><p>${escapeReportHtml(report.summary || report.completedWorkItems || 'Progress updated.')}</p>${report.scheduleStatus ? `<div class="dpr-history-meta">Status: ${escapeReportHtml(report.scheduleStatus)}</div>` : ''}</article>`).join('')}</div>` : '<p class="dpr-history-meta">No reports have been saved for this project yet.</p>'}
      </section>
    </section></div>
  `;
  window.appendProjectWorkers?.(project.id);

  const progressTrigger = content.querySelector('.metric-progress-trigger');
  const progressSection = document.getElementById('project-progress-stack');
  progressTrigger.addEventListener('click', () => {
    const isExpanded = progressTrigger.getAttribute('aria-expanded') === 'true';
    progressTrigger.setAttribute('aria-expanded', String(!isExpanded));
    progressSection.hidden = isExpanded;
  });

  const form = document.getElementById('daily-progress-form');
  form.elements.reportDate.value = localDateString();
  let photoFiles = [];

  form.elements.projectId.addEventListener('change', () => {
    const selectedProject = projects.find(item => item.id === form.elements.projectId.value);
    if (!selectedProject) {
      window.alert('Select a project from the existing project list.');
      form.elements.projectId.value = reportProject.id;
      return;
    }

    reportProject = selectedProject;
    const latestProgressReport = getProjectReports(reportProject).at(-1);
    if (latestProgressReport) reportProject.progress = latestProgressReport.percent;
    else reportProject.progress = Number(reportProject.progress) || 0;
    form.elements.clientPhone.value = reportProject.clientPhone || '';
    form.elements.whatsapp.value = reportProject.whatsapp || '';
    form.elements.clientEmail.value = reportProject.clientEmail || '';
    const selectedReportNumber = makeReportNumber(reportProject);
    form.dataset.projectId = reportProject.id;
    form.elements.reportNo.value = selectedReportNumber;
    form.elements.reportPercent.value = reportProject.progress;
    form.elements.scheduleStatus.value = reportProject.status === 'Complete' ? 'Complete' : 'On schedule';
    form.querySelector('[data-report-client]').value = reportProject.client;
    form.querySelector('[data-report-location]').value = reportProject.location;
    form.querySelector('[data-report-number]').textContent = selectedReportNumber;
    content.querySelector('[data-report-heading-number]').textContent = selectedReportNumber;
    content.querySelector('[data-dpr-progress]').textContent = `${reportProject.progress}%`;
    content.querySelector('[data-dpr-progress]').className = `status ${statusClass(reportProject.status)}`;
  });

  const updateDerivedValues = () => {
    form.querySelectorAll('[data-work-activity-row]').forEach(row => {
      const percent = Math.min(100, Math.max(0, Number(row.querySelector('[name="activityPercent"]').value) || 0));
      row.querySelector('[data-activity-status]').textContent = percent >= 100 ? 'Completed' : percent > 0 ? 'In Progress' : 'Not started';
    });
  };

  form.addEventListener('input', updateDerivedValues);
  form.addEventListener('change', updateDerivedValues);
  form.addEventListener('change', event => {
    if (!['clientPhone', 'whatsapp', 'clientEmail'].includes(event.target.name)) return;
    reportProject.clientPhone = form.elements.clientPhone.value.trim();
    reportProject.whatsapp = form.elements.whatsapp.value.trim();
    reportProject.clientEmail = form.elements.clientEmail.value.trim();
    try {
      persistProjectContacts();
    } catch (error) {
      console.error('Client contact details could not be saved.', error);
      window.alert('Client contact details could not be saved in this browser. Check available storage and try again.');
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    saveProgressReport(form, reportProject, photoFiles, false);
  });
  form.querySelector('.project-share-progress').addEventListener('click', () => {
    if (!form.reportValidity()) return;
    const shareWindow = window.open('', '_blank');
    if (!shareWindow) {
      window.alert('Allow pop-ups for this site before saving and sharing the report.');
      return;
    }
    saveProgressReport(form, reportProject, photoFiles, true, shareWindow);
  });
  form.querySelector('[data-add-activity]').addEventListener('click', () => {
    form.querySelector('[data-activity-rows]').insertAdjacentHTML('beforeend', workActivityRow());
  });
  form.addEventListener('click', event => {
    const removeButton = event.target.closest('.dpr-remove-row');
    if (removeButton) {
      removeButton.closest('tr').remove();
      updateDerivedValues();
    }
  });
  form.elements.photos.addEventListener('change', () => {
    const files = [...form.elements.photos.files].slice(0, 8);
    photoFiles = files.map(file => ({ file, url: URL.createObjectURL(file) }));
    form.querySelector('[data-photo-previews]').innerHTML = photoFiles.map((photo, index) => `<figure><img src="${photo.url}" alt="Selected site photo ${index + 1}"><figcaption><input data-photo-caption="${index}" placeholder="Short photo description" aria-label="Photo ${index + 1} description"></figcaption></figure>`).join('');
  });
  updateDerivedValues();
}

function collectProgressReport(form, project, photos) {
  const formData = new FormData(form);
  const value = name => String(formData.get(name) || '').trim();
  const activities = [...form.querySelectorAll('[data-work-activity-row]')].map(row => {
    const percentComplete = Math.min(100, Math.max(0, Number(row.querySelector('[name="activityPercent"]').value) || 0));
    return {
      activity: row.querySelector('[name="activity"]').value.trim(),
      percentComplete,
      status: percentComplete >= 100 ? 'Completed' : percentComplete > 0 ? 'In Progress' : 'Not started'
    };
  }).filter(activity => activity.activity);
  const photosWithCaptions = photos.map((photo, index) => ({
    file: photo.file,
    name: photo.file.name,
    caption: form.querySelector(`[data-photo-caption="${index}"]`)?.value.trim() || ''
  }));
  const completedWorkItems = value('completedWorkItems');
  const clientUpdate = value('clientUpdate');

  return {
    reportNo: value('reportNo'),
    date: value('reportDate'),
    percent: Math.min(100, Math.max(0, Number(value('reportPercent')))),
    scheduleStatus: value('scheduleStatus'),
    summary: clientUpdate || completedWorkItems,
    completedWork: completedWorkItems,
    clientUpdate,
    completedWorkItems,
    company: 'Smart Construction Hub',
    projectId: project.id,
    projectName: project.name,
    client: project.client,
    location: project.location,
    supervisor: '',
    totalWorkers: 0,
    activities,
    materials: [],
    issues: value('issueDetails').split(/\r?\n/).map(issue => issue.trim()).filter(issue => issue && issue.toLowerCase() !== 'none'),
    issueDetails: value('issueDetails'),
    beforeWork: '',
    inProgressWork: '',
    defects: '',
    expenses: [],
    tomorrowPlan: value('tomorrowPlan'),
    photos: photosWithCaptions,
    approvals: {}
  };
}

function resizeProgressPhoto(file, caption) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1200 / image.naturalWidth, 1200 / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve({ name: file.name, caption, dataUrl: canvas.toDataURL('image/jpeg', 0.68) });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not open photo: ${file.name}`));
    };
    image.src = objectUrl;
  });
}

function persistProjectProgressReports() {
  const savedReports = Object.fromEntries(projects.map(project => [project.id, (project.progressReports || []).filter(report => report.reportNo)]));
  localStorage.setItem(progressStorageKey, JSON.stringify(savedReports));
}

function persistProjectContacts() {
  const savedContacts = Object.fromEntries(projects.map(project => [project.id, {
    clientPhone: project.clientPhone || '',
    whatsapp: project.whatsapp || '',
    clientEmail: project.clientEmail || ''
  }]));
  localStorage.setItem(projectContactsStorageKey, JSON.stringify(savedContacts));
}

async function saveProgressReport(form, project, photos, shouldShare, shareWindow = null) {
  if (!form.reportValidity()) {
    shareWindow?.close();
    return;
  }
  const report = collectProgressReport(form, project, photos);
  if (!report.completedWork) {
    shareWindow?.close();
    window.alert('Add the work completed or currently underway before saving the report.');
    form.elements.completedWorkItems.focus();
    return;
  }

  project.clientPhone = form.elements.clientPhone.value.trim();
  project.whatsapp = form.elements.whatsapp.value.trim();
  project.clientEmail = form.elements.clientEmail.value.trim();

  try {
    report.photos = await Promise.all(report.photos.map(photo => resizeProgressPhoto(photo.file, photo.caption)));
  } catch (error) {
    shareWindow?.close();
    window.alert(error.message);
    return;
  }

  project.progressReports.push(report);
  project.progress = report.percent;
  project.status = project.progress >= 100 ? 'Complete' : 'In progress';
  try {
    persistProjectProgressReports();
  } catch (error) {
    report.photos = report.photos.map(photo => ({ name: photo.name, caption: photo.caption }));
    try {
      persistProjectProgressReports();
      window.alert('Report saved. Photos were not stored because browser storage is full.');
    } catch (storageError) {
      window.alert('Report saved for this session, but browser storage is full. Export or share it before closing this page.');
    }
  }

  try {
    persistProjectContacts();
  } catch (error) {
    console.error('Client contact details could not be saved.', error);
    window.alert('The report was saved, but the client contact details could not be stored in this browser.');
  }

  openProject(project.id);
  if (shouldShare) await shareProjectProgressWithClient(project.id, report, shareWindow);
}

async function receiptsView() {
  const customerReceipts = (Array.isArray(payments) ? payments : []).map(payment => ({ ...payment, receiptType: 'customer' }));
  let workerReceipts = Array.isArray(window.workerPayments) ? [...window.workerPayments] : [];
  if (databaseConnected) {
    try {
      const legacyWorkerReceipts = workerReceipts;
      workerReceipts = await apiRequest('/worker-payments');
      const storedWorkerIds = new Set(workerReceipts.map(payment => String(payment.receiptNumber || payment.id)));
      workerReceipts.push(...legacyWorkerReceipts.filter(payment => !storedWorkerIds.has(String(payment.receiptNumber || payment.id))));
      window.workerPayments = workerReceipts;
    } catch (error) {
      console.warn('Worker payment receipts could not be loaded from the database.', error);
    }
  }
  const receipts = [
    ...customerReceipts,
    ...workerReceipts.map(payment => ({ ...payment, receiptType: 'worker' }))
  ].sort((left, right) => new Date(right.paymentDate) - new Date(left.paymentDate));

  content.innerHTML = `
    <div class="view-title"><div><div class="eyebrow">FINANCIAL RECORDS</div><h1>Receipts</h1><p>Issued customer and worker payment receipts are kept here for future reference.</p></div></div>
    <section class="panel view-table-panel">
      <div class="panel-header"><div><h2>Issued receipts</h2><p>${databaseConnected ? 'Saved to the connected database.' : 'Saved in this browser.'}</p></div><strong>${receipts.length}</strong></div>
      ${receipts.length ? `<div class="receipt-archive-scroll"><table class="project-table full-table"><thead><tr><th>Receipt</th><th>Type</th><th>Date</th><th>Received from / paid to</th><th>Project</th><th>Method</th><th>Amount</th><th></th></tr></thead><tbody>${receipts.map((payment, index) => {
        const worker = payment.receiptType === 'worker';
        const project = projects.find(item => item.id === payment.project?.projectNumber || item.databaseId === payment.projectId || item.name === payment.project?.name || item.name === payment.projectName);
        const person = worker ? payment.worker?.fullName || payment.workerName || 'Worker' : payment.clientName || project?.client || 'Client';
        const receiptNumber = payment.receiptNumber || `${worker ? 'WRC' : 'SCH'}-${String(payment.id).replace(/\D/g, '').slice(-6).padStart(6, '0')}`;
        return `<tr><td><strong>${escapeReportHtml(receiptNumber)}</strong></td><td>${worker ? 'Worker payment' : 'Customer payment'}</td><td>${escapeReportHtml(new Date(payment.paymentDate).toLocaleString())}</td><td>${escapeReportHtml(person)}</td><td>${escapeReportHtml(payment.projectName || payment.project?.name || project?.name || 'Project')}</td><td>${escapeReportHtml(payment.paymentMethod || 'Cash')}</td><td class="project-amount">${money(payment.amount)}</td><td><button type="button" class="button button-ghost" data-open-issued-receipt="${index}">View receipt</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty-state">No receipts have been issued yet. Receipts will be saved here after you record a payment.</div>'}
    </section>
  `;
  content.querySelectorAll('[data-open-issued-receipt]').forEach(button => {
    button.addEventListener('click', () => {
      const payment = receipts[Number(button.dataset.openIssuedReceipt)];
      if (payment.receiptType === 'worker') window.showWorkerReceipt?.(payment);
      else window.showReceipt?.(payment);
    });
  });
}

function setView(view) {
  activeView = view;
  document.querySelectorAll('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  document.getElementById('breadcrumb-title').textContent = view === 'overview' ? 'SCH Dashboard' : view.charAt(0).toUpperCase() + view.slice(1);
  document.querySelector('#sidebar [data-view="projects"] b').textContent = projects.length;

  const views = {
    overview,
    activity: activityView,
    settings: settingsView,
    projects: projectsView,
    clients: clientsView,
    estimates: () => {
      content.innerHTML = `
        <div class="view-title">
          <div><div class="eyebrow">COST CONTROL</div><h1>Estimates</h1><p>Build estimates or upload a signed estimate PDF linked to its project and owner.</p></div>
          <button class="button button-primary" type="button" data-open-estimate-upload>＋ Upload estimate PDF</button>
        </div>
        <section class="panel view-table-panel">
          <div class="panel-header"><div><h2>Estimate records</h2><p>Uploaded PDF copies attached to projects.</p></div></div>
          <div data-estimate-pdf-list></div>
        </section>
      `;
      renderEstimatePdfList(content.querySelector('[data-estimate-pdf-list]'), 'No estimate PDFs uploaded yet. Use “Upload estimate PDF” to add a copy.');
    },
    workers: () => workersView(),
    attendance: () => attendanceView(),
    receipts: receiptsView,
    payments: () => {
      const today = localDateString();
      const pendingProjects = projects.filter(project => {
        const balance = Number(project.amount) - (Number(project.paid) || 0);
        return balance > 0 && (
          project.nextPaymentDate
            ? project.nextPaymentDate <= today
            : project.status === 'Pending payment'
        );
      });
      content.innerHTML = `
        <div class="view-title">
          <div><div class="eyebrow">CASH FLOW</div><h1>Payments</h1><p>Record money received from clients or paid to workers.</p></div>
          <button class="button button-primary" type="button" data-open-payment-choices>＋ Record payment</button>
        </div>
        ${pendingProjects.length ? `
          <section class="panel view-table-panel">
            <div class="panel-header"><div><h2>Waiting for payment</h2><p>First payments awaiting payment or scheduled payments due today.</p></div><strong>${pendingProjects.length}</strong></div>
            <table class="project-table full-table">
              <thead><tr><th>Project & client</th><th>Location</th><th>Status</th><th>Scheduled payment</th><th>Contract value</th><th>Paid</th><th>Balance due</th><th>Action</th></tr></thead>
              <tbody>${pendingProjects.map(project => {
                const amount = Number(project.amount) || 0;
                const paid = Number(project.paid) || 0;
                return `<tr data-project="${escapeReportHtml(project.id)}">
                  <td><strong class="project-name">${escapeReportHtml(project.name)}</strong><span class="project-client">${escapeReportHtml(project.client)}</span></td>
                  <td>${escapeReportHtml(project.location)}</td>
                  <td><span class="status status-review">${project.nextPaymentDate ? 'Payment due' : 'Pending payment'}</span></td>
                  <td class="project-amount">${project.nextPaymentAmount ? money(project.nextPaymentAmount) : '—'}</td>
                  <td class="project-amount">${money(amount)}</td>
                  <td class="project-amount">${money(paid)}</td>
                  <td class="project-amount">${money(Math.max(0, amount - paid))}</td>
                  <td><button class="button button-primary" type="button" data-record-payment="${escapeReportHtml(project.id)}">Record payment</button></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </section>
        ` : '<section class="panel empty-state"><div class="activity-icon" style="margin:0 auto 13px">↗</div><strong>No projects are due for payment today.</strong><p>New projects appear here until the first payment is recorded. Scheduled projects return on their payment due date.</p></section>'}
      `;
    },
    documents: () => {
      content.innerHTML = `
        <div class="view-title"><div><div class="eyebrow">PROJECT RECORDS</div><h1>Documents</h1><p>Find estimate PDFs together with the project and owner details they belong to.</p></div></div>
        <section class="panel view-table-panel">
          <div class="panel-header"><div><h2>Uploaded estimate PDFs</h2><p>Estimate documents uploaded for projects in this workspace.</p></div></div>
          <div data-estimate-pdf-list></div>
        </section>
      `;
      renderEstimatePdfList(content.querySelector('[data-estimate-pdf-list]'), 'No estimate PDFs have been uploaded.');
    }
  };

  (views[view] || views.overview)();
}

const topSearch = document.getElementById('top-search');
const globalSearchInput = document.getElementById('global-search-input');
const globalSearchResults = document.getElementById('global-search-results');
let globalSearchRecords = [];
let globalSearchIndexReady = false;

function searchNormalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function openSearchRecordSummary(type, title, fields, backView) {
  const rows = Object.entries(fields).filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => '<div class="search-summary-row"><span>' + escapeReportHtml(label) + '</span><strong>' + escapeReportHtml(value) + '</strong></div>').join('');
  content.innerHTML = '<div class="view-title"><div><div class="eyebrow">' + escapeReportHtml(type) + '</div><h1>' + escapeReportHtml(title) + '</h1><p>Record details from workspace search.</p></div><button class="button button-ghost" type="button" data-view-link="' + escapeReportHtml(backView || 'overview') + '">Back</button></div><section class="panel search-summary-panel">' + rows + '</section>';
}

async function createGlobalSearchIndex() {
  const records = [];
  const add = (type, title, detail, terms, action) => records.push({ type, title, detail, terms: searchNormalize(terms), action });
  projects.forEach(project => {
    add('Project', project.name, project.id + ' · ' + project.client + ' · ' + project.location, [project.name, project.id, project.client, project.type, project.location, project.status].join(' '), () => openProject(project.id));
    getProjectReports(project).forEach(report => add('Progress report', report.reportNo || project.id, project.name + ' · ' + (report.date || '') + ' · ' + (report.percent ?? 0) + '% complete', [project.name, project.id, report.reportNo, report.summary, report.date, report.percent, report.workCompleted, report.tomorrowPlan].join(' '), () => openProject(project.id)));
  });
  const indexedClients = new Map();
  [...new Set(projects.map(project => project.client).filter(Boolean))].forEach(name => {
    const linked = getClientProjects(name);
    indexedClients.set(searchNormalize(name), true);
    add('Client', name, linked.length + ' linked project' + (linked.length === 1 ? '' : 's'), name + ' ' + linked.map(project => [project.name, project.clientPhone, project.clientEmail, project.location].join(' ')).join(' '), () => openClientDetail(name));
  });
  [...new Map([...(window.workerRecords || []), ...projectWorkers].map(worker => [worker.workerNumber || worker.WorkerNumber, worker])).values()].forEach(worker => {
    const number = worker.workerNumber || worker.WorkerNumber;
    const name = worker.fullName || worker.FullName || 'Worker';
    add('Worker', name, number + ' · ' + (worker.skill || worker.Skill || 'Worker record'), [name, number, worker.phone || worker.Phone, worker.skill || worker.Skill, worker.position || worker.Position].join(' '), () => {
      if (window.openAssignedWorkerDetail) window.openAssignedWorkerDetail(number);
      else { setView('workers'); openSearchRecordSummary('Worker', name, { 'Worker ID': number, Phone: worker.phone || worker.Phone, Skill: worker.skill || worker.Skill, Position: worker.position || worker.Position }, 'workers'); }
    });
  });
  (Array.isArray(payments) ? payments : []).forEach(payment => {
    const project = projects.find(item => item.databaseId === payment.projectId || item.id === payment.project?.projectNumber || item.name === payment.projectName);
    const title = payment.receiptNumber || 'Client payment ' + payment.id;
    const person = payment.clientName || project?.client || 'Client';
    const projectName = payment.projectName || project?.name || '';
    add('Client payment', title, person + ' · ' + projectName + ' · ' + money(payment.amount), [title, person, projectName, payment.paymentMethod, payment.notes, payment.amount].join(' '), () => window.showReceipt?.(payment));
  });
  (recentActivities || []).forEach(activity => add('Activity', activity.title, activity.detail, [activity.title, activity.detail].join(' '), () => setView('activity')));
  [...new Map([...(Array.isArray(window.workerPayments) ? window.workerPayments : []), ...dashboardWorkerPayments].map(payment => [String(payment.receiptNumber || payment.id), payment])).values()].forEach(payment => {
    const person = payment.worker?.fullName || payment.workerName || 'Worker';
    const projectName = payment.project?.name || payment.projectName || '';
    const title = payment.receiptNumber || 'Worker payment ' + payment.id;
    add('Worker payment', title, person + ' · ' + projectName + ' · ' + money(payment.amount), [title, person, payment.worker?.workerNumber, projectName, payment.paymentMethod, payment.notes, payment.amount].join(' '), () => window.showWorkerReceipt?.(payment));
  });
  try {
    (await getEstimatePdfs()).forEach(file => add('Estimate PDF', file.fileName, file.projectName + ' · ' + (file.owner || 'Client'), [file.fileName, file.projectName, file.owner, file.location].join(' '), async () => {
      setView('documents');
      const savedFile = await getEstimatePdf(file.id);
      if (savedFile) openEstimatePdfViewer(savedFile);
    }));
  } catch (error) { console.warn('Estimate PDFs could not be added to search.', error); }
  if (databaseConnected) {
    const groups = await Promise.allSettled([apiRequest('/materials'), apiRequest('/documents'), apiRequest('/estimates'), apiRequest('/clients')]);
    const data = groups.map(result => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
    data[0].forEach(item => add('Material', item.name, (item.quantityRemaining ?? 0) + ' ' + (item.unit || '') + ' remaining', [item.name, item.supplier, item.unit].join(' '), () => openSearchRecordSummary('Material', item.name, { Unit: item.unit, 'Quantity purchased': item.quantityPurchased, 'Quantity used': item.quantityUsed, 'Quantity remaining': item.quantityRemaining, Supplier: item.supplier, 'Purchase price': item.purchasePrice }, 'overview')));
    data[1].forEach(item => add('Document', item.name, (item.project?.name || 'Project') + ' · ' + (item.documentType || 'File'), [item.name, item.documentType, item.project?.name, item.filePath].join(' '), () => openSearchRecordSummary('Document', item.name, { Project: item.project?.name, Type: item.documentType, 'File location': item.filePath, 'Uploaded at': item.uploadedAt }, 'documents')));
    data[2].forEach(item => add('Estimate', item.estimateNumber, (item.project?.name || 'Project') + ' · ' + item.status, [item.estimateNumber, item.project?.name, item.status, ...(item.items || []).map(line => line.material)].join(' '), () => openSearchRecordSummary('Estimate', item.estimateNumber, { Project: item.project?.name, Status: item.status, Items: (item.items || []).map(line => line.material).join(', ') }, 'estimates')));
    data[3].forEach(client => {
      if (indexedClients.has(searchNormalize(client.fullName))) return;
      add('Client', client.fullName, [client.phoneNumber, client.email].filter(Boolean).join(' · ') || 'Client record', [client.fullName, client.phoneNumber, client.email, client.address, client.propertyLocation].join(' '), () => openSearchRecordSummary('Client', client.fullName, { Phone: client.phoneNumber, Email: client.email, Address: client.address, 'Property location': client.propertyLocation, Notes: client.notes }, 'clients'));
    });
  }
  globalSearchRecords = records;
  globalSearchIndexReady = true;
}

function renderGlobalSearchResults() {
  const terms = searchNormalize(globalSearchInput.value).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    globalSearchResults.hidden = true;
    globalSearchResults.innerHTML = '';
    return;
  }
  if (!globalSearchIndexReady) {
    globalSearchResults.hidden = false;
    globalSearchResults.innerHTML = '<div class="search-hint">Loading workspace records...</div>';
    return;
  }
  const results = globalSearchRecords.filter(record => terms.every(term => record.terms.includes(term))).slice(0, 30);
  if (!results.length) {
    globalSearchResults.hidden = false;
    globalSearchResults.innerHTML = '<div class="search-hint">No matching records found.</div>';
    return;
  }
  globalSearchResults.hidden = false;
  globalSearchResults.innerHTML = results.map((record, index) =>
    '<button class="global-search-result" type="button" role="option" data-search-result="' + index + '"><span class="search-result-type">' + escapeReportHtml(record.type) + '</span><span class="search-result-copy"><strong>' + escapeReportHtml(record.title) + '</strong><small>' + escapeReportHtml(record.detail) + '</small></span><span class="search-result-enter">↵</span></button>'
  ).join('');
  globalSearchResults.querySelectorAll('[data-search-result]').forEach((button, index) => button.addEventListener('click', async () => {
    globalSearchResults.hidden = true;
    globalSearchInput.value = '';
    try { await results[index].action(); }
    catch (error) { console.error('Search result could not be opened.', error); window.alert('That record could not be opened.'); }
  }));
}

async function prepareGlobalSearch() {
  if (globalSearchIndexReady) return;
  globalSearchResults.hidden = false;
  globalSearchResults.innerHTML = '<div class="search-hint">Loading workspace records...</div>';
  await createGlobalSearchIndex();
  renderGlobalSearchResults();
}

globalSearchInput.addEventListener('focus', prepareGlobalSearch);
globalSearchInput.addEventListener('input', async () => {
  if (!globalSearchIndexReady) await prepareGlobalSearch();
  renderGlobalSearchResults();
});
document.addEventListener('pointerdown', event => {
  if (!topSearch.contains(event.target)) globalSearchResults.hidden = true;
});
globalSearchResults.addEventListener('pointerdown', event => event.stopPropagation());
globalSearchInput.addEventListener('keydown', event => {
  if (event.key === 'Escape') { globalSearchResults.hidden = true; globalSearchInput.blur(); }
  else if (event.key === 'Enter') globalSearchResults.querySelector('[data-search-result]')?.click();
  else if (event.key === 'ArrowDown') {
    const first = globalSearchResults.querySelector('[data-search-result]');
    if (first) { event.preventDefault(); first.focus(); }
  }
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); globalSearchInput.focus(); }
});

document.addEventListener('click', event => {
  if (event.target.closest('[data-open-payment-choices]')) {
    window.openPaymentChoices?.();
    return;
  }

  const issuedReceiptButton = event.target.closest('[data-open-issued-receipt]');
  if (issuedReceiptButton) return;

  const uploadEstimateButton = event.target.closest('[data-open-estimate-upload]');
  if (uploadEstimateButton) {
    const form = document.getElementById('estimate-pdf-form');
    form.reset();
    form.elements.projectId.innerHTML = '<option value="">Choose a project…</option>' + projects.map(project =>
      `<option value="${escapeReportHtml(project.id)}">${escapeReportHtml(project.name)} · ${escapeReportHtml(project.id)}</option>`
    ).join('');
    document.getElementById('estimate-pdf-modal-backdrop').hidden = false;
    form.elements.projectId.focus();
    return;
  }

  if (event.target.closest('#estimate-pdf-modal-close') ||
      event.target.closest('#estimate-pdf-cancel') ||
      event.target.id === 'estimate-pdf-modal-backdrop') {
    document.getElementById('estimate-pdf-modal-backdrop').hidden = true;
    return;
  }

  if (event.target.closest('#estimate-pdf-viewer-close') ||
      event.target.id === 'estimate-pdf-viewer-backdrop') {
    closeEstimatePdfViewer();
    return;
  }

  const openEstimatePdfButton = event.target.closest('[data-open-estimate-pdf]');
  if (openEstimatePdfButton) {
    getEstimatePdf(openEstimatePdfButton.dataset.openEstimatePdf).then(documentRecord => {
      openEstimatePdfViewer(documentRecord);
    }).catch(error => {
      console.error('Estimate PDF could not be opened.', error);
      window.alert('Estimate PDF could not be opened. Please try again.');
    });
    return;
  }

  const addWorkerButton = event.target.closest('[data-add-worker-to-project]');
  if (addWorkerButton) {
    const project = projects.find(item => item.id === addWorkerButton.dataset.addWorkerToProject);
    const form = document.getElementById('worker-form');
    if (!project || !form) {
      window.alert('The selected project could not be loaded for adding a worker.');
      return;
    }

    form.reset();
    form.elements.projectId.replaceChildren();
    projects.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} · ${item.client}`;
      form.elements.projectId.appendChild(option);
    });
    form.elements.projectId.value = project.id;
    document.getElementById('worker-modal-title').textContent = `Add worker to ${project.name}`;
    document.getElementById('worker-modal-backdrop').hidden = false;
    form.elements.workerNumber.focus();
    return;
  }

  if (event.target.closest('[data-add-worker]')) {
    const form = document.getElementById('worker-form');
    if (!form) return;
    form.reset();
    form.elements.projectId.replaceChildren(new Option('No project assigned yet', ''));
    projects.forEach(item => form.elements.projectId.add(new Option(`${item.name} · ${item.client}`, item.id)));
    form.elements.projectId.value = '';
    document.getElementById('worker-modal-title').textContent = 'Add worker';
    document.getElementById('worker-modal-backdrop').hidden = false;
    form.elements.workerNumber.focus();
    return;
  }

  const addProjectForClient = event.target.closest('[data-client-add-project]');
  if (addProjectForClient) {
    projectCreationClientName = addProjectForClient.dataset.clientAddProject;
    const clientProjects = getClientProjects(projectCreationClientName);
    const client = clientProjects.find(project => project.clientPhone || project.whatsapp || project.clientEmail) || clientProjects[0];
    const form = document.getElementById('project-form');
    form.reset();
    form.elements.client.value = projectCreationClientName;
    form.elements.clientPhone.value = client.clientPhone || '';
    form.elements.whatsapp.value = client.whatsapp || '';
    form.elements.clientEmail.value = client.clientEmail || '';
    form.elements.type.required = false;
    document.getElementById('custom-work-type-field').hidden = true;
    document.getElementById('modal-backdrop').hidden = false;
    form.elements.name.focus();
    return;
  }

  if (event.target.closest('#add-project-button')) {
    projectCreationClientName = '';
    const form = document.getElementById('project-form');
    form.reset();
    form.elements.type.required = false;
    document.getElementById('custom-work-type-field').hidden = true;
    document.getElementById('modal-backdrop').hidden = false;
    form.elements.name.focus();
    return;
  }

  if (event.target.closest('#modal-close') || event.target.closest('#form-cancel') || event.target.id === 'modal-backdrop') {
    projectCreationClientName = '';
    document.getElementById('modal-backdrop').hidden = true;
    return;
  }

  if (event.target.closest('#worker-modal-close') || event.target.closest('#worker-form-cancel') || event.target.id === 'worker-modal-backdrop') {
    document.getElementById('worker-modal-backdrop').hidden = true;
    return;
  }

  const mobileMenuToggle = event.target.closest('#mobile-menu');
  if (mobileMenuToggle) {
    setMobileNavigationOpen(mobileMenuToggle.getAttribute('aria-expanded') !== 'true');
    return;
  }

  if (document.querySelector('.app-shell.nav-open') &&
      !event.target.closest('#sidebar') &&
      !event.target.closest('#mobile-menu')) {
    setMobileNavigationOpen(false);
  }

  const menuToggle = event.target.closest('[data-activity-menu-toggle]');
  if (menuToggle) {
    const menu = document.getElementById('activity-actions-menu');
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isExpanded));
    menu.hidden = isExpanded;
    if (!isExpanded) menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    return;
  }

  const activityAction = event.target.closest('[data-activity-action]');
  if (activityAction) {
    const action = activityAction.dataset.activityAction;
    closeActivityMenu();
    if (action === 'view') {
      setView('activity');
    } else if (action === 'read') {
      allActivityRead = true;
      try {
        localStorage.setItem(activityReadStorageKey, 'true');
      } catch (error) {
        console.warn('Activity read status could not be saved.', error);
      }
      setView(activeView);
    }
    return;
  }

  if (!event.target.closest('.activity-menu-wrap')) closeActivityMenu();

  const navItem = event.target.closest('.nav-item[data-view]');
  if (navItem) {
    setMobileNavigationOpen(false);
    setView(navItem.dataset.view);
    return;
  }

  const viewLink = event.target.closest('[data-view-link]');
  if (viewLink) {
    setMobileNavigationOpen(false);
    setView(viewLink.dataset.viewLink);
    return;
  }

  const editClientButton = event.target.closest('[data-edit-client]');
  if (editClientButton) {
    openRecordEditForm('client', {
      id: editClientButton.dataset.editClient,
      name: editClientButton.dataset.clientName,
      phone: editClientButton.dataset.clientPhone,
      whatsapp: editClientButton.dataset.clientWhatsapp,
      email: editClientButton.dataset.clientEmail,
      location: editClientButton.dataset.clientLocation
    });
    return;
  }

  const editWorkerButton = event.target.closest('[data-edit-worker]');
  if (editWorkerButton) {
    const worker = [...(window.workerRecords || []), ...projectWorkers].find(item => String(item.id || item.Id) === editWorkerButton.dataset.editWorker || item.workerNumber === editWorkerButton.dataset.editWorker);
    if (worker) openRecordEditForm('worker', worker);
    return;
  }

  if (event.target.closest('#record-edit-modal-close') || event.target.closest('#record-edit-cancel') || event.target.id === 'record-edit-modal-backdrop') {
    document.getElementById('record-edit-modal-backdrop').hidden = true;
    recordBeingEdited = null;
    return;
  }

  const editForm = event.target.closest('#record-edit-form');
  if (editForm) return;

  const clientButton = event.target.closest('[data-client-name]');
  if (clientButton) {
    openClientDetail(clientButton.dataset.clientName);
    return;
  }

  const clientProjectButton = event.target.closest('[data-client-project]');
  if (clientProjectButton) {
    openProject(clientProjectButton.dataset.clientProject);
    return;
  }

  const projectFilesButton = event.target.closest('[data-project-files]');
  if (projectFilesButton) {
    const panel = document.querySelector('[data-project-files-panel]');
    const list = panel?.querySelector('[data-project-file-list]');
    const isOpening = panel?.hidden !== false;
    if (!panel || !list) return;
    panel.hidden = !isOpening;
    projectFilesButton.setAttribute('aria-expanded', String(isOpening));
    if (isOpening) {
      list.innerHTML = '<div class="empty-state">Loading project files…</div>';
      getEstimatePdfs().then(documents => {
        const projectDocuments = documents.filter(item => item.projectId === projectFilesButton.dataset.projectFiles);
        list.innerHTML = projectDocuments.length
          ? `<div class="estimate-pdf-table-wrap"><table class="project-table full-table"><thead><tr><th>File</th><th>Uploaded</th><th></th></tr></thead><tbody>${projectDocuments.map(item => `<tr><td><button class="estimate-pdf-file-link" type="button" data-open-estimate-pdf="${escapeReportHtml(item.id)}">${escapeReportHtml(item.fileName)}</button></td><td>${new Date(item.uploadedAt).toLocaleDateString()}</td><td><button class="button button-ghost" type="button" data-open-estimate-pdf="${escapeReportHtml(item.id)}">View file</button></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty-state">No files have been uploaded for this project yet. Upload an estimate PDF from Estimates to add a project file.</div>';
      }).catch(error => {
        console.error('Project files could not be loaded.', error);
        list.innerHTML = '<div class="empty-state">Project files could not be loaded. Try again.</div>';
      });
    }
    return;
  }

  const projectRow = event.target.closest('tr[data-project]');
  const recordPaymentButton = event.target.closest('[data-record-payment]');
  if (recordPaymentButton) {
    openPaymentModal(recordPaymentButton.dataset.recordPayment);
    return;
  }

  if (projectRow) {
    openProject(projectRow.dataset.project);
  }

  const workerRow = event.target.closest('tr[data-worker-number]');
  if (workerRow && activeView === 'workers') {
    window.openAssignedWorkerDetail?.(workerRow.dataset.workerNumber);
  }
});

function workersView() {
  const workers = [...new Map([...projectWorkers, ...(window.workerRecords || [])].map(worker => [worker.workerNumber, worker])).values()];
  content.innerHTML = `
    <div class="view-title">
      <div><div class="eyebrow">FIELD OPERATIONS</div><h1>Workers</h1><p>Review workers and the projects they are assigned to.</p></div>
      <button class="button button-primary" type="button" data-add-worker>＋ Add worker</button>
    </div>
    ${workers.length ? `
      <section class="panel view-table-panel">
        <div class="panel-header"><div><h2>Worker records</h2><p>Add workers here, then assign them to projects when ready.</p></div><strong>${workers.length}</strong></div>
        <table class="project-table full-table">
          <thead><tr><th>Worker</th><th>Phone</th><th>Skill / position</th><th>Assigned projects</th><th>Status</th></tr></thead>
          <tbody>${workers.map(worker => {
            const assignments = projects.flatMap(project => (project.workerAssignments || [])
              .filter(assignment => (assignment.Worker || assignment.worker)?.workerNumber === worker.workerNumber)
              .map(assignment => ({ project, assignment })));
            const projectLabels = assignments.map(({ project, assignment }) =>
              `${project.name}${assignment.Position || assignment.position ? ` · ${assignment.Position || assignment.position}` : ''}`
            );
            return `<tr id="worker-${escapeReportHtml(worker.workerNumber)}" data-worker-number="${escapeReportHtml(worker.workerNumber)}">
              <td><strong class="project-name">${escapeReportHtml(worker.fullName)}</strong><span class="project-client">${escapeReportHtml(worker.workerNumber)}</span></td>
              <td>${escapeReportHtml(worker.phone || 'Not recorded')}</td>
              <td>${escapeReportHtml(worker.skill || 'Not specified')}</td>
              <td>${projectLabels.length ? projectLabels.map(escapeReportHtml).join('<br>') : 'No project assigned'}</td>
              <td><span class="status ${worker.status === 'Inactive' ? 'status-review' : 'status-progress'}">${escapeReportHtml(worker.status || 'Active')}</span><div><button class="text-button" type="button" data-edit-worker="${escapeReportHtml(worker.id || worker.Id || worker.workerNumber)}">Edit details</button></div></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </section>
    ` : '<section class="panel empty-state"><div class="activity-icon" style="margin:0 auto 13px">◉</div><strong>No workers added yet.</strong><p>Add a worker now, then assign them to a project later.</p></section>'}
  `;
}

async function attendanceView(mode = 'menu') {
  const today = localDateString();
  if (mode === 'menu') {
    content.innerHTML = `
      <div class="view-title"><div><div class="eyebrow">FIELD OPERATIONS</div><h1>Attendance</h1><p>Choose whether to record attendance or review saved records.</p></div></div>
      <div class="attendance-choice-grid">
        <button class="panel attendance-choice" type="button" data-attendance-option="record"><span class="attendance-choice-icon">＋</span><strong>Record attendance</strong><span>Open today’s worker attendance sheet to enter status, hours, and notes.</span></button>
        <button class="panel attendance-choice" type="button" data-attendance-option="view"><span class="attendance-choice-icon">▤</span><strong>View attendance</strong><span>Browse past attendance sheets and review recorded worker details.</span></button>
      </div>
    `;
    content.querySelectorAll('[data-attendance-option]').forEach(button => {
      button.addEventListener('click', () => attendanceView(button.dataset.attendanceOption));
    });
    return;
  }

  const isRecordMode = mode === 'record';
  content.innerHTML = `
    <div class="view-title">
      <div><div class="eyebrow">FIELD OPERATIONS</div><h1>${isRecordMode ? 'Record attendance' : 'View attendance'}</h1><p>${isRecordMode ? 'Record each worker’s attendance, hours, and notes by date.' : 'Browse previous attendance sheets and review the full recorded details.'}</p></div>
      <div class="attendance-toolbar">${isRecordMode ? `<label class="attendance-date-picker">Attendance date<input type="date" data-attendance-date value="${today}" /></label>` : ''}<button class="button button-ghost" type="button" data-back-attendance-menu>Attendance menu</button></div>
    </div>
    <section class="panel view-table-panel attendance-panel" data-attendance-panel${isRecordMode ? '' : ' hidden'}>
      <div class="panel-header"><div><h2>${isRecordMode ? 'Daily attendance sheet' : 'Saved attendance sheet'}</h2><p data-attendance-caption>Loading worker attendance…</p></div><strong data-attendance-count>0 workers</strong></div>
      <div data-attendance-table></div>
      <div class="attendance-footer"><span data-attendance-message role="status"></span><div class="attendance-footer-actions"><button class="button button-ghost" type="button" data-back-saved-sheets${isRecordMode ? ' hidden' : ''}>Back to saved dates</button>${isRecordMode ? '<button class="button button-primary" type="button" data-save-attendance>Save attendance</button>' : ''}</div></div>
    </section>
    <section class="panel view-table-panel attendance-saved-panel" data-saved-attendance-panel${isRecordMode ? ' hidden' : ''}>
      <div class="panel-header"><div><h2>Past attendance records</h2><p>Choose a date to view everyone recorded on that sheet.</p></div></div>
      <div class="attendance-saved-dates" data-saved-attendance-dates><div class="empty-state">Loading saved attendance…</div></div>
    </section>
  `;

  const dateInput = content.querySelector('[data-attendance-date]');
  const tableContainer = content.querySelector('[data-attendance-table]');
  const caption = content.querySelector('[data-attendance-caption]');
  const count = content.querySelector('[data-attendance-count]');
  const message = content.querySelector('[data-attendance-message]');
  const saveButton = content.querySelector('[data-save-attendance]');
  const backToSavedSheetsButton = content.querySelector('[data-back-saved-sheets]');
  const savedAttendancePanel = content.querySelector('[data-saved-attendance-panel]');
  const attendancePanel = content.querySelector('[data-attendance-panel]');
  const savedAttendanceDates = content.querySelector('[data-saved-attendance-dates]');
  const getWorkers = () => [...new Map([...(projectWorkers || []), ...(window.workerRecords || [])]
    .map(worker => [String(worker.workerNumber || worker.WorkerNumber || worker.id || worker.Id), worker])
    .filter(([key]) => key && key !== 'undefined')).values()]
    .sort((left, right) => String(left.fullName || left.FullName || '').localeCompare(String(right.fullName || right.FullName || '')));

  const readLocalAttendance = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(attendanceStorageKey) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      console.warn('Saved attendance could not be read.', error);
      return {};
    }
  };

  const loadAttendanceRows = async (date, readOnly = false) => {
    message.textContent = '';
    caption.textContent = `Attendance for ${new Date(`${date}T00:00:00`).toLocaleDateString()}`;
    const workers = getWorkers();
    let dailyRecords = [];
    if (databaseConnected) {
      try {
        dailyRecords = await Promise.race([
          apiRequest(`/worker-attendance?date=${encodeURIComponent(date)}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Attendance records request timed out.')), 8000))
        ]);
      } catch (error) {
        console.warn('Attendance records could not be loaded from the database.', error);
      }
    }
    const localRecords = readLocalAttendance()[date] || {};
    const recordByWorker = new Map();
    dailyRecords.forEach(record => {
      const workerNumber = String(record.workerNumber || record.WorkerNumber || '');
      const workerId = String(record.workerId || record.WorkerId || '');
      if (workerNumber) recordByWorker.set(`number:${workerNumber}`, record);
      if (workerId) recordByWorker.set(`id:${workerId}`, record);
    });
    const attendanceRecordFor = worker => {
      const workerNumber = String(worker.workerNumber || worker.WorkerNumber || '');
      const workerId = String(worker.id || worker.Id || '');
      const databaseRecord = (workerNumber ? recordByWorker.get(`number:${workerNumber}`) : null)
        || (workerId ? recordByWorker.get(`id:${workerId}`) : null);
      const localRecord = localRecords[workerNumber] || (workerId ? localRecords[workerId] : null);
      if (!databaseRecord) return localRecord || null;
      // Always retain a note from either store; database records are authoritative
      // for status and hours, while local storage is the immediate save fallback.
      const note = databaseRecord.notes ?? databaseRecord.Notes ?? localRecord?.notes ?? localRecord?.Notes ?? '';
      return { ...databaseRecord, notes: note };
    };
    const localEntries = Object.entries(localRecords);
    const savedEntryFor = worker => {
      const workerNumber = String(worker.workerNumber || worker.WorkerNumber || '');
      const workerId = String(worker.id || worker.Id || '');
      const match = localEntries.find(([key]) => key === workerNumber || (workerId && key === workerId));
      return match ? { key: match[0], record: match[1] } : null;
    };
    const databaseOnlyRecords = readOnly ? dailyRecords.filter(record => {
      const number = String(record.workerNumber || record.WorkerNumber || '');
      const id = String(record.workerId || record.WorkerId || '');
      return !workers.some(worker => (number && number === String(worker.workerNumber || worker.WorkerNumber || ''))
        || (id && id === String(worker.id || worker.Id || '')));
    }) : [];
    const visibleWorkers = readOnly ? workers.filter(worker => attendanceRecordFor(worker) || savedEntryFor(worker)) : workers;
    tableContainer.innerHTML = visibleWorkers.length ? `
      <div class="attendance-table-wrap"><table class="project-table full-table attendance-table">
        <thead><tr><th>Worker</th>${readOnly ? '' : '<th>Project</th><th>Pay rate</th>'}<th>Attendance</th><th>Hours</th><th>Notes</th></tr></thead>
        <tbody>${visibleWorkers.map(worker => {
          const workerNumber = String(worker.workerNumber || worker.WorkerNumber || '');
          const record = attendanceRecordFor(worker) || {};
          const assignments = projects.flatMap(project => (project.workerAssignments || [])
            .filter(assignment => String((assignment.Worker || assignment.worker)?.workerNumber || (assignment.Worker || assignment.worker)?.WorkerNumber || '') === workerNumber)
            .map(assignment => project.name));
          const status = record.status || record.Status || 'Not recorded';
          const hours = Number(record.workHours ?? record.WorkHours) || 0;
          const notes = record.notes || record.Notes || '';
          const payRate = Number(worker.rate ?? worker.Rate) || 0;
          const ratePeriod = String(worker.ratePeriod || worker.RatePeriod || 'Daily').toLowerCase();
          return `<tr data-attendance-worker="${escapeReportHtml(workerNumber)}" data-worker-id="${Number(worker.id ?? worker.Id) || ''}">
            <td><strong>${escapeReportHtml(worker.fullName || worker.FullName || 'Worker')}</strong><span class="project-client">${escapeReportHtml(workerNumber)}</span></td>
            ${readOnly ? '' : `<td>${assignments.length ? assignments.map(escapeReportHtml).join('<br>') : 'No project assigned'}</td><td><strong>${money(payRate)}</strong><span class="project-client">per ${escapeReportHtml(ratePeriod)}</span></td>`}
            <td>${readOnly ? `<span class="status ${status === 'Present' ? 'status-complete' : status === 'Not recorded' ? 'status-review' : 'status-progress'}">${escapeReportHtml(status)}</span>` : `<select name="attendanceStatus" aria-label="Attendance status for ${escapeReportHtml(worker.fullName || worker.FullName)}"><option${status === 'Not recorded' ? ' selected' : ''}>Not recorded</option><option${status === 'Present' ? ' selected' : ''}>Present</option><option${status === 'Absent' ? ' selected' : ''}>Absent</option><option${status === 'On leave' ? ' selected' : ''}>On leave</option></select>`}</td>
            <td>${readOnly ? escapeReportHtml(hours) : `<input name="workHours" type="number" min="0" max="24" step="0.25" value="${hours}" aria-label="Hours worked by ${escapeReportHtml(worker.fullName || worker.FullName)}" />`}</td>
            <td>${readOnly ? escapeReportHtml(notes || '—') : `<input name="attendanceNotes" value="${escapeReportHtml(notes)}" maxlength="500" placeholder="Optional note" aria-label="Attendance note for ${escapeReportHtml(worker.fullName || worker.FullName)}" />`}</td>
          </tr>`;
        }).join('')}${readOnly ? databaseOnlyRecords.map(record => {
          const number = String(record.workerNumber || record.WorkerNumber || '');
          const workerId = String(record.workerId || record.WorkerId || '');
          const localRecord = localRecords[number] || localRecords[workerId] || {};
          const status = record.status || record.Status || 'Not recorded';
          const hours = Number(record.workHours ?? record.WorkHours) || 0;
          const notes = record.notes ?? record.Notes ?? localRecord.notes ?? localRecord.Notes ?? '';
          const name = record.workerName || record.WorkerName || number || `Worker ${workerId}`;
          return `<tr><td><strong>${escapeReportHtml(name)}</strong>${number ? `<span class="project-client">${escapeReportHtml(number)}</span>` : ''}</td><td><span class="status ${status === 'Present' ? 'status-complete' : status === 'Not recorded' ? 'status-review' : 'status-progress'}">${escapeReportHtml(status)}</span></td><td>${escapeReportHtml(hours)}</td><td>${escapeReportHtml(notes || '—')}</td></tr>`;
        }).join('') : ''}</tbody>
      </table></div>` : readOnly ? '<div class="empty-state">No attendance entries were recorded for this date.</div>' : '<div class="empty-state">Add workers before recording attendance.</div>';
    count.textContent = readOnly
      ? `${visibleWorkers.length} ${visibleWorkers.length === 1 ? 'attendance record' : 'attendance records'}`
      : `${workers.length} ${workers.length === 1 ? 'worker' : 'workers'}`;
    caption.textContent = `${readOnly ? 'Saved attendance' : 'Attendance'} for ${new Date(`${date}T00:00:00`).toLocaleDateString()}`;
    if (saveButton) saveButton.hidden = readOnly;
    backToSavedSheetsButton.hidden = !readOnly;
  };

  if (dateInput) dateInput.addEventListener('change', () => loadAttendanceRows(dateInput.value || today));
  const loadSavedAttendanceDates = async () => {
    const dates = new Set(Object.keys(readLocalAttendance()));
    const renderDates = () => {
      const orderedDates = [...dates].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort((a, b) => b.localeCompare(a));
      savedAttendanceDates.innerHTML = orderedDates.length ? orderedDates.map(date => `<button class="attendance-saved-date" type="button" data-open-attendance-date="${date}"><strong>${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</strong></button>`).join('') : '<div class="empty-state">No attendance sheets have been saved yet.</div>';
    };
    renderDates();
    if (databaseConnected) {
      try {
        const databaseDates = await Promise.race([
          apiRequest('/worker-attendance/dates'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Attendance date request timed out.')), 8000))
        ]);
        databaseDates.forEach(date => dates.add(String(date).slice(0, 10)));
      } catch (error) {
        console.warn('Saved attendance dates could not be loaded from the database.', error);
      }
    }
    renderDates();
  };
  content.querySelector('[data-back-attendance-menu]').addEventListener('click', () => attendanceView('menu'));
  savedAttendanceDates.addEventListener('click', async event => {
    const button = event.target.closest('[data-open-attendance-date]');
    if (!button) return;
    attendancePanel.hidden = false;
    savedAttendancePanel.hidden = true;
    await loadAttendanceRows(button.dataset.openAttendanceDate, true);
  });
  backToSavedSheetsButton.addEventListener('click', async () => {
    attendancePanel.hidden = true;
    savedAttendancePanel.hidden = false;
    await loadSavedAttendanceDates();
  });
  if (saveButton) saveButton.addEventListener('click', async event => {
    const button = event.currentTarget;
    const date = dateInput.value || today;
    const workerByNumber = new Map(getWorkers().map(worker => [String(worker.workerNumber || worker.WorkerNumber || ''), worker]));
    const entries = [...tableContainer.querySelectorAll('[data-attendance-worker]')].map(row => ({
      workerNumber: row.dataset.attendanceWorker,
      workerId: Number(row.dataset.workerId) || null,
      status: row.querySelector('[name="attendanceStatus"]').value,
      workHours: Number(row.querySelector('[name="workHours"]').value) || 0,
      notes: row.querySelector('[name="attendanceNotes"]').value.trim()
    }));
    const local = readLocalAttendance();
    local[date] = Object.fromEntries(entries.map(entry => [entry.workerNumber, {
      status: entry.status, workHours: entry.workHours, notes: entry.notes
    }]));
    try {
      localStorage.setItem(attendanceStorageKey, JSON.stringify(local));
    } catch (error) {
      window.alert('Attendance could not be saved in this browser. Check available storage and try again.');
      return;
    }

    button.disabled = true;
    message.textContent = 'Saving attendance…';
    let databaseFailures = 0;
    let databaseSkipped = 0;
    if (databaseConnected) {
      databaseSkipped = entries.filter(entry => !entry.workerId).length;
      const results = await Promise.all(entries.filter(entry => entry.workerId).map(async entry => {
        try {
          return await apiRequest('/worker-attendance', {
            method: 'POST',
            body: JSON.stringify({ workerId: entry.workerId, attendanceDate: date, status: entry.status, workHours: entry.workHours, notes: entry.notes })
          });
        } catch (error) {
          databaseFailures++;
          console.warn(`Attendance for ${entry.workerNumber} could not be saved to the database.`, error);
          return null;
        }
      }));
      results.forEach(result => {
        if (!result) return;
        const worker = workerByNumber.get(String(result.workerNumber || result.WorkerNumber || result.workerId || result.WorkerId));
        if (!worker) return;
        worker.attendanceStatus = result.status || result.Status;
        worker.attendanceNotes = result.notes || result.Notes || '';
        worker.workHours = Number(result.workHours ?? result.WorkHours) || 0;
      });
    }
    button.disabled = false;
    message.textContent = databaseFailures || databaseSkipped
      ? `Attendance saved in this browser; ${databaseFailures + databaseSkipped} record(s) were not saved to the database.`
      : `Attendance saved for ${new Date(`${date}T00:00:00`).toLocaleDateString()}. The sheet is cleared for a new entry.`;
    tableContainer.querySelectorAll('[data-attendance-worker]').forEach(row => {
      if (!row.querySelector('[name="attendanceStatus"]')) return;
      row.querySelector('[name="attendanceStatus"]').value = 'Not recorded';
      row.querySelector('[name="workHours"]').value = '0';
      row.querySelector('[name="attendanceNotes"]').value = '';
    });
  });

  if (isRecordMode) await loadAttendanceRows(today);
  else await loadSavedAttendanceDates();
}

document.getElementById('worker-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const project = projects.find(item => item.id === form.elements.projectId.value) || null;

  const workerNumber = form.elements.workerNumber.value.trim();
  if ([...projectWorkers, ...(window.workerRecords || [])].some(item => item.workerNumber === workerNumber)) {
    window.alert('A worker with this ID already exists.');
    form.elements.workerNumber.focus();
    return;
  }

  const worker = {
    workerNumber,
    fullName: form.elements.fullName.value.trim(),
    phone: form.elements.phone.value.trim(),
    address: form.elements.address.value.trim(),
    skill: form.elements.skill.value.trim(),
    position: form.elements.workerPosition.value.trim(),
    employmentType: form.elements.employmentType.value,
    rate: Number(form.elements.workerAmount.value),
    ratePeriod: form.elements.paymentCondition.value,
    dateHired: form.elements.dateHired.value,
    emergencyContactName: form.elements.emergencyContactName.value.trim(),
    emergencyContactPhone: form.elements.emergencyContactPhone.value.trim(),
    idDocumentType: form.elements.idDocumentType.value.trim(),
    idDocumentNumber: form.elements.idDocumentNumber.value.trim(),
    attendanceStatus: form.elements.attendanceStatus.value,
    attendanceNotes: form.elements.attendanceNotes.value.trim(),
    workHours: Number(form.elements.workHours.value) || 0,
    amountOwed: Number(form.elements.amountOwed.value) || 0,
    status: form.elements.status.value,
    projects: []
  };
  if (databaseConnected) {
    try {
      const savedWorker = await apiRequest('/workers', { method: 'POST', body: JSON.stringify({
        workerNumber: worker.workerNumber, fullName: worker.fullName, phone: worker.phone, address: worker.address,
        skill: worker.skill, position: worker.position, employmentType: worker.employmentType,
        rate: worker.rate, ratePeriod: worker.ratePeriod, dateHired: worker.dateHired,
        emergencyContactName: form.elements.emergencyContactName.value.trim(),
        emergencyContactPhone: form.elements.emergencyContactPhone.value.trim(),
        idDocumentType: form.elements.idDocumentType.value.trim(), idDocumentNumber: form.elements.idDocumentNumber.value.trim(),
        attendanceStatus: worker.attendanceStatus, attendanceNotes: worker.attendanceNotes,
        workHours: worker.workHours, amountOwed: worker.amountOwed, status: worker.status
      }) });
      Object.assign(worker, savedWorker, { id: savedWorker.id, projects: [] });
      if (project?.apiId) {
        await apiRequest('/project-workers', { method: 'POST', body: JSON.stringify({
          projectId: project.apiId, workerId: savedWorker.id,
          position: form.elements.position.value.trim() || worker.position,
          amountPaid: 0, attendanceNotes: worker.attendanceNotes
        }) });
      }
      worker.projects = project?.apiId ? [{ project: { name: project.name }, position: form.elements.position.value.trim() || worker.position }] : [];
      if (project) project.workerAssignments = [...(project.workerAssignments || []), { Position: form.elements.position.value.trim() || worker.position, AmountPaid: 0, Worker: worker }];
      projectWorkers = [...projectWorkers.filter(item => item.workerNumber !== worker.workerNumber), worker];
      window.setWorkerRecords?.([...(window.workerRecords || []).filter(item => item.workerNumber !== worker.workerNumber), worker]);
      document.getElementById('worker-modal-backdrop').hidden = true;
      form.reset();
      if (project) window.appendProjectWorkers?.(project.id);
      setView('workers');
      return;
    } catch (error) {
      window.alert(`The worker could not be saved to the database: ${error.message}`);
      return;
    }
  }
  if (!project) {
    projectWorkers = [...projectWorkers, worker];
    try { persistProjectWorkers(); }
    catch (error) { projectWorkers = projectWorkers.filter(item => item.workerNumber !== workerNumber); window.alert('Worker could not be saved in this browser. Check available storage.'); return; }
    document.getElementById('worker-modal-backdrop').hidden = true;
    form.reset();
    setView('workers');
    return;
  }

  const assignment = {
    Worker: worker,
    Position: form.elements.position.value.trim() || 'Position not recorded',
    AmountPaid: 0,
    AttendanceNotes: worker.attendanceNotes
  };
  const previousAssignments = project.workerAssignments || [];
  const previousWorkers = projectWorkers;
  project.workerAssignments = [...previousAssignments, assignment];
  projectWorkers = projectWorkers.some(item => item.workerNumber === worker.workerNumber)
    ? projectWorkers.map(item => item.workerNumber === worker.workerNumber ? worker : item)
    : [...projectWorkers, worker];

  try {
    persistProjectWorkerAssignments();
    persistProjectWorkers();
  } catch (error) {
    project.workerAssignments = previousAssignments;
    projectWorkers = previousWorkers;
    console.error('Worker assignment could not be saved in this browser.', error);
    window.alert('The worker could not be added to this project. Check available browser storage and try again.');
    return;
  }

  document.getElementById('worker-modal-backdrop').hidden = true;
  form.reset();
  window.appendProjectWorkers?.(project.id);
});

function closeEstimatePdfViewer() {
  const viewer = document.getElementById('estimate-pdf-viewer-backdrop');
  document.getElementById('estimate-pdf-viewer-frame').removeAttribute('src');
  viewer.hidden = true;
  if (activeEstimatePdfUrl) {
    URL.revokeObjectURL(activeEstimatePdfUrl);
    activeEstimatePdfUrl = '';
  }
}

const estimatePdfForm = document.getElementById('estimate-pdf-form');
estimatePdfForm.elements.projectId.addEventListener('change', () => {
  const project = projects.find(item => item.id === estimatePdfForm.elements.projectId.value);
  estimatePdfForm.elements.owner.value = project?.client || '';
  estimatePdfForm.elements.location.value = project?.location || '';
});
estimatePdfForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!estimatePdfForm.reportValidity()) return;
  const project = projects.find(item => item.id === estimatePdfForm.elements.projectId.value);
  const file = estimatePdfForm.elements.file.files[0];
  if (!project || !file) {
    window.alert('Select a project and choose an estimate PDF.');
    return;
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    window.alert('Only PDF files can be uploaded as estimate documents.');
    estimatePdfForm.elements.file.value = '';
    return;
  }
  const documentRecord = {
    id: globalThis.crypto?.randomUUID?.() || `estimate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.id,
    projectName: project.name,
    owner: project.client,
    location: project.location,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    file
  };
  const submitButton = estimatePdfForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    await saveEstimatePdf(documentRecord);
    estimatePdfForm.reset();
    document.getElementById('estimate-pdf-modal-backdrop').hidden = true;
    if (activeView === 'estimates' || activeView === 'documents') setView(activeView);
  } catch (error) {
    console.error('Estimate PDF could not be uploaded.', error);
    window.alert('The estimate PDF could not be saved in this browser. Check available storage and try again.');
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById('project-form').addEventListener('change', event => {
  if (event.target.name !== 'typeChoice') return;
  const customTypeField = document.getElementById('custom-work-type-field');
  const customTypeInput = event.currentTarget.elements.type;
  const needsCustomType = event.target.value === 'Other';
  customTypeField.hidden = !needsCustomType;
  customTypeInput.required = needsCustomType;
  if (needsCustomType) customTypeInput.focus();
});

document.getElementById('project-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const projectType = data.get('typeChoice') === 'Other' ? String(data.get('type') || '').trim() : String(data.get('typeChoice'));
  const nextProjectNumber = projects.reduce((highest, project) => {
    const match = /^PRJ-(\d+)$/.exec(project.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  const project = {
    id: `PRJ-${String(nextProjectNumber).padStart(3, '0')}`,
    name: String(data.get('name')).trim(),
    client: String(data.get('client')).trim(),
    type: projectType,
    location: String(data.get('location')).trim(),
    clientPhone: String(data.get('clientPhone') || '').trim(),
    whatsapp: String(data.get('whatsapp') || '').trim(),
    clientEmail: String(data.get('clientEmail') || '').trim(),
    status: 'Pending payment',
    amount: Number(data.get('amount')),
    paid: 0,
    progress: 0,
    startDate: String(data.get('startDate')),
    expectedCompletionDate: String(data.get('endDate')),
    progressReports: []
  };
  try {
    if (databaseConnected) {
      const clients = await apiRequest('/clients');
      const existingClient = clients.find(item =>
        (project.clientEmail && item.email?.toLowerCase() === project.clientEmail.toLowerCase()) ||
        item.fullName?.trim().toLowerCase() === project.client.toLowerCase()
      );
      const client = existingClient || await apiRequest('/clients', {
        method: 'POST',
        body: JSON.stringify({ fullName: project.client, phoneNumber: project.clientPhone || null, email: project.clientEmail || null, propertyLocation: project.location })
      });
      const savedProject = await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          projectNumber: project.id,
          clientId: client.id,
          name: project.name,
          typeOfWork: project.type,
          location: project.location,
          startDate: project.startDate || null,
          expectedCompletionDate: project.expectedCompletionDate || null,
          status: project.status,
          contractAmount: project.amount
        })
      });
      project.databaseId = savedProject.id;
    } else {
      const savedProjects = projects.filter(item => !builtInProjectIds.has(item.id));
      localStorage.setItem(createdProjectsStorageKey, JSON.stringify([...savedProjects, project]));
    }
  } catch (error) {
    console.error('New project could not be saved.', error);
    window.alert(`The project could not be saved to the database. ${error.message}`);
    return;
  }

  projects.push(project);
  const returnToClient = projectCreationClientName;
  projectCreationClientName = '';
  document.getElementById('modal-backdrop').hidden = true;
  form.reset();
  document.getElementById('custom-work-type-field').hidden = true;
  form.elements.type.required = false;
  if (returnToClient) {
    setView('clients');
    openClientDetail(returnToClient);
  } else {
    setView('projects');
  }
});

document.addEventListener('submit', event => {
  const form = event.target.closest('#business-settings-form');
  if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;

  const updatedSettings = {
    companyName: form.elements.companyName.value.trim(),
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
    address: form.elements.address.value.trim(),
    currency: form.elements.currency.value
  };

  try {
    localStorage.setItem(businessSettingsStorageKey, JSON.stringify(updatedSettings));
  } catch (error) {
    console.error('Business settings could not be saved.', error);
    window.alert('Settings could not be saved in this browser. Check available storage and try again.');
    return;
  }

  businessSettings = updatedSettings;
  applyBusinessSettings();
  setView(activeView);
  document.querySelector('.settings-save-status').textContent = 'Settings saved on this device.';
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('.app-shell.nav-open')) {
    setMobileNavigationOpen(false);
    document.getElementById('mobile-menu').focus();
  }

  const toggle = document.querySelector('[data-activity-menu-toggle][aria-expanded="true"]');
  if (!toggle) return;
  if (event.key === 'Escape') {
    closeActivityMenu();
    toggle.focus();
    return;
  }

  const items = [...document.querySelectorAll('#activity-actions-menu [role="menuitem"]:not(:disabled)')];
  if (!items.length) return;
  const currentIndex = items.indexOf(document.activeElement);
  let nextIndex;
  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
  else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = items.length - 1;
  else return;
  event.preventDefault();
  items[nextIndex].focus();
});

document.addEventListener('DOMContentLoaded', () => {
  initializeAdminLogin();
  applyBusinessSettings();
  setView('overview');
  verifyAdminSession();
});

async function verifyAdminSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
    if (!response.ok) return;
    const admin = await response.json();
    unlockAdminWorkspace(admin.name);
    loadProjectsFromDatabase()
      .then(() => restoreProjectProgressReports())
      .catch(error => console.warn('Database API is unavailable; showing this browser’s saved demo data.', error));
  } catch (error) {
    console.warn('The authentication service is unavailable.', error);
  }
}

function initializeAdminLogin() {
  const screen = document.getElementById('admin-login-screen');
  const form = document.getElementById('admin-login-form');
  const error = document.getElementById('admin-login-error');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const submit = document.getElementById('admin-login-submit');
  document.getElementById('admin-login-note').textContent = 'Sign in with your administrator account.';
  screen.hidden = false;
  document.querySelector('.app-shell')?.classList.remove('authenticated');
  emailInput.focus();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    submit.disabled = true;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (response.status === 401) throw new Error('Email or password is incorrect.');
      if (!response.ok) throw new Error('Sign in failed. Check the API connection and try again.');
      const admin = await response.json();
      unlockAdminWorkspace(admin.name);
    } catch (loginError) {
      showError(loginError.message || 'Administrator sign in could not be completed.');
      passwordInput.value = '';
    } finally {
      submit.disabled = false;
    }
  });

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
}

function unlockAdminWorkspace(adminName) {
  document.getElementById('admin-login-screen').hidden = true;
  document.querySelector('.app-shell')?.classList.add('authenticated');
  const profileName = document.getElementById('profile-name');
  if (profileName && adminName) profileName.textContent = adminName;
  const initials = (adminName || 'Administrator').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const profileAvatar = document.getElementById('profile-avatar');
  if (profileAvatar) profileAvatar.textContent = initials;
}

function lockAdminWorkspace() {
  document.getElementById('admin-login-screen').hidden = false;
  document.querySelector('.app-shell')?.classList.remove('authenticated');
  const error = document.getElementById('admin-login-error');
  if (error) {
    error.textContent = 'Your session expired. Sign in again to continue.';
    error.hidden = false;
  }
}
