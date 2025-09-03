let appData = {};
let voterHistory = {};
let currentPortal = null;
let activePollId = null;
let pendingAction = null;
const MASTER_KEY = 'siddarth@2006';
let lastDeletedItem = null;
let undoTimeout = null;

function checkMasterKey(inputElement) {
    if (inputElement.value === MASTER_KEY) {
        inputElement.classList.add('master-key-active');
    } else {
        inputElement.classList.remove('master-key-active');
    }
}

const showToast = (message, type = 'info', undoCallback = null) => {
    clearTimeout(undoTimeout);
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    if (undoCallback) {
        const undoButton = document.createElement('button');
        undoButton.className = 'toast-undo-btn';
        undoButton.textContent = 'Undo';
        undoButton.onclick = () => {
            undoCallback();
            toast.remove();
            clearTimeout(undoTimeout);
        };
        toast.appendChild(undoButton);
    }
    toastContainer.appendChild(toast);
    undoTimeout = setTimeout(() => {
        toast.remove();
        if (undoCallback) {
            lastDeletedItem = null; // Clear the undo state if the toast times out
        }
    }, 7000);
};

const saveData = () => localStorage.setItem('pollBridgeData', JSON.stringify(appData));
const loadData = () => {
    const saved = localStorage.getItem('pollBridgeData');
    appData = saved ? JSON.parse(saved) : {};
    if (!appData['Student Portal']) {
        appData['Student Portal'] = { polls: [], password: '12345', permanent: true };
    }
    if (!appData['Panchayat Portal']) {
        appData['Panchayat Portal'] = { polls: [], password: '12345', permanent: true };
    }
};

const loadVoterHistory = () => {
    const history = localStorage.getItem('pollBridgeVoterHistory');
    voterHistory = history ? JSON.parse(history) : {};
    if (!voterHistory['Student Portal']) {
        voterHistory['Student Portal'] = [];
    }
    if (!voterHistory['Panchayat Portal']) {
        voterHistory['Panchayat Portal'] = [];
    }
};

const saveVoterHistory = () => localStorage.setItem('pollBridgeVoterHistory', JSON.stringify(voterHistory));
const hasVoted = (pollId) => { return voterHistory[currentPortal] && voterHistory[currentPortal].includes(pollId); };
const addPollToVotedList = (pollId) => { if (!voterHistory[currentPortal]) { voterHistory[currentPortal] = []; } if (!voterHistory[currentPortal].includes(pollId)) { voterHistory[currentPortal].push(pollId); saveVoterHistory(); } };

function renderPortalList() {
    const portalListDiv = document.getElementById('portalList');
    const noPortalsMessage = document.getElementById('noPortalsMessage');
    const portalNames = Object.keys(appData);
    if (portalNames.length === 0) {
        noPortalsMessage.classList.remove('hidden');
        portalListDiv.innerHTML = '';
    } else {
        noPortalsMessage.classList.add('hidden');
        portalListDiv.innerHTML = portalNames.map(name => {
            const portal = appData[name];
            let checkboxHTML = '';
            if (!portal.permanent) {
                checkboxHTML = `<input type="checkbox" class="portal-delete-checkbox" value="${name}" title="Mark for deletion">`;
            } else {
                checkboxHTML = `<div style="width:20px; flex-shrink:0;"></div>`; // Placeholder for alignment
            }
            return `<div class="portal-item">${checkboxHTML}<button class="btn-secondary portal-button" onclick="initializePortal('${name}')">${name}</button></div>`;
        }).join('');
    }
}

function createPortal() {
    const portalNameInput = document.getElementById('portalNameInput');
    const passwordInput = document.getElementById('portalAdminPasswordInput');
    const portalName = portalNameInput.value.trim();
    const portalPassword = passwordInput.value.trim();
    if (!portalName) return showToast("Please enter a name for your portal.", "error");
    if (!portalPassword) return showToast("Please set an admin password for the portal.", "error");
    if (appData[portalName]) return showToast("A portal with this name already exists.", "error");
    appData[portalName] = { polls: [], password: portalPassword, permanent: false };
    voterHistory[portalName] = [];
    saveData();
    saveVoterHistory();
    showToast(`Portal "${portalName}" created successfully!`, "success");
    portalNameInput.value = '';
    passwordInput.value = '';
    initializePortal(portalName);
}

function returnToPortalSelection() {
    document.getElementById('roleSelectionView').classList.add('hidden');
    document.getElementById('pollMasterView').classList.add('hidden');
    document.getElementById('voterView').classList.add('hidden');
    document.getElementById('headerNav').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('hidden');
    renderPortalList();
    currentPortal = null;
}

function initializePortal(portalName) {
    currentPortal = portalName;
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('roleSelectionView').classList.remove('hidden');
    document.getElementById('roleSelectionTitle').innerText = `Portal: ${portalName}`;
}

function showView(role) {
    document.getElementById('roleSelectionView').classList.add('hidden');
    document.getElementById('headerNav').classList.remove('hidden');
    if (role === 'master') {
        document.getElementById('pollMasterView').classList.remove('hidden');
        renderPollMasterList();
    } else {
        document.getElementById('voterView').classList.remove('hidden');
        renderVoterPollList();
    }
}

function returnToRoleSelection() {
    document.getElementById('pollMasterView').classList.add('hidden');
    document.getElementById('voterView').classList.add('hidden');
    document.getElementById('headerNav').classList.add('hidden');
    document.getElementById('roleSelectionView').classList.remove('hidden');
}

const addOption = () => {
    const container = document.getElementById('optionsContainer');
    const optionGroup = document.createElement('div');
    optionGroup.className = 'option-group';
    optionGroup.innerHTML = `<input class="optionInput" type="text" placeholder="Another option" /><button class="remove-option" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(optionGroup);
};

function createPoll() {
    const question = document.getElementById('question').value.trim();
    const options = Array.from(document.querySelectorAll('.optionInput')).map(i => i.value.trim()).filter(Boolean);
    const voteLimit = parseInt(document.getElementById('voteLimit').value.trim());
    const password = document.getElementById('pollPassword').value.trim();
    const allowMultiple = document.getElementById('allowMultipleSelections').checked;
    const pollType = allowMultiple ? 'multiple' : 'single';
    if (!question || options.length < 2) return showToast('Need a question and at least 2 options.', 'error');
    if (!password) return showToast('Please set a password to manage this poll.', 'error');
    const poll = { id: Date.now() + Math.random(), question, options, password, votes: [], comments: [], status: 'open', type: pollType, voteLimit: isNaN(voteLimit) ? null : voteLimit };
    appData[currentPortal].polls.unshift(poll);
    saveData();
    renderPollMasterList();
    showToast('Poll launched successfully!', 'success');
    document.getElementById('question').value = '';
    document.getElementById('voteLimit').value = '';
    document.getElementById('pollPassword').value = '';
    document.getElementById('allowMultipleSelections').checked = false;
    document.getElementById('optionsContainer').innerHTML = `<div class="option-group"><input class="optionInput" type="text" placeholder="Option 1" /><button class="remove-option" onclick="this.parentElement.remove()">×</button></div><div class="option-group"><input class="optionInput" type="text" placeholder="Option 2" /><button class="remove-option" onclick="this.parentElement.remove()">×</button></div>`;
}

function renderPollMasterList() {
    const allPolls = appData[currentPortal].polls;
    const activePolls = allPolls.filter(p => p.status !== 'archived');
    const archivedPolls = allPolls.filter(p => p.status === 'archived');
    const renderList = (polls) => polls.map(p => {
        const total = p.votes.length;
        const isClosed = p.status === 'closed';
        let buttons = `<button onclick="secureAction('viewResults', ${p.id})" class="btn-secondary">Results</button><button onclick="secureAction('togglePollStatus', ${p.id})" class="btn-secondary">${isClosed ? 'Resume' : 'End'}</button><button onclick="secureAction('archivePoll', ${p.id})" class="btn-secondary">Archive</button>`;
        if (p.status === 'archived') {
            buttons = `<button onclick="secureAction('unarchivePoll', ${p.id})" class="btn-secondary">Unarchive</button><button onclick="exportPollAsCSV(${p.id})" class="btn-secondary">CSV</button><button onclick="exportPollAsJSON(${p.id})" class="btn-secondary">JSON</button><button onclick="secureAction('deletePoll', ${p.id})" class="btn-danger">Delete</button>`;
        } else if (!isClosed) {
            buttons += `<button onclick="exportPollAsCSV(${p.id})" class="btn-secondary">CSV</button><button onclick="exportPollAsJSON(${p.id})" class="btn-secondary">JSON</button>`;
        }
        let typeText = p.type === 'multiple' ? 'Multiple-Choice' : 'Single-Choice';
        return `<div class="poll-item"><div><h3>${p.question}</h3><p>Type: <strong>${typeText}</strong> | Votes: <strong>${total}</strong> | Status: <strong>${p.status.toUpperCase()}</strong></p></div><div class="poll-item-actions">${buttons}</div></div>`;
    }).join('');
    document.getElementById('pollList').innerHTML = activePolls.length ? renderList(activePolls) : '<p>No active polls.</p>';
    document.getElementById('archivedPollList').innerHTML = archivedPolls.length ? renderList(archivedPolls) : '<p>No archived polls.</p>';
}

function secureAction(action, id) {
    pendingAction = { action, id };
    document.getElementById('passwordModalTitle').innerText = 'Enter Poll Password';
    document.getElementById('passwordModalPrompt').innerText = 'To manage this poll, please enter the password you set for it.';
    document.getElementById('passwordModal').classList.add('active');
}

function requestPollMasterAccess() {
    pendingAction = { action: 'enterPollMasterView' };
    document.getElementById('passwordModalTitle').innerText = 'Poll Master Access';
    document.getElementById('passwordModalPrompt').innerText = `Enter the admin password for the "${currentPortal}" portal to continue.`;
    document.getElementById('passwordModal').classList.add('active');
}

function confirmPassword() {
    const entered = document.getElementById('passwordInput').value.trim();
    let isCorrect = false;
    if (pendingAction.action === 'enterPollMasterView') {
        const portal = appData[currentPortal];
        if (portal && (entered === portal.password || entered === MASTER_KEY)) { isCorrect = true; }
    } else if (pendingAction.action === 'deletePortal') {
        const portal = appData[pendingAction.portalName];
        if (portal && (entered === portal.password || entered === MASTER_KEY)) { isCorrect = true; }
    } else if (pendingAction.action === 'selectiveReset') {
        if (entered === MASTER_KEY) { isCorrect = true; }
    } else {
        const poll = appData[currentPortal].polls.find(p => p.id === pendingAction.id);
        if (poll && (entered === poll.password || entered === MASTER_KEY)) { isCorrect = true; }
    }
    if (isCorrect) {
        if (pendingAction.action === 'enterPollMasterView') {
            showView('master');
        } else if (pendingAction.action === 'deletePortal') {
            deletePortal(pendingAction.portalName);
        } else if (pendingAction.action === 'selectiveReset') {
            performSelectiveReset(pendingAction.portalsToDelete);
        } else {
            const { action, id } = pendingAction;
            if (action === 'viewResults') viewResults(id);
            if (action === 'togglePollStatus') togglePollStatus(id);
            if (action === 'deletePoll') deletePoll(id);
            if(action === 'archivePoll') archivePoll(id);
            if(action === 'unarchivePoll') unarchivePoll(id);
        }
        if (entered === MASTER_KEY) {
            showToast('Master Key has been used', 'info');
        } else {
            if (pendingAction.action === 'deletePoll') {
                showToast('Poll permanently deleted.', 'success', () => undoDeletion());
            } else if (pendingAction.action === 'deletePortal') {
                showToast(`Portal "${pendingAction.portalName}" has been deleted.`, 'success', () => undoDeletion());
            } else if (pendingAction.action === 'selectiveReset') {
                showToast('Selected portals deleted.', 'success', () => undoDeletion());
            }
        }
        closePasswordModal();
    } else {
        let errorMsg = 'Incorrect Password.';
        if (pendingAction.action === 'selectiveReset') { errorMsg = 'Incorrect Master Key.'; } else if (['deletePortal', 'enterPollMasterView'].includes(pendingAction.action)) { errorMsg = 'Incorrect admin password for this portal.'; } else { errorMsg = 'Incorrect password for this poll.'; }
        showToast(errorMsg, 'error');
    }
}

const closePasswordModal = () => {
    const passwordInput = document.getElementById('passwordInput');
    passwordInput.value = '';
    passwordInput.classList.remove('master-key-active');
    document.getElementById('passwordModal').classList.remove('active');
    pendingAction = null;
};

const togglePollStatus = (id) => {
    const poll = appData[currentPortal].polls.find(p => p.id === id);
    if (poll) {
        poll.status = poll.status === 'open' ? 'closed' : 'open';
        saveData();
        renderPollMasterList();
        renderVoterPollList();
        showToast(`Poll is now ${poll.status}.`, 'info');
    }
};

function viewResults(id) {
    const poll = appData[currentPortal].polls.find(p => p.id === id);
    if (!poll) return;
    document.getElementById('resultQuestion').innerText = poll.question;
    const total = poll.votes.length;
    let counts = new Array(poll.options.length).fill(0);
    poll.votes.forEach(v => counts[v]++);
    document.getElementById('resultTotalVotes').innerText = `Total Votes (selections): ${total}`;
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `<ul>${poll.options.map((opt, i) => { const percentage = total ? (counts[i] / total * 100) : 0; return `<li><strong>${opt}:</strong> ${counts[i]} votes (${percentage.toFixed(1)}%)<div class="progress-bar"><div class="progress" style="width: ${percentage}%"></div></div></li>`; }).join('')}</ul>`;
    document.getElementById('commentsList').innerHTML = poll.comments.length ? poll.comments.map(c => `<li>"${c}"</li>`).join('') : '<li>No comments submitted.</li>';
    document.getElementById('resultsView').classList.add('active');
}

const closeResults = () => document.getElementById('resultsView').classList.remove('active');

function selectVoteOption(cardElement, isMultipleChoice) {
    if (isMultipleChoice) {
        cardElement.classList.toggle('selected');
        const checkbox = cardElement.querySelector('.hidden-radio');
        checkbox.checked = !checkbox.checked;
    } else {
        document.querySelectorAll('.vote-option-card').forEach(card => card.classList.remove('selected'));
        cardElement.classList.add('selected');
        cardElement.querySelector('.hidden-radio').checked = true;
    }
}

function openVoteModal(id) {
    activePollId = id;
    const poll = appData[currentPortal].polls.find(p => p.id === id);
    if (!poll) return;
    document.getElementById('voteQuestion').innerText = poll.question;
    const voterNum = poll.votes.length + 1;
    document.getElementById('voterNumber').innerText = poll.voteLimit ? `You are voter #${voterNum} of ${poll.voteLimit}` : `You are voter #${voterNum}`;
    const isMultiple = poll.type === 'multiple';
    const inputType = isMultiple ? 'checkbox' : 'radio';
    const optionsHTML = poll.options.map((opt, i) => `<div class="vote-option-card" onclick="selectVoteOption(this, ${isMultiple})"><input type="${inputType}" name="vote" value="${i}" class="hidden-radio">${opt}</div>`).join('');
    document.getElementById('voteModalContent').innerHTML = `${optionsHTML}<br><textarea id="comment" placeholder="Add an anonymous comment (optional)..."></textarea>`;
    document.getElementById('voteModal').classList.add('active');
}

function submitVote() {
    const poll = appData[currentPortal].polls.find(p => p.id === activePollId);
    if (!poll) return;
    if (poll.voteLimit && poll.votes.length >= poll.voteLimit) {
        showToast('Vote limit reached, this poll is now closed.', 'error');
        closeModal();
        renderVoterPollList();
        return;
    }
    const selectedOptions = document.querySelectorAll('input[name="vote"]:checked');
    if (selectedOptions.length === 0) return showToast('Please select an option to vote.', 'error');
    selectedOptions.forEach(option => {
        poll.votes.push(parseInt(option.value));
    });
    const comment = document.getElementById('comment').value.trim();
    if (comment) poll.comments.push(comment);
    addPollToVotedList(activePollId);
    saveData();
    closeModal();
    renderVoterPollList();
    showToast('Your vote has been cast successfully!', 'success');
}

const renderVoterPollList = () => {
    const list = document.getElementById('voterPollList');
    const polls = appData[currentPortal].polls.filter(p => p.status === 'open');
    if (!polls.length) {
        list.innerHTML = '<p>No polls are available at the moment. Check back soon!</p>';
        return;
    }
    list.innerHTML = polls.map(p => {
        const userHasVoted = hasVoted(p.id);
        let cls = '', action = '', badge = '';
        if (userHasVoted) {
            cls = 'voted';
            action = `showToast('You have already voted in this poll.', 'info')`;
            badge = `<span class="status-badge voted"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Voted</span>`;
        } else {
            action = `openVoteModal(${p.id})`;
            badge = `<span class="status-badge open">Open</span>`;
        }
        let typeText = p.type === 'multiple' ? 'Multiple-Choice' : 'Single-Choice';
        return `<div class="poll-card ${cls}" onclick="${action}">${badge}<h3>${p.question}</h3><p>${typeText}</p></div>`;
    }).join('');
};

const closeModal = () => {
    document.getElementById('voteModal').classList.remove('active');
    activePollId = null;
};

function downloadFile(filename, text) { const element = document.createElement('a'); element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)); element.setAttribute('download', filename); element.style.display = 'none'; document.body.appendChild(element); element.click(); document.body.removeChild(element); }
function exportPollAsCSV(pollId) { const poll = appData[currentPortal].polls.find(p => p.id === pollId); if (!poll) return; let csvContent = `Question,"${poll.question.replace(/"/g, '""')}"\n\n`; csvContent += "Option,Votes,Percentage\n"; const total = poll.votes.length; const counts = new Array(poll.options.length).fill(0); poll.votes.forEach(v => counts[v]++); poll.options.forEach((opt, i) => { const percentage = total ? ((counts[i] / total * 100).toFixed(1) + '%') : '0.0%'; csvContent += `"${opt.replace(/"/g, '""')}",${counts[i]},${percentage}\n`; }); if (poll.comments.length > 0) { csvContent += "\nComments\n"; poll.comments.forEach(c => { csvContent += `"${c.replace(/"/g, '""')}"\n`; }); } const filename = `${poll.question.substring(0, 20).replace(/[\s\W]+/g, '-')}-results.csv`; downloadFile(filename, csvContent); }
function exportPollAsJSON(pollId) { const poll = appData[currentPortal].polls.find(p => p.id === pollId); if (!poll) return; const jsonContent = JSON.stringify(poll, null, 2); const filename = `${poll.question.substring(0, 20).replace(/[\s\W]+/g, '-')}.json`; downloadFile(filename, jsonContent); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled'); }
function requestSelectiveReset() { const portalsToDelete = Array.from(document.querySelectorAll('.portal-delete-checkbox:checked')).map(cb => cb.value); if (portalsToDelete.length === 0) { return showToast('Please select at least one portal to delete.', 'error'); } pendingAction = { action: 'selectiveReset', portalsToDelete }; document.getElementById('passwordModalTitle').innerText = 'Confirm Deletion'; document.getElementById('passwordModalPrompt').innerText = `This will permanently delete ${portalsToDelete.length} portal(s). This is irreversible. Please enter the Master Key to confirm.`; document.getElementById('passwordModal').classList.add('active'); }
function performSelectiveReset(portalsToDelete) { lastDeletedItem = { type: 'portals', data: [] }; portalsToDelete.forEach(name => { lastDeletedItem.data.push({ name, data: appData[name] }); delete appData[name]; delete voterHistory[name]; }); saveData(); saveVoterHistory(); renderPortalList(); }
function archivePoll(id){ const poll = appData[currentPortal].polls.find(p=>p.id===id); if(poll){ poll.status = 'archived'; saveData(); renderPollMasterList(); } }
function unarchivePoll(id){ const poll = appData[currentPortal].polls.find(p=>p.id===id); if(poll){ poll.status = 'closed'; saveData(); renderPollMasterList(); } }
function deletePoll(id) { const pollIndex = appData[currentPortal].polls.findIndex(p=>p.id===id); if(pollIndex > -1){ lastDeletedItem = { type: 'poll', data: appData[currentPortal].polls[pollIndex], portal: currentPortal, index: pollIndex }; appData[currentPortal].polls.splice(pollIndex, 1); saveData(); renderPollMasterList(); renderVoterPollList(); } }
function deletePortal(portalName) { lastDeletedItem = { type: 'portal', data: { name: portalName, data: appData[portalName] } }; delete appData[portalName]; delete voterHistory[portalName]; saveData(); saveVoterHistory(); renderPortalList(); }
function undoDeletion(){ if(!lastDeletedItem) return; if(lastDeletedItem.type === 'poll'){ appData[lastDeletedItem.portal].polls.splice(lastDeletedItem.index, 0, lastDeletedItem.data); } else if (lastDeletedItem.type === 'portal') { appData[lastDeletedItem.data.name] = lastDeletedItem.data.data; } else if (lastDeletedItem.type === 'portals') { lastDeletedItem.data.forEach(p => appData[p.name] = p.data); } saveData(); renderPollMasterList(); renderPortalList(); lastDeletedItem = null; showToast('Action undone.', 'success'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (document.getElementById('voteModal').classList.contains('active')) closeModal(); if (document.getElementById('resultsView').classList.contains('active')) closeResults(); if (document.getElementById('passwordModal').classList.contains('active')) closePasswordModal(); } });
document.addEventListener('DOMContentLoaded', () => { if (localStorage.getItem('darkMode') === 'enabled') { document.body.classList.add('dark-mode'); } loadData(); loadVoterHistory(); renderPortalList(); });