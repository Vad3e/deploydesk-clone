// ============================================================
// GLOBAL STATE & ROUTING
// ============================================================
let currentRole = 'member';
let currentSub = 'home';

// Calendar global variables
window.currentMonth = new Date().getMonth();
window.currentYear = new Date().getFullYear();
window.cachedEvents = [];
window.mySchedule = {};

// Dashboard UI global variables
window.UPCOMING_EVENTS = [];
window.APPROVED_REQUESTS = [];
window.MEMBER_WORKLOAD = { role: "MEMBER", current: 0, max: 10, tasks: [] };

function goTo(page) {
  const routes = {
    'landing': 'index.html',
    'login': 'login.html',
    'signup': 'signup.html',
    'profile': 'profile.html',
    'dashboard': 'dashboard.html',
    'requester-dashboard': 'requester-dashboard.html'
  };
  window.location.href = routes[page] || 'index.html';
}

// ⚡ BULLETPROOF FALLBACKS
window.groupRoles = { 
    'IMAGE': ['Photographer', 'Videographer', 'Writer', 'Designer', 'Web Developer'], 
    'Cognizant': ['Writer', 'Broadcaster', 'Photojournalist', 'Layout Artist', 'Video Journalist', 'Cartoonist', 'Technical Support', 'Social Media Manager', 'Copy Reader'] 
};
window.schedRules = { leadDays: 3, startTime: '07:00', endTime: '17:00', monthlyLimit: 50 };
window.algoRules = { maxWorkload: 5, priority: 'Balance Workloads First (Default)' };
window.sysFlags = { emails: 'Enabled (Active)' };

async function fetchGlobalSettings() {
    try {
        const res = await fetch(`https://backend-88na.onrender.com/api/settings?_nocache=${Date.now()}`);
        const data = await res.json();
        
        if (data.success && data.settings) {
            if (data.settings.groupRoles && Object.keys(data.settings.groupRoles).length > 0) {
                window.groupRoles = data.settings.groupRoles;
            }
            if (data.settings.schedRules) window.schedRules = data.settings.schedRules;
            if (data.settings.algoRules) window.algoRules = data.settings.algoRules;
            if (data.settings.sysFlags) window.sysFlags = data.settings.sysFlags;
            
            if (document.getElementById('setRolesImage')) {
                document.getElementById('setRolesImage').value = window.groupRoles['IMAGE'] ? window.groupRoles['IMAGE'].join(', ') : '';
                document.getElementById('setRolesCognizant').value = window.groupRoles['Cognizant'] ? window.groupRoles['Cognizant'].join(', ') : '';
                document.getElementById('setSchedLimit').value = window.schedRules.monthlyLimit || 50;
                document.getElementById('setSchedLead').value = window.schedRules.leadDays || 3;
                document.getElementById('setSchedStart').value = window.schedRules.startTime || '07:00';
                document.getElementById('setSchedEnd').value = window.schedRules.endTime || '17:00';
                document.getElementById('setRuleMaxWorkload').value = window.algoRules.maxWorkload || 5;
                document.getElementById('setRulePriority').value = window.algoRules.priority || 'Balance Workloads First (Default)';
                document.getElementById('setRuleEmails').value = window.sysFlags.emails || 'Enabled (Active)';
            }
        }
    } catch(e) { console.log('⚠️ Database sleeping. Using safety defaults for UI.'); }
}

function isEventForMyOrg(ev, myOrg) {
    if (!myOrg) return true; 
    try {
        if (!ev.personnel_reqs) return true; 
        const reqs = JSON.parse(ev.personnel_reqs);
        if (reqs.length === 0) return true;
        return reqs.some(r => r.group === myOrg);
    } catch(e) { return true; } 
}

/* ============================================================
   AUTH & PASSWORD RESET
============================================================ */
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errBanner = document.getElementById('loginErr');

  if(errBanner) errBanner.style.display = 'none';

  if(!email || !pass) { 
    if(errBanner) { errBanner.textContent = 'Please enter both email and password.'; errBanner.style.display = 'block'; }
    else showToast('Please enter both email and password.', 'error');
    return; 
  }
  
  try {
    const response = await fetch('https://backend-88na.onrender.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await response.json();

    if (data.success) {
      sessionStorage.setItem('dd_currentUser', JSON.stringify(data.user));
      if (data.user.role === 'admin') window.location.href = 'admin-dashboard.html';
      else if (data.user.role === 'requester') window.location.href = 'requester-dashboard.html';
      else window.location.href = 'dashboard.html';
    } else {
      if(errBanner) { errBanner.textContent = data.message; errBanner.style.display = 'block'; } 
      else showToast(data.message, 'error');
    }
  } catch (error) {
    if(errBanner) { errBanner.textContent = 'Server waking up... please try again in 30s.'; errBanner.style.display = 'block'; } 
  }
}

async function doSignup() {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const contact = document.getElementById('suContact') ? document.getElementById('suContact').value.trim() : '';
  const pass = document.getElementById('suPass') ? document.getElementById('suPass').value : '';
  const passConfirm = document.getElementById('suPassConfirm') ? document.getElementById('suPassConfirm').value : '';
  const errBanner = document.getElementById('signupErr');
  const successBanner = document.getElementById('signupSuccess');
  
  if(errBanner) errBanner.style.display = 'none';
  if(successBanner) successBanner.style.display = 'none';

  if(!name || !email || !pass || !passConfirm) {
    if(errBanner) { errBanner.textContent = "Please fill in all required fields (*)."; errBanner.style.display = 'block'; } 
    return;
  }

  if (pass !== passConfirm) {
    if(errBanner) { errBanner.textContent = "Your passwords do not match!"; errBanner.style.display = 'block'; } 
    return;
  }

  let actualRole = window.signupRole || 'requester'; 
  const roleCards = document.querySelectorAll('.role-card');
  if (roleCards.length > 0) {
      roleCards.forEach(card => {
          if (card.classList.contains('selected')) actualRole = card.querySelector('.role-name').textContent.toLowerCase();
      });
  }

  let finalPosition = null;
  if (actualRole === 'member' || actualRole === 'administrative' || actualRole === 'admin') {
      const groupSelect = document.getElementById('suOrgGroup');
      const roleSelect = document.getElementById('suMemberPosition');
      
      if (groupSelect) {
          if (actualRole === 'admin') {
              if (!groupSelect.value) {
                  if (errBanner) { errBanner.textContent = "Admins must select an Organization Group."; errBanner.style.display = 'block'; }
                  return;
              }
              finalPosition = groupSelect.value;
          } else {
              if (!groupSelect.value || !roleSelect.value) {
                  if (errBanner) { errBanner.textContent = "Please select both Organization Group and Specific Role."; errBanner.style.display = 'block'; }
                  return;
              }
              finalPosition = groupSelect.value + ' - ' + roleSelect.value;
          }
      }
  }

  try {
    const response = await fetch('https://backend-88na.onrender.com/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, fullName: name, contact, role: actualRole, memberPosition: finalPosition })
    });
    const data = await response.json();

    if (data.success) {
      sessionStorage.setItem('dd_currentUser', JSON.stringify(data.user));
      if(successBanner) { successBanner.textContent = `Account created! Redirecting...`; successBanner.style.display = 'block'; } 
      setTimeout(() => {
          if (data.user.role === 'admin') window.location.href = 'admin-dashboard.html';
          else if (data.user.role === 'requester') window.location.href = 'requester-dashboard.html';
          else window.location.href = 'dashboard.html';
      }, 1400);
    } else {
      if(errBanner) { errBanner.textContent = data.message; errBanner.style.display = 'block'; } 
    }
  } catch (error) {
      if(errBanner) { errBanner.textContent = "Server waking up... please click submit again."; errBanner.style.display = 'block'; }
  }
}

async function requestPasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    const errBanner = document.getElementById('resetErr');
    const succBanner = document.getElementById('resetSucc');
    
    if(errBanner) errBanner.style.display = 'none';
    if(succBanner) succBanner.style.display = 'none';

    if(!email) {
        if(errBanner) { errBanner.textContent = 'Please enter your email.'; errBanner.style.display = 'block'; }
        return;
    }
    try {
        const response = await fetch('https://backend-88na.onrender.com/api/forgot-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if(data.success) {
            if(succBanner) { succBanner.textContent = 'A reset link was sent to your email.'; succBanner.style.display = 'block'; }
            document.getElementById('resetEmail').value = '';
        } else {
            if(errBanner) { errBanner.textContent = 'Failed to process request.'; errBanner.style.display = 'block'; }
        }
    } catch(e) {}
}

async function submitNewPassword() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const pass1 = document.getElementById('newPass').value;
    const pass2 = document.getElementById('newPassConfirm').value;
    const errBanner = document.getElementById('resetErr');
    const succBanner = document.getElementById('resetSucc');

    if(errBanner) errBanner.style.display = 'none';
    if(succBanner) succBanner.style.display = 'none';

    if(!token) {
        if(errBanner) { errBanner.textContent = 'Invalid or missing reset token. Please request a new link.'; errBanner.style.display = 'block'; }
        return;
    }
    if(!pass1 || !pass2) return;
    if(pass1 !== pass2) {
        if(errBanner) { errBanner.textContent = 'Passwords do not match.'; errBanner.style.display = 'block'; }
        return;
    }

    try {
        const response = await fetch('https://backend-88na.onrender.com/api/reset-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword: pass1 })
        });
        const data = await response.json();
        if(data.success) {
            if(succBanner) { succBanner.textContent = 'Password updated successfully! Redirecting to login...'; succBanner.style.display = 'block'; }
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        } else {
            if(errBanner) { errBanner.textContent = data.message || 'Failed to update password.'; errBanner.style.display = 'block'; }
        }
    } catch(e) {}
}

/* ============================================================
   UTILITIES
============================================================ */
function showToast(msg, type='info'){
  const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  const wrap=document.getElementById('toastWrap');
  if(!wrap) return;
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<span style="font-size:15px;">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(16px)'; t.style.transition='.3s ease'; setTimeout(()=>t.remove(),300); },3500);
}

function goSub(id) {
  document.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));
  const sp = document.getElementById('sp-'+id);
  if(sp) sp.classList.add('active');
  const sn = document.getElementById('snav-'+id);
  if(sn) sn.classList.add('active');
  currentSub = id;
}

function doLogout() {
  sessionStorage.removeItem('dd_currentUser');
  showToast('Logged out successfully.','info');
  setTimeout(() => goTo('landing'), 1000);
}

async function saveSystemSettings() {
    const imgRoles = document.getElementById('setRolesImage').value.split(',').map(s => s.trim()).filter(s => s);
    const cogRoles = document.getElementById('setRolesCognizant').value.split(',').map(s => s.trim()).filter(s => s);
    
    const monthlyLimit = parseInt(document.getElementById('setSchedLimit').value) || 50;
    const leadDays = parseInt(document.getElementById('setSchedLead').value) || 0;
    const startTime = document.getElementById('setSchedStart').value || '07:00';
    const endTime = document.getElementById('setSchedEnd').value || '17:00';

    const maxWorkload = parseInt(document.getElementById('setRuleMaxWorkload').value) || 5;
    const priority = document.getElementById('setRulePriority').value;
    const emails = document.getElementById('setRuleEmails').value;

    const newSettings = {
        groupRoles: { 'IMAGE': imgRoles, 'Cognizant': cogRoles },
        schedRules: { leadDays: leadDays, startTime: startTime, endTime: endTime, monthlyLimit: monthlyLimit },
        algoRules: { maxWorkload: maxWorkload, priority: priority },
        sysFlags: { emails: emails }
    };

    try {
        const res = await fetch('https://backend-88na.onrender.com/api/settings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: newSettings })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Global configurations saved securely to database.', 'success');
            window.groupRoles = newSettings.groupRoles; 
            window.schedRules = newSettings.schedRules;
            window.algoRules = newSettings.algoRules;
            window.sysFlags = newSettings.sysFlags;
        } else {
            showToast('Failed to save settings.', 'error');
        }
    } catch(e) { showToast('Server connection error.', 'error'); }
}

/* ============================================================
   PAGE INITIALIZATION
============================================================ */
function loadAllDropdowns() {
    const groups = Object.keys(window.groupRoles);
    const suGroup = document.getElementById('suOrgGroup');
    const profGroup = document.getElementById('profEditGroup');

    if (suGroup) {
        suGroup.innerHTML = '<option value="" disabled selected>Select Organization Group</option>';
        groups.forEach(g => { const opt = document.createElement('option'); opt.value = g; opt.textContent = g; suGroup.appendChild(opt); });
    }
    if (profGroup) {
        profGroup.innerHTML = '<option value="" disabled selected>Select Group</option>';
        groups.forEach(g => { const opt = document.createElement('option'); opt.value = g; opt.textContent = g; profGroup.appendChild(opt); });
    }

    const dynamicContainer = document.getElementById('dynamicRolesContainer');
    if (dynamicContainer && typeof window.addDynamicRow === "function") {
        dynamicContainer.innerHTML = '';
        window.addDynamicRow();
    }
}

window.addEventListener('DOMContentLoaded', () => {
  fetchGlobalSettings().then(() => {
      loadAllDropdowns();
      if(window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('admin-dashboard.html')) {
          try { renderMySchedule(); } catch(e){}
          try { renderMasterCalendar(); } catch(e){}
      }
  });

  loadAllDropdowns();

  const suGroup = document.getElementById('suOrgGroup');
  const suRole = document.getElementById('suMemberPosition');
  if (suGroup && suRole) {
      suGroup.addEventListener('change', () => {
          suRole.innerHTML = '<option value="" disabled selected>Select Specific Role</option>';
          const group = suGroup.value;
          if (group && window.groupRoles[group]) {
              window.groupRoles[group].forEach(role => {
                  const opt = document.createElement('option');
                  opt.value = role; opt.textContent = role;
                  suRole.appendChild(opt);
              });
              suRole.disabled = false;
          } else { suRole.disabled = true; }
      });
  }

  const dynamicContainer = document.getElementById('dynamicRolesContainer');
  if (dynamicContainer) {
      window.addDynamicRow = function() {
          const container = document.getElementById('dynamicRolesContainer');
          if (!container) return;
          
          const row = document.createElement('div');
          row.className = 'dynamic-role-row';
          row.style.display = 'flex';
          row.style.gap = '12px';
          row.style.marginBottom = '12px';
          row.style.alignItems = 'center';

          const select = document.createElement('select');
          select.className = 'role-select';
          select.style.flex = '1';
          select.style.padding = '10px 14px';
          select.style.borderRadius = '8px';
          select.style.border = '1.5px solid var(--border)';
          select.style.fontSize = '14px';
          select.style.fontFamily = "'DM Sans', sans-serif";
          select.style.outline = 'none';
          
          select.innerHTML = '<option value="" disabled selected>Select Role...</option>';
          
          for (const [group, roles] of Object.entries(window.groupRoles)) {
              if (roles && roles.length > 0) {
                  const optgroup = document.createElement('optgroup');
                  optgroup.label = group;
                  roles.forEach(role => {
                      const opt = document.createElement('option');
                      opt.value = `${group} - ${role}`;
                      opt.textContent = `${group} - ${role}`;
                      optgroup.appendChild(opt);
                  });
                  select.appendChild(optgroup);
              }
          }

          const input = document.createElement('input');
          input.type = 'number';
          input.className = 'count-input';
          input.style.width = '70px';
          input.style.padding = '10px';
          input.style.borderRadius = '8px';
          input.style.border = '1.5px solid var(--border)';
          input.style.textAlign = 'center';
          input.style.fontFamily = "'DM Sans', sans-serif";
          input.value = '1';
          input.min = '1';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.style.padding = '10px 15px';
          removeBtn.style.background = 'transparent';
          removeBtn.style.border = '1.5px solid var(--border)';
          removeBtn.style.borderRadius = '8px';
          removeBtn.style.cursor = 'pointer';
          removeBtn.style.color = 'var(--text2)';
          removeBtn.innerHTML = '✖';

          const checkAndAddRow = () => {
              const rows = container.querySelectorAll('.dynamic-role-row');
              const lastRow = rows[rows.length - 1];
              if (row === lastRow && select.value !== "") {
                  window.addDynamicRow();
              }
          };

          select.onchange = checkAndAddRow;
          input.onchange = checkAndAddRow;

          removeBtn.onclick = () => {
              const rows = container.querySelectorAll('.dynamic-role-row');
              if (rows.length > 1) {
                  row.remove();
                  const remainingRows = container.querySelectorAll('.dynamic-role-row');
                  const lastRemainingRow = remainingRows[remainingRows.length - 1];
                  if (lastRemainingRow.querySelector('.role-select').value !== "") {
                      window.addDynamicRow();
                  }
              } else {
                  select.value = "";
                  input.value = "1";
              }
          };

          select.onfocus = () => select.style.borderColor = 'var(--green)';
          select.onblur = () => select.style.borderColor = 'var(--border)';
          input.onfocus = () => input.style.borderColor = 'var(--green)';
          input.onblur = () => input.style.borderColor = 'var(--border)';
          removeBtn.onmouseover = () => { removeBtn.style.borderColor = '#e74c3c'; removeBtn.style.color = '#e74c3c'; };
          removeBtn.onmouseout = () => { removeBtn.style.borderColor = 'var(--border)'; removeBtn.style.color = 'var(--text2)'; };

          row.appendChild(select);
          row.appendChild(input);
          row.appendChild(removeBtn);
          container.appendChild(row);
      };
      
      dynamicContainer.innerHTML = '';
      window.addDynamicRow();
  }

  // ⚡ FIX: Adjusted Authentication and Redirect Logic
  const currentUserStr = sessionStorage.getItem('dd_currentUser');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const isAuthPage = window.location.pathname.includes('login') || window.location.pathname.includes('signup');
  const isProtected = (document.querySelector('.app-shell') || document.querySelector('.profile-wrap') || document.querySelector('.container')) && !isAuthPage;
  
  if (isAuthPage && currentUser) {
      if (currentUser.role === 'admin') window.location.href = 'admin-dashboard.html';
      else if (currentUser.role === 'requester') window.location.href = 'requester-dashboard.html';
      else window.location.href = 'dashboard.html';
  } else if (isProtected && !currentUser) {
      goTo('login');
  } else if (isProtected && currentUser) {

    fetch(`https://backend-88na.onrender.com/api/users?_nocache=${Date.now()}`).then(res => res.json()).then(data => {
        if(data.success) {
            const freshUser = data.users.find(u => u.id === currentUser.id);
            const currentPos = currentUser.position || null;
            const freshPos = freshUser.position || null;
            
            if (freshUser && (freshUser.role !== currentUser.role || freshPos !== currentPos)) {
                currentUser.role = freshUser.role;
                currentUser.position = freshPos;
                sessionStorage.setItem('dd_currentUser', JSON.stringify(currentUser));
                window.location.reload(); 
            }
        }
    }).catch(e => console.log('Live sync checked.'));

    document.querySelectorAll('.sb-uname, #profileName').forEach(n => n.textContent = currentUser.name);
    
    if (currentUser.avatar) {
        document.querySelectorAll('.sb-av').forEach(av => {
            av.innerHTML = `<img src="${currentUser.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        });
    } else {
        const init = currentUser.name ? currentUser.name.substring(0,2).toUpperCase() : '👤';
        document.querySelectorAll('.sb-av').forEach(av => {
            av.innerHTML = '';
            av.textContent = init;
        });
    }

    const isAdministrative = currentUser.role === 'administrative';
    let displayRole = currentUser.role.toUpperCase();
    if ((currentUser.role === 'member' || isAdministrative) && currentUser.position) displayRole = currentUser.position.toUpperCase();
    if (isAdministrative) displayRole = `⭐ ADMIN ASST (${displayRole})`;
    if (currentUser.role === 'admin' && currentUser.position) displayRole = `👑 ADMIN (${currentUser.position.toUpperCase()})`;
    document.querySelectorAll('.sb-urole').forEach(n => n.textContent = displayRole);

    if (isAdministrative) {
        if(document.getElementById('adminNavSec')) document.getElementById('adminNavSec').style.display = 'block';
        if(document.getElementById('snav-roster')) document.getElementById('snav-roster').style.display = 'flex';
        try { loadAdministrativeApprovals(); } catch(e){}
    }

    try {
        if (typeof loadUserNotifications === 'function') {
            loadUserNotifications();
        }
    } catch(e) { console.error("Notification load bypassed", e); }

    if(window.location.pathname.includes('profile.html')) {
        try { loadProfileData(); loadUserWorkload(); } catch(e){}
    }
    
    if(window.location.pathname.includes('dashboard.html') && !window.location.pathname.includes('admin') && !window.location.pathname.includes('requester')) {
        try { renderMasterCalendar(); } catch(e){}
        try { renderMySchedule(); } catch(e){}
        
        loadDashboardData().catch(e => console.log('Events waking...'));
        loadUserWorkload().catch(e => console.log('Workload waking...'));
        loadMemberOpportunities().catch(e => console.log('Opportunities waking...'));
        try { if(typeof loadSavedSchedule === 'function') loadSavedSchedule(); } catch(e) {}
    }
    
    if(window.location.pathname.includes('admin-dashboard.html')) {
        try { renderMasterCalendar(); } catch(e){}
        loadDashboardData().catch(e=>{});
        loadDashboardStats().catch(e=>{}); 
        loadAdminApprovals().catch(e=>{}); 
        loadAdminMembers().catch(e=>{}); 
        loadWorkloadRanking().catch(e=>{});
        loadMemberOpportunities().catch(e=>{}); 
    }
    if(window.location.pathname.includes('requester-dashboard.html')) {
        loadRequesterData().catch(e=>{}); 
        if(document.getElementById('profName')) document.getElementById('profName').value = currentUser.name || '';
        if(document.getElementById('profEmail')) document.getElementById('profEmail').value = currentUser.email || '';
        if(document.getElementById('profContact')) document.getElementById('profContact').value = currentUser.contact || 'No contact added';
        if(document.getElementById('profRole')) document.getElementById('profRole').value = 'REQUESTER';
    }

    startAutoRefresh();
  }
});


/* ============================================================
   PROFILE & WORKLOAD CALCULATION
============================================================ */
let base64Avatar = null;
function previewAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) return showToast("Image is too large. Max 2MB.", "error");
        
        const reader = new FileReader();
        reader.onload = function(e) {
            if(document.getElementById('avatarPreview')) {
                document.getElementById('avatarPreview').src = e.target.result;
                document.getElementById('avatarPreview').style.display = 'block';
            }
            if(document.getElementById('picAvatarText')) {
                document.getElementById('picAvatarText').style.display = 'none';
            }
            base64Avatar = e.target.result; 
            showToast('Photo selected! Click Save.', 'info');
        }
        reader.readAsDataURL(file);
    }
}

function loadProfileData() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if (!currentUser) return;
    
    if(document.getElementById('profEditName')) document.getElementById('profEditName').value = currentUser.name || '';
    if(document.getElementById('profEditEmail')) document.getElementById('profEditEmail').value = currentUser.email || '';
    if(document.getElementById('profEditContact')) document.getElementById('profEditContact').value = currentUser.contact || '';
    
    let displayRole = currentUser.role.toUpperCase();
    let hdrBadge = '🛡️';
    if (currentUser.role === 'admin') {
        displayRole = currentUser.position ? `ADMIN (${currentUser.position.toUpperCase()})` : 'SYSTEM ADMINISTRATOR';
        hdrBadge = '👑';
    } else if (currentUser.role === 'administrative') {
        displayRole = `ADMIN ASST (${(currentUser.position || '').toUpperCase()})`;
        hdrBadge = '⭐';
    } else if (currentUser.role === 'member') {
        displayRole = (currentUser.position || 'MEMBER').toUpperCase();
        hdrBadge = '🛡️';
    } else {
        displayRole = currentUser.role.toUpperCase();
        hdrBadge = '👤';
    }

    if(document.getElementById('hdrName')) document.getElementById('hdrName').textContent = currentUser.name;
    if(document.getElementById('hdrEmail')) document.getElementById('hdrEmail').textContent = currentUser.email;
    if(document.getElementById('hdrContact')) document.getElementById('hdrContact').textContent = currentUser.contact || 'No contact added';
    if(document.getElementById('hdrRole')) document.getElementById('hdrRole').textContent = `${hdrBadge} ${displayRole}`;

    if(document.getElementById('infoName')) document.getElementById('infoName').textContent = currentUser.name;
    if(document.getElementById('infoEmail')) document.getElementById('infoEmail').textContent = currentUser.email;
    if(document.getElementById('infoContact')) document.getElementById('infoContact').textContent = currentUser.contact || 'None added';
    if(document.getElementById('infoRole')) document.getElementById('infoRole').textContent = displayRole;

    if (currentUser.role === 'admin' || currentUser.role === 'requester') {
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.textContent.includes('Workload')) {
                tab.style.display = 'none';
            }
        });
    }

    const initials = currentUser.name ? currentUser.name.substring(0,2).toUpperCase() : '--';
    if (currentUser.avatar) {
        if(document.getElementById('hdrAvatarImg')) {
            document.getElementById('hdrAvatarImg').src = currentUser.avatar;
            document.getElementById('hdrAvatarImg').style.display = 'block';
            if(document.getElementById('hdrAvatarText')) document.getElementById('hdrAvatarText').style.display = 'none';
        }
        if(document.getElementById('avatarPreview')) {
            document.getElementById('avatarPreview').src = currentUser.avatar;
            document.getElementById('avatarPreview').style.display = 'block';
            if(document.getElementById('picAvatarText')) document.getElementById('picAvatarText').style.display = 'none';
        }
    } else {
        if(document.getElementById('hdrAvatarText')) document.getElementById('hdrAvatarText').textContent = initials;
        if(document.getElementById('picAvatarText')) document.getElementById('picAvatarText').textContent = initials;
    }
    
    const dashUrl = currentUser.role === 'admin' ? 'admin-dashboard.html' : (currentUser.role === 'requester' ? 'requester-dashboard.html' : 'dashboard.html');
    if(document.getElementById('backBtn')) document.getElementById('backBtn').onclick = () => window.location.href = dashUrl;

    const roleWrapper = document.getElementById('profEditPositionWrapper');
    if (roleWrapper) {
        if (currentUser.role === 'admin') {
            roleWrapper.style.display = 'block';
            const groupSelect = document.getElementById('profEditGroup');
            const roleSelect = document.getElementById('profEditRole');
            if (groupSelect) groupSelect.value = currentUser.position || '';
            if (roleSelect) roleSelect.style.display = 'none'; 
        } else if (currentUser.role === 'member' || currentUser.role === 'administrative') {
            roleWrapper.style.display = 'block';
            const roleSelect = document.getElementById('profEditRole');
            if (roleSelect) roleSelect.style.display = 'inline-block';
            if(currentUser.position) {
                const parts = currentUser.position.split(' - ');
                if(parts.length === 2) {
                    const groupSelect = document.getElementById('profEditGroup');
                    if (groupSelect && roleSelect) { groupSelect.value = parts[0]; updateProfileRoles(); roleSelect.value = parts[1]; }
                }
            }
        } else { roleWrapper.style.display = 'none'; }
    }
}

async function saveProfile() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if (!currentUser) return;
    const name = document.getElementById('profEditName') ? document.getElementById('profEditName').value.trim() : currentUser.name;
    const contact = document.getElementById('profEditContact') ? document.getElementById('profEditContact').value.trim() : currentUser.contact;
    if (!name) return showToast("Name cannot be empty", "error");

    let position = currentUser.position;
    if (currentUser.role === 'admin') {
        const group = document.getElementById('profEditGroup') ? document.getElementById('profEditGroup').value : '';
        if (!group) return showToast("Admins must select an Organization Group.", "error");
        position = group;
    } else if (currentUser.role === 'member' || currentUser.role === 'administrative') {
        const group = document.getElementById('profEditGroup') ? document.getElementById('profEditGroup').value : '';
        const role = document.getElementById('profEditRole') ? document.getElementById('profEditRole').value : '';
        if (!group || !role) return showToast("Please select your Group and Role.", "error");
        position = `${group} - ${role}`;
    }

    try {
        const response = await fetch('https://backend-88na.onrender.com/api/users/update', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, fullName: name, contact: contact, position: position, avatar: base64Avatar })
        });
        const data = await response.json();
        if (data.success) {
            showToast('Profile Saved!', 'success');
            currentUser.name = name; currentUser.contact = contact; currentUser.position = position;
            if (base64Avatar) currentUser.avatar = base64Avatar; 
            sessionStorage.setItem('dd_currentUser', JSON.stringify(currentUser));
            loadProfileData(); 
            if (currentUser.avatar) {
                document.querySelectorAll('.sb-av').forEach(av => {
                    av.innerHTML = `<img src="${currentUser.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                });
            }
        } else showToast('Failed to save profile.', 'error');
    } catch (err) {
        showToast('Server connection error.', 'error');
    }
}

function updateProfileRoles() {
    const groupSelect = document.getElementById('profEditGroup');
    const roleSelect = document.getElementById('profEditRole');
    if(!groupSelect || !roleSelect) return;
    roleSelect.innerHTML = '<option value="" disabled selected>Select Role</option>';
    const group = groupSelect.value;
    if (group && window.groupRoles[group]) {
        window.groupRoles[group].forEach(role => {
            const opt = document.createElement('option');
            opt.value = role; opt.textContent = role;
            roleSelect.appendChild(opt);
        });
        roleSelect.disabled = false;
    } else { roleSelect.disabled = true; }
}

async function loadUserWorkload() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if (!currentUser || (currentUser.role !== 'member' && currentUser.role !== 'administrative')) return;

    try {
        // ⚡ FIX: Added cache-buster to instantly pull fresh data!
        const res = await fetch(`https://backend-88na.onrender.com/api/user-stats/${currentUser.id}?_nocache=${Date.now()}`);
        const data = await res.json();
        
        if (data.success) {
            const assigned = data.stats.totalAssigned || 0;
            const upcoming = data.stats.upcomingEvents || 0;
            
            let pct = Math.min(Math.round((assigned / window.algoRules.maxWorkload) * 100), 100);
            let color = pct < 40 ? 'var(--green)' : (pct < 80 ? 'var(--warn)' : 'var(--danger)');

            const pctEl = document.querySelector('.workload-pct');
            const barEl = document.querySelector('.progress-fill');
            
            if(pctEl) { pctEl.textContent = `${pct}%`; pctEl.style.color = color; }
            if(barEl) { barEl.style.width = `${pct}%`; barEl.style.background = color; }

            if(document.getElementById('statMyAssigned')) document.getElementById('statMyAssigned').textContent = assigned;
        }
    } catch(e) {}
}


/* ============================================================
   NOTIFICATIONS
============================================================ */
async function loadUserNotifications() {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        if (!currentUser) return;
        
        // ⚡ FIX: Added cache-buster to instantly pull fresh data!
        const response = await fetch(`https://backend-88na.onrender.com/api/notifications/${currentUser.id}?_nocache=${Date.now()}`);
        
        if (!response.ok) {
            if(list) list.innerHTML = "<div style='text-align:center; color:var(--text3); padding:20px;'>You have no new notifications.</div>";
            if(badge) badge.style.display = 'none';
            return;
        }
        
        const data = await response.json();
        if (data.success && Array.isArray(data.notifications)) {
            if (data.notifications.length > 0) {
                let html = '';
                data.notifications.forEach(n => {
                    const icon = n.type === 'success' ? '✅' : (n.type === 'error' ? '❌' : (n.type === 'warning' ? '⚠️' : 'ℹ️'));
                    
                    const safeEventId = n.event_id ? n.event_id : 'null';
                    const clickAction = `onclick="handleNotifClick(${safeEventId}, ${n.id || n.notif_id})"`;
                    const hoverStyle = `cursor:pointer; transition: transform 0.2s ease;`;
                    const hoverEffect = `onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='translateX(0)'"`;
                    const timeString = n.created_at ? new Date(n.created_at).toLocaleString() : 'Recently';

                    html += `
                    <div class="notif-item ${n.is_read ? '' : 'unread'}" style="${hoverStyle}" ${clickAction} ${hoverEffect}>
                        <div class="notif-icon">${icon}</div>
                        <div>
                            <div class="notif-text">${n.message || 'New system update'}</div>
                            <div class="notif-time">${timeString}</div>
                        </div>
                    </div>`;
                });
                if(list) list.innerHTML = html;
                if(badge) { 
                    const unread = data.notifications.filter(n => !n.is_read).length; 
                    if(unread > 0) { badge.style.display = 'inline-block'; badge.textContent = unread; }
                    else { badge.style.display = 'none'; }
                }
            } else { 
                if(list) list.innerHTML = "<div style='text-align:center; color:var(--text3); padding:20px;'>You have no new notifications.</div>"; 
                if(badge) badge.style.display = 'none';
            }
        } else {
            if(list) list.innerHTML = "<div style='text-align:center; color:var(--text3); padding:20px;'>You have no new notifications.</div>";
            if(badge) badge.style.display = 'none';
        }
    } catch (error) {
        if(list) list.innerHTML = "<div style='text-align:center; color:var(--text3); padding:20px;'>You have no new notifications.</div>";
        if(badge) badge.style.display = 'none';
    }
}

async function handleNotifClick(eventId, notifId) {
    try {
        await fetch('https://backend-88na.onrender.com/api/notifications/read', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({notifId})
        });
        
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        if (currentUser) {
            if (currentUser.role === 'requester') {
                const firstTab = document.querySelectorAll('.nav-link')[0]; 
                if (typeof switchReqTab === 'function') switchReqTab('ticket', firstTab);
            } else {
                if (eventId) goSub('home'); 
            }
        }
        if (eventId) { setTimeout(() => viewEventDetails(eventId), 150); }
        loadUserNotifications();
    } catch(e) {}
}

async function markAllNotifsRead() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if (!currentUser) return;
    try {
        const response = await fetch('https://backend-88na.onrender.com/api/notifications/read-all', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id })
        });
        const data = await response.json();
        if (data.success) {
            showToast('All notifications marked as read.', 'success');
            loadUserNotifications();
        }
    } catch(e) { showToast('Error connecting to server.', 'error'); }
}


/* ============================================================
   EVENT PIPELINE & MODALS
============================================================ */
async function submitReq() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    const titleEl = document.getElementById('rTitle');
    const typeEl = document.getElementById('rType');
    const typeOtherEl = document.getElementById('rTypeOther');
    const dateEl = document.getElementById('rDate');
    const timeEl = document.getElementById('rTime');
    const venueEl = document.getElementById('rVenue');
    const descEl = document.getElementById('rDesc');
    
    [titleEl, typeEl, typeOtherEl, dateEl, timeEl, venueEl, descEl].forEach(el => {
        if(el) el.style.borderColor = 'var(--border)';
    });

    let hasError = false;
    
    if (!titleEl.value.trim()) { titleEl.style.borderColor = 'red'; hasError = true; }
    if (!typeEl.value) { typeEl.style.borderColor = 'red'; hasError = true; }
    if (typeEl.value === 'Other' && !typeOtherEl.value.trim()) { typeOtherEl.style.borderColor = 'red'; hasError = true; }
    if (!dateEl.value) { dateEl.style.borderColor = 'red'; hasError = true; }
    if (!timeEl.value) { timeEl.style.borderColor = 'red'; hasError = true; }
    if (!venueEl.value.trim()) { venueEl.style.borderColor = 'red'; hasError = true; }
    if (!descEl.value.trim()) { descEl.style.borderColor = 'red'; hasError = true; }

    if (hasError) return showToast('Please fill in all highlighted fields (*)', 'warning');

    if (timeEl.value < window.schedRules.startTime || timeEl.value > window.schedRules.endTime) {
        timeEl.style.borderColor = 'red';
        
        let stHour = parseInt(window.schedRules.startTime.split(':')[0]);
        let stFormatted = `${stHour % 12 || 12}:${window.schedRules.startTime.split(':')[1]} ${stHour >= 12 ? 'PM' : 'AM'}`;
        
        let enHour = parseInt(window.schedRules.endTime.split(':')[0]);
        let enFormatted = `${enHour % 12 || 12}:${window.schedRules.endTime.split(':')[1]} ${enHour >= 12 ? 'PM' : 'AM'}`;
        
        return showToast(`Events can only be scheduled between ${stFormatted} and ${enFormatted}.`, 'error');
    }

    const selectedDate = new Date(dateEl.value);
    const today = new Date();
    today.setHours(0,0,0,0); 
    
    const diffTime = selectedDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < window.schedRules.leadDays) {
        dateEl.style.borderColor = 'red';
        return showToast(`Requests must be submitted at least ${window.schedRules.leadDays} days in advance.`, 'error');
    }

    if (window.schedRules.monthlyLimit > 0) {
        try {
            const checkRes = await fetch('https://backend-88na.onrender.com/api/events');
            const checkData = await checkRes.json();
            if (checkData.success) {
                const reqMonth = selectedDate.getMonth();
                const reqYear = selectedDate.getFullYear();
                const currentMonthCount = checkData.events.filter(e => {
                    if (e.status === 'rejected') return false;
                    const ed = new Date(e.event_date);
                    return ed.getMonth() === reqMonth && ed.getFullYear() === reqYear;
                }).length;
                
                if (currentMonthCount >= window.schedRules.monthlyLimit) {
                    dateEl.style.borderColor = 'red';
                    return showToast(`System capacity reached! We only accept ${window.schedRules.monthlyLimit} events per month.`, 'error');
                }
            }
        } catch(e) {
            return showToast('Error checking calendar capacity. Try again.', 'error');
        }
    }

    let finalEventType = typeEl.value;
    if (finalEventType === 'Other') finalEventType = typeOtherEl.value.trim();

    let totalMembers = 0;
    let personnelReqsPayload = [];

    const dynamicRows = document.querySelectorAll('.dynamic-role-row');
    if (dynamicRows.length > 0) {
        dynamicRows.forEach(row => {
            const roleVal = row.querySelector('.role-select').value;
            const countVal = parseInt(row.querySelector('.count-input').value);
            if (roleVal !== "" && countVal > 0) {
                const parts = roleVal.split(' - ');
                if(parts.length === 2) {
                    personnelReqsPayload.push({ group: parts[0].trim(), role: parts[1].trim(), count: countVal });
                    totalMembers += countVal;
                }
            }
        });
    } 

    if (personnelReqsPayload.length === 0) {
        const container = document.getElementById('dynamicRolesContainer');
        if(container) container.parentElement.style.borderColor = 'red';
        return showToast('Please select at least one required role.', 'warning');
    }
    
    const container = document.getElementById('dynamicRolesContainer');
    if(container) container.parentElement.style.borderColor = 'var(--border)';

    let rolesString = personnelReqsPayload.map(p => `${p.count}x ${p.group} - ${p.role}`).join(', ');
    let finalDescription = `[Coverage Requested: ${rolesString}]\n\n${descEl.value.trim()}`;

    const formData = new FormData();
    formData.append('title', titleEl.value.trim());
    formData.append('date', dateEl.value);
    formData.append('time', timeEl.value);
    
    formData.append('venue', venueEl.value.trim());
    formData.append('members', totalMembers);
    formData.append('type', finalEventType); 
    formData.append('requesterId', currentUser.id);
    formData.append('personnelReqs', JSON.stringify(personnelReqsPayload));
    formData.append('description', finalDescription);

    const fileInput = document.getElementById('rFiles');
    if (fileInput && fileInput.files.length > 0) {
        Array.from(fileInput.files).forEach(file => formData.append('files', file));
    }

    try {
        const response = await fetch('https://backend-88na.onrender.com/api/events', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showToast('Ticket submitted successfully!', 'success');
            document.getElementById('rTitle').value = ''; 
            document.getElementById('rDesc').value = ''; 
            document.getElementById('rVenue').value = '';
            document.getElementById('rType').value = '';
            
            if(typeOtherEl) { typeOtherEl.value = ''; typeOtherEl.style.display = 'none'; }

            if (container) { container.innerHTML = ''; if (typeof addDynamicRow === "function") addDynamicRow(); }
            if(document.getElementById('rFiles')) document.getElementById('rFiles').value = '';
            if(document.getElementById('fileListDisplay')) document.getElementById('fileListDisplay').innerHTML = '';
            
            if (typeof loadDashboardData === 'function') loadDashboardData().catch(e=>{});
            if (typeof loadRequesterData === "function") loadRequesterData();
            if (typeof loadUserNotifications === "function") loadUserNotifications();
        } else {
            showToast('Submission Rejected: Please check your inputs.', 'error');
        }
    } catch (error) { 
        showToast('Error connecting to the server.', 'error'); 
    }
}

async function viewEventDetails(id) {
    if (!window.cachedEvents) { 
        if(typeof loadDashboardData === 'function') { await loadDashboardData(); } 
    }
    const ev = window.cachedEvents ? window.cachedEvents.find(e => e.id === id) : null;
    if (!ev) return;

    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    const isAdministrative = currentUser && currentUser.role === 'administrative';
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    const myOrg = (currentUser && currentUser.position) ? currentUser.position.split(' - ')[0] : null;

    let approvals = { initial: [], forwarded: [], final: [] };
    try { approvals = JSON.parse(ev.admin_approvals || '{"initial":[], "forwarded":[], "final":[]}'); } catch(e) {}
    if (!approvals.forwarded) approvals.forwarded = [];

    let modal = document.getElementById('eventDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'eventDetailsModal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; padding: 20px;';
        document.body.appendChild(modal);
    }

    let rawDesc = ev.description ? ev.description : 'No description provided.';
    let attachmentsBlock = '';

    if (rawDesc.includes('[Attached Documents]:')) {
        const splitDesc = rawDesc.split('[Attached Documents]:');
        rawDesc = splitDesc[0].trim();
        attachmentsBlock = `
            <div style="margin-top: 15px; padding: 16px; background: #f0faf4; border: 1px solid #c2ebd1; border-radius: 8px;">
                <div style="font-size:11px; color:#158244; font-weight:800; text-transform:uppercase; margin-bottom:8px;">📎 Attached Documents</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">${splitDesc[1].trim().replace(/\n/g, '')}</div>
            </div>`;
    }

    let statusColor = '#ffeeba', statusText = '#856404', displayStatus = ev.status.toUpperCase();
    if(ev.status === 'awaiting_initial_admin') { statusColor = '#fff3cd'; statusText = '#856404'; displayStatus = 'AWAITING INITIAL APPROVAL'; }
    if(ev.status === 'pending_admin') { statusColor = '#cce5ff'; statusText = '#004085'; displayStatus = 'AWAITING FINAL APPROVAL'; }
    if(ev.status.toLowerCase() === 'approved') { statusColor = '#d4edda'; statusText = '#155724'; }
    if(ev.status.toLowerCase() === 'rejected') { statusColor = '#f8d7da'; statusText = '#721c24'; }

    let deleteBtnHtml = (isAdmin) ? `<button onclick="deleteEvent(${ev.id})" style="background:none; border:none; font-size:16px; cursor:pointer; color:#e74c3c; margin-right:15px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="Delete Event Permanently">🗑️</button>` : '';

    let modalHtml = `
        <div class="card" style="width: 100%; max-width: 600px; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #fdfdfd;">
                <h3 style="margin: 0; font-family: 'Syne', sans-serif; color: var(--green);">Event Details</h3>
                <div style="display:flex; align-items:center;">
                    ${deleteBtnHtml}
                    <button onclick="document.getElementById('eventDetailsModal').style.display='none'" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text3);">&times;</button>
                </div>
            </div>
            <div style="padding: 24px; overflow-y: auto; font-size: 14px; line-height: 1.6; color: var(--text1);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    <div><span style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700;">Event Title</span><br><strong style="font-size:16px;">${ev.title}</strong></div>
                    <div><span style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700;">Status</span><br><span style="display:inline-block; padding:4px 10px; border-radius:99px; font-size:11px; font-weight:700; text-transform:uppercase; background:${statusColor}; color:${statusText}; margin-top:2px;">${displayStatus}</span></div>
                    
                    <div><span style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700;">Event Type</span><br>${ev.event_type || 'General Event'}</div>
                    
                    <div><span style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700;">Requester</span><br>${ev.requester_name || 'Unknown'}</div>
                    <div><span style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700;">Date & Time</span><br>${new Date(ev.event_date).toLocaleDateString()} at ${ev.start_time}</div>
                    <div><span style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700;">Venue</span><br>${ev.venue}</div>
                </div>
                
                <div style="background: var(--bg2); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="font-size:11px; color:var(--text3); text-transform:uppercase; font-weight:700; margin-bottom:8px;">Description & Personnel Needed (${ev.members_required} Total)</div>
                    ${rawDesc.replace(/\n/g, '<br>')}
                    ${attachmentsBlock} 
                </div>`;

    // ⚡ FIX: Only show Admin Panel for regular Admins OR Admin Assistants specifically viewing the Roster tab
    let showAdminPanel = isAdmin || (isAdministrative && currentSub === 'roster');

    if (showAdminPanel) {
        if (ev.status.toLowerCase() !== 'approved' && ev.status.toLowerCase() !== 'rejected') {
            let adminPanel = `<div style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
                <h4 style="margin-bottom: 10px; color:var(--green); font-family:'Syne', sans-serif;">⚡ Coverage Management</h4>`;
            
            try {
                const cRes = await fetch(`https://backend-88na.onrender.com/api/allocations/admin/${id}`);
                const cData = await cRes.json();
                
                if (cData.success && cData.allocations) {
                    
                    let minWorkloadsByRole = {};
                    
                    cData.allocations.forEach(a => {
                        if (a.status === 'declined') return;
                        if (myOrg && a.required_role && !a.required_role.startsWith(myOrg)) return;
                        let isVisible = (a.status === 'eligible' || a.status === 'notified' || a.status === 'accepted' || a.status === 'rostered');
                        if (!isVisible) return;
                        
                        let isOverloaded = (a.current_workload || 0) >= window.algoRules.maxWorkload;
                        
                        let wl = a.current_workload || 0;
                        if (!isOverloaded) { 
                            if (minWorkloadsByRole[a.required_role] === undefined || wl < minWorkloadsByRole[a.required_role]) {
                                minWorkloadsByRole[a.required_role] = wl;
                            }
                        }
                    });

                    cData.allocations.forEach(a => {
                        if (a.status === 'declined') return;
                        if (myOrg && a.required_role && !a.required_role.startsWith(myOrg)) return;

                        let isVisible = (a.status === 'eligible' || a.status === 'notified' || a.status === 'accepted' || a.status === 'rostered');
                        if (!isVisible) return;

                        let isOverloaded = (a.current_workload || 0) >= window.algoRules.maxWorkload;
                        let isSelectable = (!isOverloaded) && ((isAdministrative && (a.status === 'accepted' || a.status === 'notified' || a.status === 'eligible')) || (isAdmin && a.status === 'rostered'));
                        
                        let badgeBg = a.status === 'accepted' ? '#d4edda' : '#f4f4f4';
                        if (a.status === 'rostered') badgeBg = '#cce5ff';
                        
                        let badgeColor = a.status === 'accepted' ? '#155724' : '#888';
                        if (a.status === 'rostered') badgeColor = '#004085';

                        let statusLabel = a.status.toUpperCase();
                        if (a.status === 'eligible') statusLabel = 'MATCHED (WAITING INITIAL APPROVAL)';
                        if (a.status === 'notified') statusLabel = 'NOTIFIED';

                        let isRecommended = (!isOverloaded && (a.current_workload || 0) === minWorkloadsByRole[a.required_role]);
                        let recommendedBadge = isRecommended ? `<span style="background:var(--green); color:#fff; font-size:9px; padding:3px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; letter-spacing:0.5px; box-shadow: 0 2px 5px rgba(27,163,84,0.3);">⭐ RECOMMENDED</span>` : '';
                        
                        let overloadBadge = isOverloaded ? `<span style="background:var(--danger, #e74c3c); color:#fff; font-size:9px; padding:3px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; font-weight:bold;">⚠️ OVERLOADED</span>` : '';

                        adminPanel += `
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; padding:12px; background:${badgeBg}; border-radius:8px; border: 1px solid var(--border); ${isOverloaded ? 'opacity: 0.6;' : ''}">
                            <input type="checkbox" class="ccaa-cb" value="${a.id}" ${isSelectable ? '' : 'disabled'} ${a.status === 'rostered' ? 'checked' : ''} style="width:18px; height:18px; cursor:${isSelectable ? 'pointer' : 'not-allowed'};" onclick="event.stopPropagation()">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <div>
                                        <strong style="font-size:15px; color:var(--text1)">${a.user_name}</strong>
                                        ${recommendedBadge}
                                        ${overloadBadge}
                                    </div>
                                    <span style="font-size:10px; padding:4px 8px; border-radius:99px; background:rgba(0,0,0,0.05); color:${badgeColor}; font-weight:800; text-transform:uppercase;">${statusLabel}</span>
                                </div>
                                <div style="font-size:11px; color:var(--text3); margin-top:4px;">Role: ${a.required_role} | Active Tasks: ${a.current_workload || 0}</div>
                            </div>
                        </div>`;
                    });
                }
            } catch(e) {}

            if (ev.status === 'awaiting_initial_admin' && isAdmin) {
                if (approvals.initial.includes(myOrg)) {
                    adminPanel += `<div style="margin-top:16px; padding:12px; text-align:center; background:#eafbf1; color:#158244; font-weight:600; border-radius:8px; font-size:13px;">✅ You Approved (Waiting for Partner Admin)</div>`;
                } else {
                    adminPanel += `<div style="display:flex; gap:10px; margin-top:16px;"><button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="updateEventStatus(${id}, 'initial_approve', '${myOrg}')">Approve Initial Request</button></div>`;
                }
            } else if (ev.status === 'pending' && isAdministrative) {
                if (approvals.forwarded.includes(myOrg)) {
                    adminPanel += `<div style="margin-top:16px; padding:12px; text-align:center; background:#eafbf1; color:#158244; font-weight:600; border-radius:8px; font-size:13px;">✅ Roster Forwarded (Waiting for Partner Admin Asst)</div>`;
                } else {
                    adminPanel += `<div style="display:flex; gap:10px; margin-top:16px;"><button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="forwardRosterToAdmin(${id}, '${myOrg}')">Forward Selected Roster</button></div>`;
                }
            } else if (ev.status === 'pending_admin' && isAdmin) {
                if (approvals.final.includes(myOrg)) {
                    adminPanel += `<div style="margin-top:16px; padding:12px; text-align:center; background:#eafbf1; color:#158244; font-weight:600; border-radius:8px; font-size:13px;">✅ Finalized (Waiting for Partner Admin)</div>`;
                } else {
                    adminPanel += `
                    <div style="display:flex; gap:10px; margin-top:16px;">
                        <button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="approveEventWithCandidates(${id}, '${myOrg}')">Finalize & Deploy Team</button>
                        <button class="btn btn-outline" style="border-color:var(--danger); color:var(--danger);" onclick="updateEventStatus(${id}, 'rejected', '${myOrg}')">Reject</button>
                    </div>`;
                }
            }
            
            modalHtml += adminPanel + `</div>`;
        }
    }

    let assignedTeamBlock = '';
    if (ev.status.toLowerCase() === 'approved') {
        try {
            const teamRes = await fetch(`https://backend-88na.onrender.com/api/allocations/admin/${id}`);
            const teamData = await teamRes.json();
            if (teamData.success && teamData.allocations) {
                const team = teamData.allocations.filter(a => a.status === 'assigned');
                let displayTeam = team;
                if (myOrg) {
                    displayTeam = team.filter(a => a.required_role && a.required_role.startsWith(myOrg));
                }

                if (displayTeam.length > 0) {
                    assignedTeamBlock = `
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border);">
                            <div style="font-size:11px; color:var(--green); font-weight:800; text-transform:uppercase; margin-bottom:10px;">🛡️ Assigned Coverage Team</div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">`;
                    displayTeam.forEach(m => {
                        assignedTeamBlock += `
                            <div style="display:flex; align-items:center; gap:10px; background:#f0faf4; padding:10px; border-radius:8px; border:1px solid #c3f1d5;">
                                <div style="font-size:18px;">👤</div>
                                <div>
                                    <div style="font-weight:700; font-size:14px; color:var(--text1);">${m.user_name}</div>
                                    <div style="font-size:11px; color:var(--green-dark); font-weight:600;">${m.required_role}</div>
                                </div>
                            </div>`;
                    });
                    assignedTeamBlock += `</div></div>`;
                }
            }
        } catch (e) { console.error("Error loading team", e); }
    }

    modalHtml += assignedTeamBlock; 
    modalHtml += `</div></div>`;
    modal.innerHTML = modalHtml;
    modal.style.display = 'flex';
}

async function deleteEvent(eventId) {
    if(!confirm("⚠️ WARNING: Are you sure you want to permanently delete this event? All associated roster assignments will also be destroyed. This action cannot be undone.")) return;
    try {
        const response = await fetch('https://backend-88na.onrender.com/api/events/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: eventId })
        });
        const data = await response.json();
        if (data.success) {
            showToast('Event permanently deleted.', 'success');
            document.getElementById('eventDetailsModal').style.display = 'none';
            if (typeof loadDashboardData === 'function') loadDashboardData(); 
            if (typeof loadAdminApprovals === 'function') loadAdminApprovals(); 
            if (typeof loadDashboardStats === 'function') loadDashboardStats();
        } else { showToast('Failed to delete event.', 'error'); }
    } catch (error) { showToast('Server connection error.', 'error'); }
}

async function forwardRosterToAdmin(eventId, myOrg) {
    const checkboxes = document.querySelectorAll('.ccaa-cb:checked:not(:disabled)');
    const selectedAllocations = Array.from(checkboxes).map(cb => parseInt(cb.value));
    try {
        const response = await fetch('https://backend-88na.onrender.com/api/events/roster', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, selectedAllocations, myOrg })
        });
        const data = await response.json();
        if (data.success) {
            showToast(data.message, 'success');
            document.getElementById('eventDetailsModal').style.display = 'none';
            if(typeof loadAdministrativeApprovals === 'function') loadAdministrativeApprovals(); 
            if(typeof loadDashboardData === 'function') loadDashboardData();
        }
    } catch (error) {}
}

async function approveEventWithCandidates(eventId, myOrg) {
    const checkboxes = document.querySelectorAll('.ccaa-cb:checked:not(:disabled)');
    const selectedAllocations = Array.from(checkboxes).map(cb => parseInt(cb.value));
    try {
        const response = await fetch('https://backend-88na.onrender.com/api/events/status', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, status: 'approved', selectedAllocations, myOrg })
        });
        const data = await response.json();
        if (data.success) {
            showToast(data.message, 'success');
            document.getElementById('eventDetailsModal').style.display = 'none';
            if(typeof loadAdminApprovals === 'function') loadAdminApprovals(); 
            if(typeof loadDashboardStats === 'function') loadDashboardStats(); 
            if(typeof loadDashboardData === 'function') loadDashboardData();
        }
    } catch (error) {}
}

async function updateEventStatus(eventId, newStatus, myOrg) {
    try {
        const response = await fetch('https://backend-88na.onrender.com/api/events/status', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, status: newStatus, myOrg })
        });
        const data = await response.json();
        if (data.success) {
            showToast(data.message, newStatus.includes('reject') ? 'warning' : 'success');
            document.getElementById('eventDetailsModal').style.display = 'none';
            if (typeof loadAdminApprovals === 'function') loadAdminApprovals(); 
            if (typeof loadDashboardData === 'function') loadDashboardData().catch(e=>{});
        }
    } catch (error) {}
}

/* ============================================================
   ADMIN DASHBOARD FEATURES
============================================================ */
async function loadAdminMembers() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        const myOrg = (currentUser && currentUser.position) ? currentUser.position.split(' - ')[0] : null;

        const response = await fetch('https://backend-88na.onrender.com/api/users');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('adminMembersBody');
            if (tbody) {
                let users = data.users;
                if (myOrg) {
                    users = users.filter(u => u.position && u.position.startsWith(myOrg));
                }

                if (users.length > 0) {
                    let html = '';
                    users.forEach(u => {
                        let roleColor = 'var(--text2)';
                        if (u.role === 'admin') roleColor = 'var(--danger)';
                        if (u.role === 'administrative') roleColor = '#f39c12'; 
                        if (u.role === 'member') roleColor = 'var(--green)';

                        let actions = '';
                        if (u.role !== 'admin') {
                            actions = `<button class="btn btn-outline btn-sm" style="border-color:var(--danger); color:var(--danger); padding:4px 8px; font-size:11px;" onclick="removeUser(${u.id})">Remove</button>`;
                            
                            if (u.role === 'member') {
                                actions = `<button class="btn btn-outline btn-sm" style="border-color:var(--green); color:var(--green); margin-right:6px; padding:4px 8px; font-size:11px;" onclick="upgradeUser(${u.id})">Make Admin Asst</button>` + actions;
                            } else if (u.role === 'administrative') {
                                actions = `<button class="btn btn-outline btn-sm" style="border-color:#f39c12; color:#f39c12; margin-right:6px; padding:4px 8px; font-size:11px;" onclick="demoteUser(${u.id})">Revoke Admin Asst</button>` + actions;
                            }
                        } else { actions = `<span style="font-size:10px; color:var(--text3);">System Administrator</span>`; }

                        html += `<tr>
                            <td class="bold">${u.full_name}</td>
                            <td>${u.email}<br><span style="font-size:10px;color:var(--text3);">${u.contact_number || 'No contact'}</span></td>
                            <td><span style="font-size:11px; font-weight:800; color:${roleColor}; text-transform:uppercase;">${u.role}</span></td>
                            <td>${new Date(u.created_at).toLocaleDateString()}</td>
                            <td>${actions}</td>
                        </tr>`;
                    });
                    tbody.innerHTML = html;
                } else tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No users found in your organization.</td></tr>";
            }
        }
    } catch (error) {}
}

function filterAdminMembers() {
    const input = document.getElementById('memberSearchInput');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('adminMembersBody');
    const trs = tbody.getElementsByTagName('tr');

    for (let i = 0; i < trs.length; i++) {
        const td = trs[i].getElementsByTagName('td')[0];
        if (td) {
            const nameValue = td.textContent || td.innerText;
            trs[i].style.display = nameValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
        }
    }
}

async function upgradeUser(userId) {
    if(!confirm("Promote this member to Administrative Assistant?")) return;
    try {
        const res = await fetch('https://backend-88na.onrender.com/api/users/upgrade', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId}) });
        const data = await res.json();
        if(data.success) { showToast('User promoted successfully!', 'success'); loadAdminMembers(); } 
    } catch(e) {}
}

async function demoteUser(userId) {
    if(!confirm("Revoke Administrative Assistant privileges? They will return to a standard Member.")) return;
    try {
        const res = await fetch('https://backend-88na.onrender.com/api/users/demote', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId}) });
        const data = await res.json();
        if(data.success) { showToast('Admin privileges revoked.', 'info'); loadAdminMembers(); } 
    } catch(e) {}
}

async function removeUser(userId) {
    if(!confirm("WARNING: Are you sure you want to permanently delete this user from the system?")) return;
    try {
        const res = await fetch('https://backend-88na.onrender.com/api/users/remove', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId}) });
        const data = await res.json();
        if(data.success) { showToast('User removed from system.', 'success'); loadAdminMembers(); } 
    } catch(e) {}
}

async function loadWorkloadRanking() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        const myOrg = (currentUser && currentUser.position) ? currentUser.position.split(' - ')[0] : null;

        // ⚡ FIX: Added cache-buster to instantly pull fresh data!
        const response = await fetch(`https://backend-88na.onrender.com/api/workload-ranking?_nocache=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            let ranking = data.ranking;
            if (myOrg) {
                ranking = ranking.filter(u => u.position && u.position.startsWith(myOrg));
            }

            // Save the ranking globally so the 3rd column can render the Org Members
            window.ORG_MEMBERS_WORKLOAD = ranking;
            if (typeof renderMemberWorkload === 'function') renderMemberWorkload();

            const tbody = document.getElementById('workloadRankingBody');
            if (tbody) {
                if (ranking.length > 0) {
                    let html = '';
                    ranking.forEach(user => {
                        let workloadColor = user.active_tasks >= 4 ? '#e74c3c' : (user.active_tasks >= 2 ? '#f39c12' : 'var(--green)');
                        let workloadText = user.active_tasks >= 4 ? 'HIGH' : (user.active_tasks >= 2 ? 'MED' : 'LOW');
                        
                        html += `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 14px 4px;">
                                <div style="font-weight:700; color:var(--text1); font-size:14px;">${user.full_name}</div>
                                <div style="font-size:11px; color:var(--text3); margin-top:2px;">${user.position || 'Unassigned Role'}</div>
                            </td>
                            <td style="text-align:right; padding: 14px 4px; width: 60px;">
                                <div style="font-size:18px; font-family:'Syne', sans-serif; font-weight:800; color:${workloadColor}; line-height: 1;">${user.active_tasks}</div>
                                <div style="font-size:9px; font-weight:800; color:${workloadColor}; background:${workloadColor}15; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:4px;">${workloadText}</div>
                            </td>
                        </tr>`;
                    });
                    tbody.innerHTML = html;
                } else { tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px; font-size:12px; color:var(--text3);">No active members found.</td></tr>'; }
            }
        }
    } catch (e) {}
}

let isSchedDragging = false, schedDragMode = 'busy';

document.addEventListener('mouseup', () => isSchedDragging = false);

function renderMySchedule() {
    try {
        const tbody = document.getElementById('myScheduleBody');
        if (!tbody) return; 
        
        let html = '';
        let startHour = 7;
        let endHour = 17;

        if (window.schedRules && window.schedRules.startTime && window.schedRules.endTime) {
            let st = String(window.schedRules.startTime);
            let en = String(window.schedRules.endTime);
            
            startHour = parseInt(st.split(':')[0]);
            endHour = parseInt(en.split(':')[0]);
            
            if(isNaN(startHour)) startHour = 7;
            if(isNaN(endHour)) endHour = 17;

            if (endHour < startHour && endHour <= 12) {
                endHour += 12;
            }
        }

        for (let hour = startHour; hour <= endHour; hour++) {
            const displayHour = hour > 12 ? `${hour-12} PM` : (hour === 12 ? '12 PM' : `${hour} AM`);
            
            html += `<tr><td class="isched-time" style="padding-right:15px; font-weight:600; color:var(--text3); font-size:12px; white-space:nowrap;">${displayHour}</td>`;
            for (let day = 0; day < 6; day++) { 
                html += `<td class="isched-cell" data-day="${day}" data-hour="${hour}"></td>`; 
            }
            html += `</tr>`;
        }
        
        tbody.innerHTML = html;

        document.querySelectorAll('.isched-cell').forEach(cell => {
            cell.addEventListener('mousedown', (e) => { 
                e.preventDefault(); 
                isSchedDragging = true; 
                schedDragMode = cell.classList.contains('busy') ? 'free' : 'busy'; 
                cell.classList.toggle('busy'); 
            });
            cell.addEventListener('mouseenter', () => { 
                if (isSchedDragging) { 
                    if (schedDragMode === 'busy') cell.classList.add('busy'); 
                    else cell.classList.remove('busy'); 
                } 
            });
        });
    } catch(e) { console.error("Error drawing schedule table:", e); }
}

async function saveMySchedule() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if(!currentUser) return;
    try {
        const res = await fetch('https://backend-88na.onrender.com/api/schedule', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, schedule: window.mySchedule })
        });
        const data = await res.json();
        if(data.success) showToast('Schedule saved successfully!', 'success');
        else showToast('Failed to save schedule', 'error');
    } catch(e) { showToast('Server error', 'error'); }
}

async function loadSavedSchedule() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if(!currentUser) return;
    try {
        const res = await fetch(`https://backend-88na.onrender.com/api/schedule/${currentUser.id}`);
        const data = await res.json();
        if(data.success && data.schedule) {
            window.mySchedule = typeof data.schedule === 'string' ? JSON.parse(data.schedule) : data.schedule;
            
            document.querySelectorAll('.isched-cell').forEach(cell => {
                const day = cell.getAttribute('data-day');
                const hour = cell.getAttribute('data-hour');
                const key = `${day}-${hour}`;
                if(window.mySchedule[key]) {
                    cell.classList.add('busy');
                }
            });
        }
    } catch(e) {}
}


let currentCalDate = new Date();
window.calendarMode = window.calendarMode || 'year'; // Start in Year View

function changeCalMonth(direction) {
    if (window.calendarMode === 'year') {
        currentCalDate.setFullYear(currentCalDate.getFullYear() + direction);
    } else {
        currentCalDate.setMonth(currentCalDate.getMonth() + direction);
    }
    renderMasterCalendar();
}

function selectCalendarMonth(m) {
    window.calendarMode = 'month';
    currentCalDate.setMonth(m);
    renderMasterCalendar();
}

function backToYearView() {
    window.calendarMode = 'year';
    renderMasterCalendar();
}

function renderMasterCalendar() {
    try {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return; 
        
        const monthYearLabel = document.getElementById('calendarMonthYear');

        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        const today = new Date();

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        const myOrg = (currentUser && currentUser.position) ? String(currentUser.position).split(' - ')[0] : null;
        const events = window.cachedEvents || [];

        const visibleEvents = events.filter(ev => {
            let matchesOrg = isEventForMyOrg(ev, myOrg);
            let isVisibleStatus = true;

            if (currentUser && currentUser.role === 'member') {
                isVisibleStatus = (ev.status.toLowerCase() === 'approved');
            } else if (currentUser && currentUser.role === 'requester') {
                matchesOrg = true;
                isVisibleStatus = (ev.status.toLowerCase() === 'approved'); 
            } else {
                isVisibleStatus = (ev.status.toLowerCase() !== 'rejected');
            }
            
            return matchesOrg && isVisibleStatus;
        });

        if (window.calendarMode === 'year') {
            if (monthYearLabel) monthYearLabel.innerHTML = `${year}`;

            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
            grid.style.gap = '15px';
            grid.style.border = 'none';
            grid.style.background = 'transparent';

            let html = '';
            for (let m = 0; m < 12; m++) {
                const monthEvents = visibleEvents.filter(ev => {
                    const ed = new Date(ev.event_date);
                    return ed.getMonth() === m && ed.getFullYear() === year;
                });
                
                const evtCount = monthEvents.length;
                let badgeHtml = evtCount > 0 ? 
                    `<div style="margin-top:12px; display:inline-block; background:var(--green); color:#fff; font-size:11px; font-weight:700; padding:4px 10px; border-radius:99px;">${evtCount} Event${evtCount > 1 ? 's' : ''}</div>` : 
                    `<div style="margin-top:12px; display:inline-block; background:var(--bg2); color:var(--text3); border:1px solid var(--border); font-size:11px; font-weight:600; padding:3px 10px; border-radius:99px;">No Events</div>`;

                let isCurrentMonth = (m === today.getMonth() && year === today.getFullYear());
                let haloStyle = evtCount > 0 
                    ? 'background-color: #f0faf4; box-shadow: 0 0 15px rgba(27, 163, 84, 0.15); border: 1px solid rgba(27, 163, 84, 0.4);' 
                    : 'background:#fff; border: 1px solid var(--border); box-shadow:0 2px 8px rgba(0,0,0,0.02);';
                
                if (isCurrentMonth && evtCount === 0) haloStyle = 'background:#fff; border: 2px solid var(--green); box-shadow:0 2px 8px rgba(0,0,0,0.02);';
                if (isCurrentMonth && evtCount > 0) haloStyle = 'background-color: #f0faf4; box-shadow: 0 0 15px rgba(27, 163, 84, 0.2); border: 2px solid var(--green);';

                html += `
                <div onclick="selectCalendarMonth(${m})" style="${haloStyle} border-radius:12px; padding:24px 15px; text-align:center; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 15px rgba(27,163,84,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='';">
                    <div style="font-family:'Syne', sans-serif; font-size:18px; font-weight:700; color:var(--text1);">${monthNames[m]}</div>
                    ${badgeHtml}
                </div>`;
            }
            grid.innerHTML = html;

        } else {
            if (monthYearLabel) {
                monthYearLabel.innerHTML = `
                    <span onclick="backToYearView()" style="font-size:9px; color:var(--text3); text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; padding: 3px 8px; border: 1px solid var(--border); border-radius: 4px; display:inline-block; line-height: 1; transition:0.2s;" onmouseover="this.style.background='var(--border)'; this.style.color='var(--text1)';" onmouseout="this.style.background='transparent'; this.style.color='var(--text3)';">
                        ⬆️ View Whole Year
                    </span>
                    <div style="margin-top: 6px;">${monthNames[month]} ${year}</div>
                `;
            }

            grid.style.display = '';
            grid.style.gridTemplateColumns = ''; 
            grid.style.gap = '';
            grid.style.border = '';
            grid.style.background = '';

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDayOfWeek = new Date(year, month, 1).getDay();

            let html = '';
            const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            dayHeaders.forEach(d => html += `<div class="cal-header">${d}</div>`);

            let emptySlots = firstDayOfWeek === 0 ? 0 : firstDayOfWeek - 1;
            for (let i = 0; i < emptySlots; i++) {
                html += `<div class="cal-day empty"></div>`;
            }

            let renderedDays = 0;

            for (let i = 1; i <= daysInMonth; i++) {
                let currentDate = new Date(year, month, i);
                if (currentDate.getDay() === 0) continue; 
                
                renderedDays++;
                let isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
                
                const dayEvents = visibleEvents.filter(ev => {
                    const evDate = new Date(ev.event_date);
                    return evDate.getDate() === i && evDate.getMonth() === month && evDate.getFullYear() === year;
                });

                let haloStyle = '';
                if (dayEvents.length > 0) {
                    haloStyle = `background-color: #f0faf4; box-shadow: inset 0 0 15px rgba(27, 163, 84, 0.1); border: 1px solid rgba(27, 163, 84, 0.3);`;
                }
                if (isToday) {
                    haloStyle += ` border: 2px solid var(--green);`; 
                }

                let dayHtml = `<div class="cal-day ${isToday ? 'today' : ''}" style="${haloStyle}"><div class="cal-date">${i}</div>`;

                dayEvents.forEach(ev => {
                    let statusClass = ev.status.toLowerCase();
                    let timeStr = ev.start_time.substring(0, 5); 
                    let hour = parseInt(timeStr.split(':')[0]);
                    let ampm = hour >= 12 ? 'PM' : 'AM';
                    hour = hour % 12 || 12;
                    let displayTime = `${hour}:${timeStr.split(':')[1]} ${ampm}`;

                    dayHtml += `<div class="cal-event ${statusClass}" onclick="event.stopPropagation(); viewEventDetails(${ev.id})" title="${ev.title}">🕒 ${displayTime} - ${ev.title}</div>`;
                });

                dayHtml += `</div>`;
                html += dayHtml;
            }

            const totalCells = emptySlots + renderedDays;
            const remainder = totalCells % 6;
            if (remainder !== 0) {
                for(let i = 0; i < (6 - remainder); i++) {
                     html += `<div class="cal-day empty"></div>`;
                }
            }

            grid.innerHTML = html;
        }
    } catch(e) { console.error("Error drawing calendar:", e); }
}

async function loadDashboardData() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        if (!currentUser) return;
        
        const response = await fetch(`https://backend-88na.onrender.com/api/events?_nocache=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            let events = data.events;

            if (currentUser.role === 'requester') {
                events = events.filter(ev => ev.requester_id === currentUser.id);
            } else if (currentUser.role === 'admin' || currentUser.role === 'administrative' || currentUser.role === 'member') {
                const myOrg = currentUser.position ? currentUser.position.split(' - ')[0] : null;
                events = events.filter(ev => isEventForMyOrg(ev, myOrg));
            }
            events.sort((a, b) => b.id - a.id);
            
            window.cachedEvents = events; 

            if (currentUser.role === 'member' || currentUser.role === 'administrative' || currentUser.role === 'admin') {
                
                const today = new Date();
                today.setHours(0,0,0,0);
                
                let formattedEvents = events.map(e => {
                    const eDate = new Date(e.event_date);
                    eDate.setHours(0,0,0,0); 
                    
                    const daysLeft = Math.round((eDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return {
                        name: e.title,
                        date: eDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        status: e.status === 'approved' ? 'Approved' : 'Pending',
                        rawStatus: e.status,
                        daysLeft: daysLeft,
                        ts: eDate.getTime(),
                        barPct: Math.max(5, 100 - (Math.max(0, daysLeft) * 5))
                    };
                });
                
                window.UPCOMING_EVENTS = formattedEvents.filter(e => e.daysLeft >= 0 && e.rawStatus !== 'rejected');
                window.APPROVED_REQUESTS = formattedEvents.filter(e => e.rawStatus === 'approved');
                
                if (typeof renderUpcomingEvents === 'function') renderUpcomingEvents();
                if (typeof renderApprovedRequests === 'function') renderApprovedRequests();
            }

            const tbody = document.getElementById('reqTableBody');
            if (tbody) {
                if (events.length > 0) {
                    let html = '';
                    events.forEach(ev => {
                        let rowStatus = ev.status.toUpperCase();
                        if (ev.status === 'pending_admin') rowStatus = 'AWAITING FINAL APPROVAL';
                        if (ev.status === 'awaiting_initial_admin') rowStatus = 'AWAITING INITIAL APPROVAL';
                        
                        html += `
                        <tr onclick="viewEventDetails(${ev.id})" style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='rgba(27,163,84,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td class="bold"><span style="color:var(--green); font-weight:700;">${ev.title}</span><br><span style="font-size:10px;color:var(--text3);">${ev.event_type || 'Event'}</span></td>
                            <td>${ev.requester_name || 'Unknown'}</td>
                            <td>${new Date(ev.event_date).toLocaleDateString()}<br><span style="font-size:10px;color:var(--text3);">${ev.start_time}</span></td>
                            <td>${ev.venue}</td>
                            <td><span class="status s-${ev.status.toLowerCase()}">${rowStatus}</span></td>
                        </tr>`;
                    });
                    tbody.innerHTML = html;
                } else tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 20px; color: var(--text3);'>No event requests found.</td></tr>";
            }

            const homePreview = document.getElementById('homeEventsPreview');
            if (homePreview) {
                if (events.length > 0) {
                    let recentHtml = `<table style="width:100%; text-align:left;">`;
                    events.slice(0, 3).forEach(ev => {
                        let prevStatus = ev.status.toUpperCase();
                        if (ev.status === 'pending_admin') prevStatus = 'AWAITING FINAL APPROVAL';
                        if (ev.status === 'awaiting_initial_admin') prevStatus = 'AWAITING INITIAL APPROVAL';

                        recentHtml += `
                        <tr style="border-bottom: 1px solid var(--border2); cursor:pointer; transition: background 0.2s;" onclick="viewEventDetails(${ev.id})" onmouseover="this.style.backgroundColor='rgba(27,163,84,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td style="padding: 10px;">
                                <div class="bold" style="color:var(--green);">${ev.title}</div>
                                <div style="font-size:11px; color:var(--text3);">${new Date(ev.event_date).toLocaleDateString()} • ${ev.venue}</div>
                            </td>
                            <td style="text-align:right; padding-right:10px;">
                                <span class="status s-${ev.status.toLowerCase()}">${prevStatus}</span>
                            </td>
                        </tr>`;
                    });
                    recentHtml += `</table>`;
                    homePreview.innerHTML = recentHtml;
                } else homePreview.innerHTML = "No recent events to display.";
            }
            
            if (typeof renderMasterCalendar === "function") renderMasterCalendar();
        }
    } catch (error) { 
        console.error("Data load failed."); 
        const tbody = document.getElementById('reqTableBody');
        if(tbody) tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px; color:var(--text3);'>Waking up server... (Please wait up to 30s)</td></tr>";
    }
}

async function loadDashboardStats() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        const myOrg = (currentUser && currentUser.position && (currentUser.role === 'admin' || currentUser.role === 'administrative')) ? currentUser.position.split(' - ')[0] : null;

        const response = await fetch(`https://backend-88na.onrender.com/api/events?_nocache=${Date.now()}`);
        const data = await response.json();
        
        const usersRes = await fetch(`https://backend-88na.onrender.com/api/users?_nocache=${Date.now()}`);
        const usersData = await usersRes.json();
        
        if (data.success && usersData.success) {
            let events = data.events;
            let users = usersData.users.filter(u => u.role === 'member' || u.role === 'administrative');
            
            if (myOrg) {
                events = events.filter(ev => isEventForMyOrg(ev, myOrg));
                users = users.filter(u => u.position && u.position.startsWith(myOrg));
            }
            
            const totalEvents = events.length;
            const pendingEvents = events.filter(e => e.status === 'pending_admin' || e.status === 'awaiting_initial_admin').length;
            const approvedEvents = events.filter(e => e.status === 'approved').length;
            const totalMembers = users.length;
            
            if(document.getElementById('statTotalEvents')) document.getElementById('statTotalEvents').textContent = totalEvents;
            if(document.getElementById('statPendingEvents')) document.getElementById('statPendingEvents').textContent = pendingEvents;
            if(document.getElementById('statApprovedEvents')) document.getElementById('statApprovedEvents').textContent = approvedEvents;
            if(document.getElementById('statTotalMembers')) document.getElementById('statTotalMembers').textContent = totalMembers;
        }
    } catch (error) {}
}

async function loadAdministrativeApprovals() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        const myOrg = currentUser.position ? currentUser.position.split(' - ')[0] : null;

        const response = await fetch(`https://backend-88na.onrender.com/api/events?_nocache=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            const pendingEvents = data.events.filter(ev => ev.status.toLowerCase() === 'pending' && isEventForMyOrg(ev, myOrg)).sort((a, b) => b.id - a.id);
            const tbody = document.getElementById('adminRosterBody');
            if (tbody) {
                if (pendingEvents.length > 0) {
                    let html = '';
                    pendingEvents.forEach(ev => {
                        html += `
                        <tr onclick="viewEventDetails(${ev.id})" style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='rgba(27,163,84,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td class="bold"><span style="color:var(--green); font-weight:700;">${ev.title}</span><br><span style="font-size:10px;color:var(--text3);">${ev.venue}</span></td>
                            <td>${ev.requester_name || 'Unknown'}</td>
                            <td>${new Date(ev.event_date).toLocaleDateString()} at ${ev.start_time}</td>
                            <td><span class="status s-pending">PENDING ROSTER</span></td>
                        </tr>`;
                    });
                    tbody.innerHTML = html;
                } else tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 20px; color: var(--text3);'>No events waiting for roster.</td></tr>";
            }
        }
    } catch (error) {
        const tbody = document.getElementById('adminRosterBody');
        if(tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px; color:var(--text3);'>Waking up server...</td></tr>";
    }
}

async function loadAdminApprovals() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        const myOrg = currentUser.position ? currentUser.position.split(' - ')[0] : null;

        const response = await fetch(`https://backend-88na.onrender.com/api/events?_nocache=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            const pendingEvents = data.events.filter(ev => (ev.status.toLowerCase() === 'pending_admin' || ev.status.toLowerCase() === 'awaiting_initial_admin') && isEventForMyOrg(ev, myOrg)).sort((a, b) => b.id - a.id);
            const tbody = document.getElementById('adminApprovalsBody');
            
            if (tbody) {
                if (pendingEvents.length > 0) {
                    let html = '';
                    pendingEvents.forEach(ev => {
                        let statusHtml = ev.status === 'awaiting_initial_admin' ? 
                            `<span class="status" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba;">NEEDS INITIAL APPROVAL</span>` :
                            `<span class="status" style="background:#cce5ff; color:#004085; border:1px solid #b8daff;">NEEDS FINAL APPROVAL</span>`;
                            
                        let btnText = ev.status === 'awaiting_initial_admin' ? 'Review Request' : 'Review & Deploy';

                        html += `
                        <tr onclick="viewEventDetails(${ev.id})" style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='rgba(27,163,84,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td class="bold"><span style="color:var(--green); font-weight:700;">${ev.title}</span><br><span style="font-size:10px;color:var(--text3);">${ev.venue}</span></td>
                            <td>${ev.requester_name || 'Unknown'}</td>
                            <td>${new Date(ev.event_date).toLocaleDateString()} at ${ev.start_time}</td>
                            <td>${statusHtml}</td>
                            <td><button class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); viewEventDetails(${ev.id})">${btnText}</button></td>
                        </tr>`;
                    });
                    tbody.innerHTML = html;
                } else tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 20px; color: var(--text3);'>No pending requests. You're all caught up!</td></tr>";
            }
        }
    } catch (error) {
        const tbody = document.getElementById('adminApprovalsBody');
        if(tbody) tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px; color:var(--text3);'>Waking up server...</td></tr>";
    }
}

async function loadMemberOpportunities() {
    const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
    if(!currentUser || (currentUser.role !== 'member' && currentUser.role !== 'administrative' && currentUser.role !== 'admin')) return;

    const container = document.getElementById('ccaaTasks');
    const acceptedContainer = document.getElementById('myAssignedTasks');

    try {
        const res = await fetch(`https://backend-88na.onrender.com/api/allocations/member/${currentUser.id}?_nocache=${Date.now()}`);
        const data = await res.json();

        if(data.success) {
            const pendingTasks = data.tasks.filter(t => t.status === 'notified' && (t.event_status === 'pending' || t.event_status === 'awaiting_initial_admin' || t.event_status === 'pending_admin'));
            
            const todayTs = new Date().setHours(0,0,0,0);
            
            const acceptedTasks = data.tasks.filter(t => {
                const taskDateTs = new Date(t.event_date).setHours(0,0,0,0);
                if (taskDateTs < todayTs) return false;

                if (t.event_status === 'approved') return t.status === 'assigned';
                if (t.event_status === 'rejected') return false; 
                if (t.event_status === 'pending_admin' || t.event_status === 'awaiting_initial_admin') return t.status === 'rostered' || t.status === 'assigned';
                return t.status === 'accepted' || t.status === 'assigned' || t.status === 'rostered';
            });

            window.MEMBER_WORKLOAD.role = currentUser.position || currentUser.role.toUpperCase();
            window.MEMBER_WORKLOAD.max = (window.algoRules && window.algoRules.maxWorkload) ? window.algoRules.maxWorkload : 10;
            
            const activeForWorkload = data.tasks.filter(t => {
                const taskDateTs = new Date(t.event_date).setHours(0,0,0,0);
                return taskDateTs >= todayTs && (t.status === 'assigned' || t.status === 'accepted');
            });
            
            window.MEMBER_WORKLOAD.current = activeForWorkload.length;
            window.MEMBER_WORKLOAD.tasks = activeForWorkload.map(t => {
                const d = new Date(t.event_date);
                return {
                    name: `Coverage: ${t.required_role || 'Member'}`,
                    event: t.title,
                    dueDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    dueTs: d.getTime()
                };
            });
            if (typeof renderMemberWorkload === 'function') renderMemberWorkload();
            if(document.getElementById('statMyPending')) document.getElementById('statMyPending').textContent = pendingTasks.length;

            if(container) {
                if(pendingTasks.length > 0) {
                    let html = '';
                    pendingTasks.forEach(t => {
                        html += `
                        <div onclick="viewEventDetails(${t.event_id})" style="background:#fff; border:2px dashed var(--green); padding:20px; border-radius:12px; margin-bottom:16px; position:relative; overflow:hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--green-dark)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--green)'; this.style.transform='translateY(0)'">
                            <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:var(--green);"></div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap: wrap; gap: 16px;">
                                <div>
                                    <div style="font-size:11px; font-weight:800; color:var(--green); text-transform:uppercase; margin-bottom:6px;">New Coverage Match</div>
                                    <strong style="color:var(--text1); font-size: 18px; font-family: 'Syne', sans-serif;">${t.title}</strong>
                                    <div style="margin-top:10px; font-size:13px; color:var(--text2); display:flex; flex-direction:column; gap:6px;">
                                        <span style="display: flex; align-items: center; gap: 8px;"><b>Date:</b> ${new Date(t.event_date).toLocaleDateString()} @ ${t.start_time}</span>
                                        <span style="display: flex; align-items: center; gap: 8px;"><b>Venue:</b> ${t.venue}</span>
                                        <span style="display: flex; align-items: center; gap: 8px; margin-top: 4px;"><b>Requested Role:</b> <span style="background: rgba(27,163,84,0.1); color: var(--green-dark); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">${t.required_role}</span></span>
                                    </div>
                                </div>
                                <div style="display:flex; flex-direction:column; gap: 8px; min-width: 140px;">
                                    <button class="btn btn-primary" style="padding:12px; width:100%; justify-content:center; font-size:13px;" onclick="event.stopPropagation(); acceptCcaaTask(${t.id})">✅ Accept Task</button>
                                    <button class="btn" style="background:transparent; border:1.5px solid #d02020; color:#d02020; padding:12px; width:100%; justify-content:center; font-size:13px;" onclick="event.stopPropagation(); declineCcaaTask(${t.id})">❌ Decline</button>
                                </div>
                            </div>
                        </div>`;
                    });
                    container.innerHTML = html;
                } else {
                    container.innerHTML = "<div style='background: #fff; border: 1px dashed var(--border); border-radius: 12px; padding: 30px; text-align: center; color: var(--text3);'><div>No new requests at the moment. You're all caught up!</div></div>";
                }
            }

            if(acceptedContainer) {
                if(acceptedTasks.length > 0) {
                    let html = '';
                    acceptedTasks.forEach(t => {
                        let badge = t.status === 'assigned' ? 
                            '<span style="background:#cce5ff; color:#004085; padding:4px 8px; border-radius:99px; font-size:10px; font-weight:bold;">✅ OFFICIALLY ASSIGNED</span>' : 
                            '<span style="background:#ffeeba; color:#856404; padding:4px 8px; border-radius:99px; font-size:10px; font-weight:bold;">⏳ AWAITING ADMIN</span>';
                        
                        html += `
                        <div onclick="viewEventDetails(${t.event_id})" style="background:#fff; border:1px solid var(--border); padding:16px; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--green)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)'">
                            <div>
                                <strong style="color:var(--text1); font-size: 15px;">${t.title}</strong><br>
                                <span style="font-size:12px; color:var(--text3);">${new Date(t.event_date).toLocaleDateString()} @ ${t.start_time} • ${t.venue}</span><br>
                                <span style="font-size:12px; font-weight:700; color:var(--accent); display:inline-block; margin-top:4px;">My Role: ${t.required_role}</span>
                            </div>
                            <div>${badge}</div>
                        </div>`;
                    });
                    acceptedContainer.innerHTML = html;
                } else acceptedContainer.innerHTML = "<div style='padding:20px; text-align:center; color:var(--text3); font-size:14px;'>You haven't accepted any tasks yet.</div>";
            }

            const memberServiceList = document.getElementById('memberServiceTasksList');
            if (memberServiceList) {
                const assignedForService = data.tasks.filter(t => t.status === 'assigned');
                if (assignedForService.length > 0) {
                    let serviceHtml = '';
                    assignedForService.forEach(t => {
                        
                        const realEvent = window.cachedEvents ? window.cachedEvents.find(ev => ev.id === t.event_id) : null;
                        
                        const rawStat = t.service_status || (realEvent ? realEvent.service_status : null) || '';
                        const currentStat = rawStat.toString().trim().toLowerCase();
                        
                        const rawDate = t.posting_date || (realEvent ? realEvent.posting_date : null);
                        const currentDate = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';
                        
                        let badgeColor = '#f4f4f4', badgeText = '#888', badgeLabel = 'AWAITING STATUS';
                        if (currentStat === 'upcoming') { badgeColor = '#ffe6cc'; badgeText = '#cc6600'; badgeLabel = 'Upcoming'; }
                        else if (currentStat === 'pending') { badgeColor = '#fff3cd'; badgeText = '#856404'; badgeLabel = 'Pending'; }
                        else if (currentStat === 'ongoing') { badgeColor = '#e2f0ff'; badgeText = '#0066cc'; badgeLabel = 'Ongoing'; }
                        else if (currentStat === 'completed') { 
                            badgeColor = '#d4edda'; badgeText = '#155724'; 
                            const pDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'TBD';
                            badgeLabel = `Completed - To be posted on ${pDate}`; 
                        }
                        
                        serviceHtml += `
                        <div class="service-card" style="background: #fff; border: 1.5px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                          <div class="service-card-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                            <div>
                              <h3 class="service-card-title" style="margin:0; font-size:16px;">${t.title}</h3>
                              <div style="font-size: 12px; color: #555555; margin-top: 4px;">Role: ${t.required_role}</div>
                            </div>
                            <span class="status-badge" style="background: ${badgeColor}; color: ${badgeText}; font-weight: bold; padding: 4px 10px; border-radius: 99px; font-size: 11px; text-transform: uppercase;">${badgeLabel}</span>
                          </div>
                          
                          <div class="service-card-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                            <div class="service-meta-item">
                              <div class="service-meta-label" style="font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase;">Event Date & Time</div>
                              <div class="service-meta-value" style="font-size: 14px; color: #111; font-weight: 600;">${new Date(t.event_date).toLocaleDateString()} • ${t.start_time}</div>
                            </div>
                            <div class="service-meta-item">
                              <div class="service-meta-label" style="font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase;">Venue</div>
                              <div class="service-meta-value" style="font-size: 14px; color: #111; font-weight: 600;">${t.venue}</div>
                            </div>
                          </div>

                          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed #e0e0e0;">
                            <div class="service-meta-label" style="margin-bottom: 12px; color: #1BA354; font-weight: bold; font-size: 12px; text-transform: uppercase;">Update Progress Status</div>
                            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                              
                              <select id="svc_status_${t.event_id}" class="form-input" style="width: auto; min-height: 40px; padding: 8px 14px; font-size: 13px; border: 1px solid #e0e0e0; border-radius: 8px;" onchange="togglePostingDate(this)">
                                <option value="" ${!currentStat ? 'selected' : ''} disabled>-- Select Status --</option>
                                <option value="upcoming" ${currentStat === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                                <option value="pending" ${currentStat === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="ongoing" ${currentStat === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                                <option value="completed" ${currentStat === 'completed' ? 'selected' : ''}>Completed</option>
                              </select>
                              
                              <div class="posting-date-container" style="display: ${currentStat === 'completed' ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                                  <span style="font-size: 12px; color: #555; font-weight: 700; text-transform: uppercase;">Posting Date:</span>
                                  <input type="date" id="svc_date_${t.event_id}" value="${currentDate}" class="form-input" style="width: auto; min-height: 40px; padding: 8px 14px; font-size: 13px; border: 1px solid #e0e0e0; border-radius: 8px;">
                              </div>

                              <button style="padding: 10px 18px; background-color: #1BA354; color: #ffffff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(27,163,84,0.2);" onclick="updateServiceStatus(${t.event_id})">Save Update</button>
                            </div>
                          </div>
                        </div>`;
                    });
                    memberServiceList.innerHTML = serviceHtml;
                } else {
                    memberServiceList.innerHTML = `
                      <div style="text-align:center; padding: 40px 20px; color: var(--text3);">
                        <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
                        <div style="font-size: 14px;">You have no active service tasks to update.</div>
                      </div>`;
                }
            }

        }
    } catch(e) {
        if(container) container.innerHTML = "<div style='background:#fff; border:1px dashed var(--border); border-radius:12px; padding:30px; text-align:center; color:var(--text3);'>Waking up server... (Please wait up to 30s)</div>";
        if(acceptedContainer) acceptedContainer.innerHTML = "<div style='padding:20px; text-align:center; color:var(--text3); font-size:14px;'>Waking up server... (Please wait up to 30s)</div>";
    }
}

async function loadRequesterData() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('dd_currentUser'));
        
        const response = await fetch(`https://backend-88na.onrender.com/api/events?_nocache=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            window.cachedEvents = data.events;
            const myEvents = data.events.filter(ev => ev.requester_id === currentUser.id).sort((a, b) => b.id - a.id);
            
            if (document.getElementById('reqStatTotal')) document.getElementById('reqStatTotal').textContent = myEvents.length;
            if (document.getElementById('reqStatPending')) document.getElementById('reqStatPending').textContent = myEvents.filter(e => e.status.toLowerCase() === 'pending' || e.status.toLowerCase() === 'pending_admin' || e.status.toLowerCase() === 'awaiting_initial_admin').length;
            if (document.getElementById('reqStatApproved')) document.getElementById('reqStatApproved').textContent = myEvents.filter(e => e.status.toLowerCase() === 'approved').length;

            const ticketBody = document.getElementById('myTicketsBody');
            if (ticketBody) {
                if (myEvents.length > 0) {
                    let html = '';
                    myEvents.forEach(ev => { 
                        let displayStat = ev.status.toUpperCase();
                        if (ev.status === 'pending_admin') displayStat = 'AWAITING FINAL APPROVAL';
                        if (ev.status === 'awaiting_initial_admin') displayStat = 'AWAITING INITIAL APPROVAL';

                        html += `
                        <tr onclick="viewEventDetails(${ev.id})" style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='rgba(27,163,84,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td class="bold"><span style="color:var(--green); font-weight:700;">${ev.title}</span></td>
                            <td>${new Date(ev.event_date).toLocaleDateString()} @ ${ev.start_time}</td>
                            <td>${ev.venue}</td>
                            <td><span class="status s-${ev.status.toLowerCase()}">${displayStat}</span></td>
                        </tr>`; 
                    });
                    ticketBody.innerHTML = html;
                } else ticketBody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>You haven't submitted any tickets yet.</td></tr>";
            }
            
            const approvedEvents = data.events.filter(ev => ev.status.toLowerCase() === 'approved').sort((a, b) => new Date(a.event_date) - new Date(b.event_date)); 
            const calBody = document.getElementById('approvedEventsBody');
            if (calBody) {
                if (approvedEvents.length > 0) {
                    let calHtml = '';
                    approvedEvents.forEach(ev => { 
                        calHtml += `
                        <tr onclick="viewEventDetails(${ev.id})" style="cursor:pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='rgba(27,163,84,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td class="bold"><span style="color:var(--green); font-weight:700;">${ev.title}</span></td>
                            <td>${new Date(ev.event_date).toLocaleDateString()}</td>
                            <td>${ev.start_time}</td>
                            <td>${ev.venue}</td>
                        </tr>`; 
                    });
                    calBody.innerHTML = calHtml;
                } else calBody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No upcoming approved events.</td></tr>";
            }

            const serviceTrackingList = document.getElementById('serviceTrackingList');
            if (serviceTrackingList) {
                const activeServices = myEvents.filter(e => e.status.toLowerCase() === 'approved');
                if (activeServices.length > 0) {
                    let trackingHtml = '';
                    activeServices.forEach(ev => {
                        
                        const svcStat = (ev.service_status || '').toString().trim().toLowerCase();
                        let badgeColor = '#f4f4f4', badgeText = '#888', badgeLabel = 'AWAITING STATUS';
                        
                        if (svcStat === 'upcoming') { badgeColor = '#ffe6cc'; badgeText = '#cc6600'; badgeLabel = 'Upcoming'; }
                        else if (svcStat === 'pending') { badgeColor = '#fff3cd'; badgeText = '#856404'; badgeLabel = 'Pending'; }
                        else if (svcStat === 'ongoing') { badgeColor = '#e2f0ff'; badgeText = '#0066cc'; badgeLabel = 'Ongoing'; }
                        else if (svcStat === 'completed') { 
                            badgeColor = '#d4edda'; badgeText = '#155724'; 
                            const pDate = ev.posting_date ? new Date(ev.posting_date).toLocaleDateString() : 'TBD';
                            badgeLabel = `Completed - To be posted on ${pDate}`; 
                        }

                        trackingHtml += `
                        <div class="service-card">
                          <div class="service-card-header">
                            <div>
                              <h3 class="service-card-title">${ev.title}</h3>
                              <div style="font-size: 12px; color: var(--text2); margin-top: 4px;">Request ID: ${ev.req_code || 'TKT-' + ev.id}</div>
                            </div>
                            <span class="status-badge" style="background: ${badgeColor}; color: ${badgeText};">${badgeLabel}</span>
                          </div>
                          <div class="service-card-meta">
                            <div class="service-meta-item">
                              <div class="service-meta-label">Event Date & Time</div>
                              <div class="service-meta-value">${new Date(ev.event_date).toLocaleDateString()} • ${ev.start_time}</div>
                            </div>
                            <div class="service-meta-item">
                              <div class="service-meta-label">Venue</div>
                              <div class="service-meta-value">${ev.venue}</div>
                            </div>
                          </div>
                        </div>`;
                    });
                    serviceTrackingList.innerHTML = trackingHtml;
                } else {
                    serviceTrackingList.innerHTML = `
                      <div style="text-align:center; padding: 40px 20px; color: var(--text3);">
                        <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
                        <div style="font-size: 14px;">No active services to track yet.</div>
                      </div>`;
                }
            }

        }
    } catch (error) {
        const ticketBody = document.getElementById('myTicketsBody');
        if (ticketBody) ticketBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 20px; color: var(--text3);'>Waking up server... (Please wait up to 30s)</td></tr>";
        const calBody = document.getElementById('approvedEventsBody');
        if (calBody) calBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 20px; color: var(--text3);'>Waking up server... (Please wait up to 30s)</td></tr>";
    }
}