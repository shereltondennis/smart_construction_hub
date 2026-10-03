let projects = [
  {
    id: 'PRJ-024',
    name: 'Willow Creek Residence',
    client: 'John Doe',
    type: 'New construction',
    location: 'East Legon, Accra',
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
    location: 'Cantonments, Accra',
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
    location: 'Adenta, Accra',
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
    location: 'Labone, Accra',
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

let activeView = 'overview';
const content = document.getElementById('app-content');
const progressStorageKey = 'smart-construction-hub-progress-reports';
const activityReadStorageKey = 'smart-construction-hub-activity-read';
let allActivityRead = false;

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

function money(value) {
  const amount = Number(value) || 0;
  return '$' + amount.toLocaleString('en-US');
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
    if (report.completedWork) lines.push(`Work completed: ${report.completedWork}`);
    if (report.activities?.length) {
      lines.push('Work quantities:');
      report.activities.forEach(activity => lines.push(`- ${activity.activity}${activity.location ? `, ${activity.location}` : ''}: ${activity.completedQty || 0}${activity.unit ? ` ${activity.unit}` : ''} of ${activity.plannedQty || 0}${activity.unit ? ` ${activity.unit}` : ''} (${activity.percentComplete || 0}%)`));
    }
    if (report.materials?.length) {
      lines.push('Materials used:');
      report.materials.forEach(material => lines.push(`- ${material.material}: ${material.used || 0} used, ${material.balance || 0} balance`));
    }
    if (report.expenses?.length) {
      lines.push(`Expenses: ${report.expenses.map(expense => `${expense.description} ${money(Number(expense.amount) || 0)}`).join('; ')}`);
    }
    if (report.issues?.length) lines.push(`Site issues/delays: ${report.issues.join(', ')}`);
    if (report.issueDetails) lines.push(`Issue details: ${report.issueDetails}`);
    if (report.beforeWork) lines.push(`Before work: ${report.beforeWork}`);
    if (report.inProgressWork) lines.push(`Work in progress: ${report.inProgressWork}`);
    if (report.completedWorkItems) lines.push(`Completed work: ${report.completedWorkItems}`);
    if (report.defects) lines.push(`Problems/defects: ${report.defects}`);
    if (report.tomorrowPlan) lines.push(`Tomorrow's plan: ${report.tomorrowPlan}`);
    if (report.photos?.length) lines.push(`Photos: ${report.photos.map(photo => photo.caption || photo.name).join('; ')}`);
    if (report.approvals) lines.push(`Prepared by ${report.approvals.preparedBy || '—'} · Checked by ${report.approvals.checkedBy || '—'} · Approved by ${report.approvals.approvedBy || '—'}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}

async function shareProjectProgressWithClient(projectId, overrideReport = null) {
  const project = projects.find(item => item.id === projectId);
  if (!project) return;

  const shareText = buildProjectProgressShareText(project, overrideReport);

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
    if (copied === null) return;
  }

  const subject = encodeURIComponent(`Project progress update - ${project.name}`);
  const body = encodeURIComponent(shareText);
  const mailto = `mailto:${project.clientEmail || ''}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
  window.alert('Progress report copied and ready to share with the client.');
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
      <div class="metric"><div class="metric-label">Active projects <span class="metric-icon">▱</span></div><strong>12</strong><div class="metric-foot"><span class="positive">↑ 2</span> from last month</div></div>
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
    </div>
    <section class="panel view-table-panel">
      <table class="project-table full-table"><thead><tr><th>Project</th><th>Type & location</th><th>Status</th><th>Contract value</th><th>Progress</th></tr></thead><tbody>${renderProjectRows(projects)}</tbody></table>
    </section>
  `;
}

const workforceTrades = ['Carpenters', 'Masons', 'Electricians', 'Plumbers', 'Roofers', 'General laborers', 'Supervisor'];
const defaultActivities = ['Foundation block work', 'Column construction', 'Roofing', 'Plastering'];
const defaultMaterials = ['Cement', 'Sand', 'Blocks', '2×4 lumber', 'Roofing sheets', 'Nails'];
const siteIssueOptions = ['Material shortages', 'Weather delays', 'Equipment problems', 'Design changes', 'Client instructions'];

function localDateString(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function workActivityRow(activity = '') {
  return `<tr data-work-activity-row><td><input name="activity" value="${activity}" aria-label="Work activity" /></td><td><input name="activityLocation" value="Building A" aria-label="Work location" /></td><td><input name="plannedQty" type="number" min="0" step="0.01" placeholder="0" aria-label="Planned quantity" /></td><td><input name="completedQty" type="number" min="0" step="0.01" placeholder="0" aria-label="Completed quantity" /></td><td><input name="activityUnit" placeholder="e.g. ft², pcs" aria-label="Unit" /></td><td><output data-percent-complete>0%</output></td><td><button class="dpr-remove-row" type="button" aria-label="Remove activity">×</button></td></tr>`;
}

function materialRow(material) {
  return `<tr data-material-row><td><input name="material" value="${material}" aria-label="Material" /></td><td><input name="openingQty" type="number" min="0" step="0.01" value="0" aria-label="Opening quantity" /></td><td><input name="receivedQty" type="number" min="0" step="0.01" value="0" aria-label="Quantity received" /></td><td><input name="usedQty" type="number" min="0" step="0.01" value="0" aria-label="Quantity used" /></td><td><output data-material-balance>0</output></td></tr>`;
}

function expenseRow() {
  return '<tr data-expense-row><td><input name="expenseDescription" placeholder="Transport, equipment..." aria-label="Expense description" /></td><td><input name="expenseAmount" type="number" min="0" step="0.01" value="0" aria-label="Expense amount" /></td><td><button class="dpr-remove-row" type="button" aria-label="Remove expense">×</button></td></tr>';
}

function renderSavedReports(project) {
  const reports = getProjectReports(project);
  if (!reports.length) return '<div class="empty-state">No daily progress reports recorded yet.</div>';
  return reports.slice().reverse().map(report => `
    <article class="dpr-history-item">
      <div class="dpr-history-heading"><div><strong>${report.reportNo || 'Daily report'}</strong><span>${new Date(`${report.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div><span class="progress-badge">${report.percent}%</span></div>
      <p>${report.completedWork || report.summary || 'Daily work update recorded.'}</p>
      <div class="dpr-history-meta">${report.totalWorkers || 0} workers · ${report.activities?.length || 0} work activities · ${report.photos?.length || 0} photos${report.expenses?.length ? ` · ${money(report.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))} expenses` : ''}</div>
      ${report.photos?.length ? `<div class="dpr-history-photos">${report.photos.map(photo => photo.dataUrl ? `<figure><img src="${photo.dataUrl}" alt="${photo.caption || photo.name}"><figcaption>${photo.caption || photo.name}</figcaption></figure>` : `<span>${photo.caption || photo.name}</span>`).join('')}</div>` : ''}
    </article>
  `).join('');
}

function openProject(id) {
  const project = projects.find(item => item.id === id);
  if (!project) return;
  project.progressReports = Array.isArray(project.progressReports) ? project.progressReports : [];
  project.progress = Number(project.progress) || getProjectReports(project).reduce((max, report) => Math.max(max, report.percent), 0);
  const reportNumber = `DPR-${project.id}-${String(getProjectReports(project).filter(report => report.reportNo).length + 1).padStart(3, '0')}`;
  const paidPercent = Math.round((project.paid / project.amount) * 100) || 0;

  content.innerHTML = `
    <div class="view-title"><div><div class="eyebrow">${project.id} · ${project.type.toUpperCase()}</div><h1>${project.name}</h1><p>${project.location} · Client: ${project.client}</p></div><button class="button button-ghost" data-view-link="projects">← Back to projects</button></div>
    <div class="dashboard-grid"><div class="metric"><div class="metric-label">Contract value</div><strong>${money(project.amount)}</strong><div class="metric-foot">Approved contract</div></div><div class="metric metric-orange"><div class="metric-label">Balance due</div><strong>${money(project.amount - project.paid)}</strong><div class="metric-foot">${paidPercent}% of contract paid</div></div><div class="metric"><div class="metric-label">Construction progress</div><strong data-project-progress>${project.progress}%</strong><div class="metric-foot">Last updated today</div></div><div class="metric metric-yellow"><div class="metric-label">Connected files</div><strong>18</strong><div class="metric-foot">Plans, receipts & photos</div></div></div>
    <div class="project-progress-stack"><section class="panel dpr-panel">
      <div class="panel-header"><div><div class="eyebrow">FIELD REPORTING</div><h2>Daily Progress Report</h2><p>Project-linked daily record · ${reportNumber}</p></div><span class="status ${statusClass(project.status)}" data-dpr-progress>${project.progress}%</span></div>
      <form id="daily-progress-form" class="project-progress-form dpr-form" data-project-id="${project.id}">
        <input type="hidden" name="reportNo" value="${reportNumber}">
        <section class="dpr-section"><div class="dpr-section-heading"><span>01</span><div><h3>Project information</h3><p>Linked to this project automatically.</p></div></div>
          <div class="dpr-fields dpr-project-fields"><label>Company<input value="Smart Construction Hub" readonly></label><label>Project name<input value="${project.name}" readonly></label><label>Client name<input value="${project.client}" readonly></label><label>Project location<input value="${project.location}" readonly></label><label>Project manager / site supervisor<input name="supervisor" placeholder="Name" /></label><label>Report number<input value="${reportNumber}" readonly></label><label>Date<input name="reportDate" type="date" required></label><label>Weather conditions<select name="weather"><option value="">Select weather</option><option>Clear</option><option>Partly cloudy</option><option>Overcast</option><option>Rain</option><option>Windy</option><option>Hot</option></select></label><label>Working hours<input name="workingHours" type="number" min="0" max="24" step="0.25" placeholder="e.g. 8" /></label><label>Overall project completion (%)<input name="reportPercent" type="number" min="0" max="100" step="1" value="${project.progress}" required></label></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>02</span><div><h3>Workforce</h3><p>Record today's attendance by trade.</p></div><strong class="dpr-section-total">Total <output data-worker-total>0</output></strong></div>
          <div class="dpr-table-scroll"><table class="dpr-table dpr-workforce-table"><thead><tr><th>Worker / trade</th><th>Number</th></tr></thead><tbody>${workforceTrades.map(trade => `<tr><td>${trade}</td><td><input data-workforce-trade="${trade}" type="number" min="0" step="1" value="0" aria-label="${trade} count"></td></tr>`).join('')}<tr class="dpr-total-row"><th>Total workers</th><td><output data-worker-total-row>0</output></td></tr></tbody></table></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>03</span><div><h3>Work completed today</h3><p>Quantities and completion rates for today's activities.</p></div><button class="text-button" type="button" data-add-activity>＋ Add activity</button></div>
          <label class="dpr-full-field">Daily work summary<textarea name="completedWork" rows="3" required placeholder="What was completed on site today?"></textarea></label>
          <div class="dpr-table-scroll"><table class="dpr-table dpr-activity-table"><thead><tr><th>Work activity</th><th>Location</th><th>Planned qty</th><th>Completed qty</th><th>Unit</th><th>% complete</th><th></th></tr></thead><tbody data-activity-rows>${defaultActivities.map(workActivityRow).join('')}</tbody></table></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>04</span><div><h3>Materials used</h3><p>Balances calculate from opening stock, receipts, and usage.</p></div></div>
          <div class="dpr-table-scroll"><table class="dpr-table dpr-material-table"><thead><tr><th>Material</th><th>Opening qty</th><th>Received</th><th>Used</th><th>Balance</th></tr></thead><tbody data-material-rows>${defaultMaterials.map(materialRow).join('')}</tbody></table></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>05</span><div><h3>Site issues / delays</h3><p>Select anything that affected today's work.</p></div></div>
          <div class="dpr-issue-list">${siteIssueOptions.map(issue => `<label><input type="checkbox" name="siteIssue" value="${issue}"><span>${issue}</span></label>`).join('')}</div>
          <label class="dpr-full-field">Issue details<textarea name="issueDetails" rows="2" placeholder="Describe the impact, owner, or action required."></textarea></label>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>06</span><div><h3>Site work status</h3><p>Capture the handoff state and any quality concerns.</p></div></div>
          <div class="dpr-fields"><label>Before work<textarea name="beforeWork" rows="2" placeholder="Site condition before today's work."></textarea></label><label>Work in progress<textarea name="inProgressWork" rows="2" placeholder="Activities underway at end of shift."></textarea></label><label>Completed work<textarea name="completedWorkItems" rows="2" placeholder="Milestones completed today."></textarea></label><label>Important problem / defect<textarea name="defects" rows="2" placeholder="Defect, safety issue, or follow-up required."></textarea></label></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>07</span><div><h3>Expenses</h3><p>Daily expenses recorded against this project.</p></div><button class="text-button" type="button" data-add-expense>＋ Add expense</button></div>
          <div class="dpr-table-scroll"><table class="dpr-table dpr-expense-table"><thead><tr><th>Expense</th><th>Amount</th><th></th></tr></thead><tbody data-expense-rows>${expenseRow()}</tbody><tfoot><tr><th>Total expenses</th><td colspan="2"><output data-expense-total>${money(0)}</output></td></tr></tfoot></table></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>08</span><div><h3>Site photos</h3><p>Add progress photos and a caption for each image.</p></div></div>
          <label class="dpr-photo-picker">＋ Add site photos<input name="photos" type="file" accept="image/*" multiple></label><div class="dpr-photo-previews" data-photo-previews></div>
        </section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>09</span><div><h3>Tomorrow's planned work</h3><p>Set the next shift's priorities.</p></div></div><label class="dpr-full-field"><textarea name="tomorrowPlan" rows="3" placeholder="For example: Continue block laying at Building A; complete remaining columns; prepare roof trusses."></textarea></label></section>
        <section class="dpr-section"><div class="dpr-section-heading"><span>10</span><div><h3>Approval</h3><p>Typed names and dates are recorded with this report.</p></div></div><div class="dpr-approval-grid"><label>Prepared by · Site supervisor<input name="preparedBy" placeholder="Name / signature" /></label><label>Prepared date<input name="preparedDate" type="date" /></label><label>Checked by · Project manager<input name="checkedBy" placeholder="Name / signature" /></label><label>Checked date<input name="checkedDate" type="date" /></label><label>Approved by · Client / representative<input name="approvedBy" placeholder="Name / signature" /></label><label>Approval date<input name="approvedDate" type="date" /></label></div></section>
        <div class="dpr-form-footer"><span>Project completion updates when this report is saved.</span><div class="project-progress-actions"><button class="button button-primary" type="submit">Save report <span>→</span></button><button class="button button-ghost project-share-progress" type="button">Save &amp; share with client</button></div></div>
      </form>
      <section class="dpr-history"><div class="panel-header"><div><h2>Report history</h2><p>Daily records saved for this project.</p></div><strong>${getProjectReports(project).length}</strong></div><div class="dpr-history-list">${renderSavedReports(project)}</div></section>
    </section></div>
  `;

  const form = document.getElementById('daily-progress-form');
  form.elements.reportDate.value = localDateString();
  form.elements.preparedDate.value = localDateString();
  let photoFiles = [];

  const updateDerivedValues = () => {
    const workerTotal = [...form.querySelectorAll('[data-workforce-trade]')].reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    form.querySelector('[data-worker-total]').textContent = workerTotal;
    form.querySelector('[data-worker-total-row]').textContent = workerTotal;
    form.querySelectorAll('[data-work-activity-row]').forEach(row => {
      const planned = Number(row.querySelector('[name="plannedQty"]').value) || 0;
      const completed = Number(row.querySelector('[name="completedQty"]').value) || 0;
      row.querySelector('[data-percent-complete]').textContent = `${planned > 0 ? Math.min(100, Math.round(completed / planned * 100)) : 0}%`;
    });
    form.querySelectorAll('[data-material-row]').forEach(row => {
      const opening = Number(row.querySelector('[name="openingQty"]').value) || 0;
      const received = Number(row.querySelector('[name="receivedQty"]').value) || 0;
      const used = Number(row.querySelector('[name="usedQty"]').value) || 0;
      row.querySelector('[data-material-balance]').textContent = (opening + received - used).toLocaleString('en-US');
    });
    const expenses = [...form.querySelectorAll('[name="expenseAmount"]')].reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    form.querySelector('[data-expense-total]').textContent = money(expenses);
  };

  form.addEventListener('input', updateDerivedValues);
  form.addEventListener('change', updateDerivedValues);
  form.addEventListener('submit', event => {
    event.preventDefault();
    saveProgressReport(form, project, photoFiles, false);
  });
  form.querySelector('.project-share-progress').addEventListener('click', () => saveProgressReport(form, project, photoFiles, true));
  form.querySelector('[data-add-activity]').addEventListener('click', () => {
    form.querySelector('[data-activity-rows]').insertAdjacentHTML('beforeend', workActivityRow());
  });
  form.querySelector('[data-add-expense]').addEventListener('click', () => {
    form.querySelector('[data-expense-rows]').insertAdjacentHTML('beforeend', expenseRow());
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
    const plannedQty = Number(row.querySelector('[name="plannedQty"]').value) || 0;
    const completedQty = Number(row.querySelector('[name="completedQty"]').value) || 0;
    return {
      activity: row.querySelector('[name="activity"]').value.trim(),
      location: row.querySelector('[name="activityLocation"]').value.trim(),
      plannedQty,
      completedQty,
      unit: row.querySelector('[name="activityUnit"]').value.trim(),
      percentComplete: plannedQty > 0 ? Math.min(100, Math.round(completedQty / plannedQty * 100)) : 0
    };
  }).filter(activity => activity.activity);
  const materials = [...form.querySelectorAll('[data-material-row]')].map(row => ({
    material: row.querySelector('[name="material"]').value.trim(),
    openingQty: Number(row.querySelector('[name="openingQty"]').value) || 0,
    received: Number(row.querySelector('[name="receivedQty"]').value) || 0,
    used: Number(row.querySelector('[name="usedQty"]').value) || 0,
    balance: (Number(row.querySelector('[name="openingQty"]').value) || 0) + (Number(row.querySelector('[name="receivedQty"]').value) || 0) - (Number(row.querySelector('[name="usedQty"]').value) || 0)
  })).filter(material => material.material);
  const workforce = Object.fromEntries([...form.querySelectorAll('[data-workforce-trade]')].map(input => [input.dataset.workforceTrade, Number(input.value) || 0]));
  const expenses = [...form.querySelectorAll('[data-expense-row]')].map(row => ({
    description: row.querySelector('[name="expenseDescription"]').value.trim(),
    amount: Number(row.querySelector('[name="expenseAmount"]').value) || 0
  })).filter(expense => expense.description || expense.amount > 0);
  const photosWithCaptions = photos.map((photo, index) => ({
    file: photo.file,
    name: photo.file.name,
    caption: form.querySelector(`[data-photo-caption="${index}"]`)?.value.trim() || ''
  }));
  const totalWorkers = Object.values(workforce).reduce((sum, count) => sum + count, 0);

  return {
    reportNo: value('reportNo'),
    date: value('reportDate'),
    percent: Math.min(100, Math.max(0, Number(value('reportPercent')))),
    summary: value('completedWork'),
    completedWork: value('completedWork'),
    company: 'Smart Construction Hub',
    projectId: project.id,
    projectName: project.name,
    client: project.client,
    location: project.location,
    supervisor: value('supervisor'),
    weather: value('weather'),
    workingHours: value('workingHours'),
    workforce,
    totalWorkers,
    activities,
    materials,
    issues: [...form.querySelectorAll('[name="siteIssue"]:checked')].map(input => input.value),
    issueDetails: value('issueDetails'),
    beforeWork: value('beforeWork'),
    inProgressWork: value('inProgressWork'),
    completedWorkItems: value('completedWorkItems'),
    defects: value('defects'),
    expenses,
    tomorrowPlan: value('tomorrowPlan'),
    photos: photosWithCaptions,
    approvals: {
      preparedBy: value('preparedBy'),
      preparedDate: value('preparedDate'),
      checkedBy: value('checkedBy'),
      checkedDate: value('checkedDate'),
      approvedBy: value('approvedBy'),
      approvedDate: value('approvedDate')
    }
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

async function saveProgressReport(form, project, photos, shouldShare) {
  if (!form.reportValidity()) return;
  const report = collectProgressReport(form, project, photos);
  if (!report.completedWork) {
    window.alert('Add a summary of work completed today before saving the report.');
    form.elements.completedWork.focus();
    return;
  }

  try {
    report.photos = await Promise.all(report.photos.map(photo => resizeProgressPhoto(photo.file, photo.caption)));
  } catch (error) {
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

  openProject(project.id);
  if (shouldShare) await shareProjectProgressWithClient(project.id, report);
}

function setView(view) {
  activeView = view;
  document.querySelectorAll('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  document.getElementById('breadcrumb-title').textContent = view === 'overview' ? 'SCH Dashboard' : view.charAt(0).toUpperCase() + view.slice(1);

  const views = {
    overview,
    activity: activityView,
    projects: projectsView,
    clients: () => {
      content.innerHTML = '<div class="view-title"><div><div class="eyebrow">RELATIONSHIPS</div><h1>Clients</h1><p>View clients and every project connected to them.</p></div></div><div class="cards-grid"><article class="client-card"><div class="avatar avatar-dark">JD</div><h3>John Doe</h3><p>East Legon, Accra</p><p>john.doe@example.com</p><div class="client-project"><strong>2 projects</strong><span>· $36,500 contract value</span></div></article><article class="client-card"><div class="avatar avatar-dark">AM</div><h3>Amara Mensah</h3><p>Cantonments, Accra</p><p>amara.mensah@example.com</p><div class="client-project"><strong>1 project</strong><span>· $12,600 contract value</span></div></article><article class="client-card"><div class="avatar avatar-dark">DK</div><h3>David Kimani</h3><p>Adenta, Accra</p><p>david.kimani@example.com</p><div class="client-project"><strong>1 project</strong><span>· $8,400 contract value</span></div></article><article class="client-card"><div class="avatar avatar-dark">SO</div><h3>Sarah Owusu</h3><p>Labone, Accra</p><p>sarah.owusu@example.com</p><div class="client-project"><strong>1 project</strong><span>· $18,900 contract value</span></div></article></div>';
    },
    estimates: () => {
      content.innerHTML = '<div class="view-title"><div><div class="eyebrow">COST CONTROL</div><h1>Estimates</h1><p>Build accurate material estimates and keep approvals moving.</p></div></div><section class="panel view-table-panel"><table class="project-table full-table"><thead><tr><th>Estimate</th><th>Project & client</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody><tr><td><strong class="project-name">EST-018</strong></td><td><strong class="project-name">Willow Creek Residence</strong><span class="project-client">John Doe</span></td><td>Sep 08, 2026</td><td class="project-amount">$25,000</td><td><span class="status status-review">Pending approval</span></td></tr></tbody></table></section>';
    },
    workers: () => {
      content.innerHTML = '<div class="view-title"><div><div class="eyebrow">FIELD OPERATIONS</div><h1>Workers</h1><p>Keep worker contacts, skills, amounts, and payment conditions ready for project planning.</p></div></div><section class="panel empty-state"><div class="activity-icon" style="margin:0 auto 13px">◉</div><strong>No workers recorded yet.</strong><p>Connect this workspace area to your project records as your operations grow.</p></section>';
    },
    payments: () => {
      content.innerHTML = '<div class="view-title"><div><div class="eyebrow">CASH FLOW</div><h1>Payments</h1><p>Track every payment against the right project and keep a receipt for the client.</p></div></div><section class="panel empty-state"><div class="activity-icon" style="margin:0 auto 13px">↗</div><strong>No payments recorded yet.</strong><p>Keep payment records here once your project invoices land.</p></section>';
    },
    documents: () => {
      content.innerHTML = '<div class="view-title"><div><div class="eyebrow">PROJECT RECORDS</div><h1>Documents</h1><p>Contracts, plans, permits and receipts in one place.</p></div></div><section class="panel empty-state"><div class="activity-icon" style="margin:0 auto 13px">□</div><strong>Document library ready.</strong><p>Connect this workspace area to your project records as your operations grow.</p></section>';
    }
  };

  (views[view] || views.overview)();
}

document.addEventListener('click', event => {
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

  const projectRow = event.target.closest('tr[data-project]');
  if (projectRow) {
    openProject(projectRow.dataset.project);
  }
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
  setView('overview');
});
