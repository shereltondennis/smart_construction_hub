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
const projectWorkerAssignmentsStorageKey = 'smart-construction-hub-project-worker-assignments';
const projectWorkersStorageKey = 'smart-construction-hub-project-workers';
const estimatePdfDatabaseName = 'smart-construction-hub-documents';
const estimatePdfStoreName = 'estimate-pdfs';
let activeEstimatePdfUrl = '';
let projectWorkers = [];
const builtInProjectIds = new Set(projects.map(project => project.id));

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
const progressStorageKey = 'smart-construction-hub-progress-reports';
const activityReadStorageKey = 'smart-construction-hub-activity-read';
const businessSettingsStorageKey = 'smart-construction-hub-business-settings';
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
      project.progressReports = [...(project.progressReports || []), ...savedReports[project.id]];
      project.progress = Math.max(Number(project.progress) || 0, ...project.progressReports.map(report => Number(report.percent) || 0));
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
  content.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">THURSDAY, SEPTEMBER 11, 2026</div>
        <h1>Good morning, Alex.</h1>
        <p>Here is the pulse of your construction business today.</p>
      </div>
      <button class="button button-primary" data-view-link="projects">＋ View projects <span>→</span></button>
    </div>
    <div class="dashboard-grid">
      <div class="metric"><div class="metric-label">Active projects <span class="metric-icon">▱</span></div><strong>${projects.filter(project => project.status !== 'Complete').length}</strong><div class="metric-foot">Projects in progress</div></div>
      <div class="metric metric-orange"><div class="metric-label">Total outstanding <span class="metric-icon">◒</span></div><strong>$18,450</strong><div class="metric-foot"><span class="positive">↓ 8.4%</span> from last month</div></div>
      <div class="metric metric-yellow"><div class="metric-label">Payments this month <span class="metric-icon">↗</span></div><strong>$9,250</strong><div class="metric-foot"><span class="positive">↑ 12.6%</span> from last month</div></div>
      <div class="metric"><div class="metric-label">Inventory items <span class="metric-icon">▤</span></div><strong>143</strong><div class="metric-foot">8 items need restocking</div></div>
    </div>
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
  const locations = [...new Set(clientProjects.map(project => project.location).filter(Boolean))];
  const initials = clientName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const phone = client.clientPhone || client.whatsapp || '';
  const whatsappNumber = (client.whatsapp || client.clientPhone || '').replace(/\D/g, '');
  const totalValue = clientProjects.reduce((sum, project) => sum + (Number(project.amount) || 0), 0);
  const outstanding = clientProjects.reduce((sum, project) => sum + Math.max(0, (Number(project.amount) || 0) - (Number(project.paid) || 0)), 0);
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
          ${phone ? `<a class="button button-ghost" href="tel:${escapeReportHtml(phone.replace(/[^\d+]/g, ''))}">Call client</a>` : ''}
          ${whatsappNumber ? `<a class="button button-primary" target="_blank" rel="noopener" href="https://wa.me/${escapeReportHtml(whatsappNumber)}">WhatsApp</a>` : ''}
        </div>
      </section>
      <section class="panel client-projects-panel">
        <div class="panel-header"><div><h2>Projects for ${escapeReportHtml(clientName)}</h2><p>${clientProjects.length} linked ${clientProjects.length === 1 ? 'project' : 'projects'}</p></div><button class="button button-primary" type="button" data-client-add-project="${escapeReportHtml(clientName)}">＋ Add new project</button></div>
        <div class="client-summary-metrics"><div><span>Total contract value</span><strong>${money(totalValue)}</strong></div><div><span>Outstanding balance</span><strong>${money(outstanding)}</strong></div><div><span>Active projects</span><strong>${clientProjects.filter(project => project.status !== 'Complete').length}</strong></div></div>
        <div class="client-project-list">${projectRows}</div>
      </section>
    </div>
  `;
}

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
  project.progress = Number(project.progress) || getProjectReports(project).reduce((max, report) => Math.max(max, report.percent), 0);
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
    <div class="dashboard-grid"><div class="metric"><div class="metric-label">Contract value</div><strong>${money(project.amount)}</strong><div class="metric-foot">Approved contract</div></div><div class="metric metric-orange"><div class="metric-label">Balance due</div><strong>${money(project.amount - project.paid)}</strong><div class="metric-foot">${paidPercent}% of contract paid</div></div><div class="metric"><button class="metric-progress-trigger" type="button" aria-expanded="false" aria-controls="project-progress-stack"><span class="metric-label">Construction progress</span><strong data-project-progress>${project.progress}%</strong><span class="metric-foot">Click to view progress reports</span></button></div><div class="metric metric-yellow"><div class="metric-label">Connected files</div><strong>18</strong><div class="metric-foot">Plans, receipts & photos</div></div></div>
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
    reportProject.progress = Number(reportProject.progress) || getProjectReports(reportProject).reduce((max, report) => Math.max(max, report.percent), 0);
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
          <div><div class="eyebrow">CASH FLOW</div><h1>Payments</h1><p>Track every payment against the right project and keep a receipt for the client.</p></div>
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

document.addEventListener('click', event => {
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
  const workers = projectWorkers;
  content.innerHTML = `
    <div class="view-title">
      <div><div class="eyebrow">FIELD OPERATIONS</div><h1>Workers</h1><p>Review workers and the projects they are assigned to.</p></div>
    </div>
    ${workers.length ? `
      <section class="panel view-table-panel">
        <div class="panel-header"><div><h2>Assigned workers</h2><p>Workers added to projects in this workspace.</p></div><strong>${workers.length}</strong></div>
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
              <td><span class="status ${worker.status === 'Inactive' ? 'status-review' : 'status-progress'}">${escapeReportHtml(worker.status || 'Active')}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </section>
    ` : '<section class="panel empty-state"><div class="activity-icon" style="margin:0 auto 13px">◉</div><strong>No workers assigned yet.</strong><p>Open a project and select “Add worker” to assign someone. Assigned workers will be listed here.</p></section>'}
  `;
}

document.getElementById('worker-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const project = projects.find(item => item.id === form.elements.projectId.value);
  if (!project) {
    window.alert('Select a valid project for this worker.');
    return;
  }

  const workerNumber = form.elements.workerNumber.value.trim();
  if (projects.some(item => (item.workerAssignments || []).some(assignment =>
    (assignment.Worker?.workerNumber || assignment.worker?.workerNumber) === workerNumber
  ))) {
    window.alert('A worker with this ID is already assigned to a project.');
    form.elements.workerNumber.focus();
    return;
  }

  const worker = {
    workerNumber,
    fullName: form.elements.fullName.value.trim(),
    phone: form.elements.phone.value.trim(),
    address: form.elements.address.value.trim(),
    skill: form.elements.skill.value.trim(),
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
    projects: [{ project: { name: project.name }, position: form.elements.position.value.trim() || 'Position not recorded' }]
  };
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

document.getElementById('project-form').addEventListener('submit', event => {
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
  const savedProjects = projects.filter(item => !builtInProjectIds.has(item.id));

  try {
    localStorage.setItem(createdProjectsStorageKey, JSON.stringify([...savedProjects, project]));
  } catch (error) {
    console.error('New project could not be saved in this browser.', error);
    window.alert('The project could not be saved in this browser. Check available storage and try again.');
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
  applyBusinessSettings();
  setView('overview');
});
