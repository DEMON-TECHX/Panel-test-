const socket = io();

// DOM elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const adminSection = document.getElementById('admin-section');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const logDisplay = document.getElementById('log-display');
const commandInput = document.getElementById('command-input');
const sendButton = document.getElementById('send-command');
const getUsersBtn = document.getElementById('get-users-btn');
const userList = document.getElementById('user-list');
const userIdInput = document.getElementById('user-id-input');
const loginInterface = document.getElementById('login-interface');
const listBtn = document.getElementById('list-btn');
const clearBtn = document.getElementById('clear-btn');
const restartBtn = document.getElementById('restart-btn');
const serverRuntime = document.getElementById('server-runtime');
const togglePasswordBtn = document.getElementById('toggle-password');
const passwordStrength = document.getElementById('password-strength');
const passwordRequirements = document.getElementById('password-requirements');
const searchUsersInput = document.getElementById('search-users');
const paginationContainer = document.getElementById('pagination');
const actionSelect = document.getElementById('action-select');
const executeActionBtn = document.getElementById('execute-action-btn');
const spaceUsage = document.getElementById('space-usage');
const activeUsers = document.getElementById('active-users');
const fileList = document.getElementById('file-list');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const cpuUsage = document.getElementById('cpu-usage');
const memoryUsage = document.getElementById('memory-usage');
const diskUsage = document.getElementById('disk-usage');
const totalUsers = document.getElementById('total-users');
const activeSessions = document.getElementById('active-sessions');
const bannedUsers = document.getElementById('banned-users');
const logoutBtn = document.getElementById('logout-btn');
const loadingSection = document.getElementById('loading-section');

let currentUserId = null;
let isAdmin = false;
let allUsers = [];
let currentPage = 1;
const usersPerPage = 10;
let isScriptRunning = false;

function appendLog(message, target = logDisplay) {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logEntry.classList.add('log-entry', 'fade-in');
    target.appendChild(logEntry);
    target.scrollTop = target.scrollHeight;
}

function showAppSection() {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const username = Object.keys(users).find(name => users[name].id === currentUserId) || 'BLUExDEMON TECH 🌹';
    
    loadingSection.classList.add('hidden');
    authSection.classList.add('hidden');
    loginInterface.classList.add('hidden');
    appSection.classList.remove('hidden');
    if (isAdmin) {
        adminSection.classList.remove('hidden');
    }
    
    // Add username display above terminal
    const usernameDisplay = document.createElement('div');
    usernameDisplay.textContent = `Terminal - ${username}`;
    usernameDisplay.classList.add('text-lg', 'font-bold', 'mb-2', 'text-green-500');
    logDisplay.parentNode.insertBefore(usernameDisplay, logDisplay);
    
    // Display BLUE ID message and user's UID
    appendLog("This is your ID👇");
    appendLog(`${currentUserId}`);
    
    setTimeout(() => {
        socket.emit('start', currentUserId);
        socket.emit('getServerRuntime');
        socket.emit('getFileList', currentUserId);
    }, 500);
}

function logout() {
    currentUserId = null;
    isAdmin = false;
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('isAdmin');
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    adminSection.classList.add('hidden');
    appendLog('Logged out successfully');
}

function checkExistingSession() {
    currentUserId = localStorage.getItem('currentUserId');
    isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (currentUserId) {
        loadingSection.classList.remove('hidden');
        authSection.classList.add('hidden');
        appSection.classList.add('hidden');
        socket.emit('validateSession', { userId: currentUserId, isAdmin: isAdmin });
    } else {
        loadingSection.classList.add('hidden');
        authSection.classList.remove('hidden');
    }
}

function persistLogin(userId, isAdmin) {
    localStorage.setItem('currentUserId', userId);
    localStorage.setItem('isAdmin', isAdmin);
}

function getClientId() {
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = 'client_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('clientId', clientId);
    }
    return clientId;
}

function togglePasswordVisibility() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePasswordBtn.innerHTML = type === 'password' ? 
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" /></svg>' : 
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>';
}

function checkPasswordStrength() {
    const password = passwordInput.value;
    passwordRequirements.classList.remove('hidden');
    
    if (password.length >= 7) {
        passwordStrength.textContent = 'Password strength: Strong';
        passwordStrength.className = 'mb-2 text-sm text-green-500';
        return true;
    } else {
        passwordStrength.textContent = 'Password strength: Weak';
        passwordStrength.className = 'mb-2 text-sm text-red-500';
        return false;
    }
}

function displayUsers(users) {
  userList.innerHTML = `
    <div class="p-2 border-b border-gray-600 font-bold">Total Users: ${users.length} / 40</div>
    <div class="text-red-500 font-bold p-2">⚠️ Warning: Displaying passwords is a severe security risk!</div>
  `;
  users.forEach(user => {
    const userElement = document.createElement('div');
    userElement.textContent = `Username: ${user.username}, ID: ${user.id}, Admin: ${user.isAdmin}, Password: ${user.password}`;
    userElement.classList.add('p-2', 'border-b', 'border-gray-600');
    userList.appendChild(userElement);
  });
}

function filterUsers() {
    const searchTerm = searchUsersInput.value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm) || 
        user.id.toLowerCase().includes(searchTerm)
    );
    displayUsers(filteredUsers);
    setupPagination(filteredUsers);
}

function setupPagination(users) {
    const pageCount = Math.ceil(users.length / usersPerPage);
    paginationContainer.innerHTML = '';
    
    for (let i = 1; i <= pageCount; i++) {
        const button = document.createElement('button');
        button.innerText = i;
        button.classList.add('px-3', 'py-1', 'bg-gray-700', 'hover:bg-gray-600', 'rounded');
        button.addEventListener('click', () => {
            currentPage = i;
            displayUsers(users.slice((i - 1) * usersPerPage, i * usersPerPage));
        });
        paginationContainer.appendChild(button);
    }
}

function updateFileList(files) {
    fileList.innerHTML = '';
    files.forEach(file => {
        const li = document.createElement('li');
        const lastModified = new Date(file.lastModified).toLocaleString();
        li.innerHTML = `
            <span class="${file.type === 'folder' ? 'font-bold' : ''}">${file.name}</span>
            <span class="text-sm text-gray-400 ml-2">${formatFileSize(file.size)}</span>
            <span class="text-sm text-gray-400 ml-2">${lastModified}</span>
        `;
        li.classList.add(file.type, 'cursor-pointer', 'p-2', 'hover:bg-gray-700', 'flex', 'justify-between', 'items-center');
        li.dataset.path = file.name;
        li.addEventListener('click', () => {
            fileList.querySelectorAll('li').forEach(item => item.classList.remove('selected', 'bg-blue-600'));
            li.classList.add('selected', 'bg-blue-600');
        });
        fileList.appendChild(li);
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    else return (bytes / 1073741824).toFixed(2) + ' GB';
}

function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

function showScriptRunning() {
    isScriptRunning = true;
    document.getElementById('script-status').classList.remove('hidden');
}

function hideScriptRunning() {
    isScriptRunning = false;
    document.getElementById('script-status').classList.add('hidden');
}

// Event Listeners
registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (username && password) {
        if (currentUserId) {
            appendLog('You are already logged in. Please log out to create a new account.', loginInterface);
        } else if (!checkPasswordStrength()) {
            appendLog('Password must be at least 7 characters long.', loginInterface);
        } else {
            loginInterface.classList.remove('hidden');
            loginInterface.innerHTML = '';
            appendLog('Registering...', loginInterface);
            socket.emit('register', { username, password, clientId: getClientId() });
        }
    } else {
        loginInterface.classList.remove('hidden');
        loginInterface.innerHTML = '';
        appendLog('Please enter both username and password', loginInterface);
    }
});

loginBtn.addEventListener('click', () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    if (username && password) {
        loginInterface.classList.remove('hidden');
        loginInterface.innerHTML = '';
        appendLog('Logging in...', loginInterface);
        socket.emit('login', { username, password });
    } else {
        loginInterface.classList.remove('hidden');
        loginInterface.innerHTML = '';
        appendLog('Please enter both username and password', loginInterface);
    }
});

sendButton.addEventListener('click', () => {
    const command = commandInput.value.trim();

    if (!currentUserId) {
        appendLog('Please log in first');
        return;
    }

    if (!command) {
        appendLog('Please enter a command');
        return;
    }

    if (isScriptRunning && !command.startsWith('/')) {
        appendLog('Script is running. Use / commands to interact.');
        return;
    }

    socket.emit('command', { userId: currentUserId, message: command });
    commandInput.value = '';
});

document.getElementById('install-btn').addEventListener('click', () => {
    if (currentUserId) {
        socket.emit('command', { userId: currentUserId, message: 'install' });
    } else {
        appendLog('Please log in first');
    }
});

document.getElementById('start-btn').addEventListener('click', () => {
    if (currentUserId) {
        socket.emit('command', { userId: currentUserId, message: 'start' });
        showScriptRunning();
    } else {
        appendLog('Please log in first');
    }
});

document.getElementById('stop-btn').textContent = 'PAUSE⏸️';
document.getElementById('stop-btn').addEventListener('click', () => {
    if (currentUserId) {
        socket.emit('command', { userId: currentUserId, message: 'pause' });
        hideScriptRunning();
    } else {
        appendLog('Please log in first');
    }
});

clearBtn.addEventListener('click', () => {
    if (currentUserId) {
        socket.emit('command', { userId: currentUserId, message: 'clear' });
    } else {
        appendLog('Please log in first');
    }
});


getUsersBtn.addEventListener('click', () => {
    if (isAdmin) {
        socket.emit('adminGetUsers');
    }
});

executeActionBtn.addEventListener('click', () => {
    if (isAdmin) {
        const userId = userIdInput.value;
        const action = actionSelect.value;
        if (userId && action) {
            switch (action) {
                case 'ban':
                    socket.emit('adminBanUser', userId);
                    break;
                case 'unban':
                    socket.emit('adminUnbanUser', userId);
                    break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                        socket.emit('adminDeleteUser', userId);
                    }
                    break;
                default:
                    appendLog('Invalid action selected');
            }
        } else {
            appendLog('Please enter a User ID and select an action');
        }
    }
});

darkModeToggle.addEventListener('click', toggleDarkMode);

// Socket event listeners
socket.on('registerResponse', (response) => {
    if (response.success) {
        currentUserId = response.userId;
        localStorage.setItem('currentUserId', currentUserId);
        localStorage.setItem('isAdmin', 'false');
        appendLog(`Registered successfully. Your user BLUE ID is: ${currentUserId}`, loginInterface);
        showAppSection();
    } else {
        appendLog(`Registration failed: ${response.message}`, loginInterface);
    }
});

socket.on('loginResponse', (response) => {
    if (response.success) {
        currentUserId = response.userId;
        isAdmin = response.isAdmin;
        persistLogin(currentUserId, isAdmin);
        appendLog(`Logged in successfully. Your user ID is: ${currentUserId}`, loginInterface);
        showAppSection();
    } else {
        appendLog(`Login failed: ${response.message}`, loginInterface);
    }
});

socket.on('sessionValidated', (response) => {
    if (response.valid) {
        showAppSection();
        appendLog(`Welcome back!😊😊`);
    } else {
        logout();
        loadingSection.classList.add('hidden');
        authSection.classList.remove('hidden');
        appendLog('Your session has expired. Please log in again.');
    }
});

socket.on('message', (message) => {
    if (typeof message === 'object' && message.type === 'spaceUsage') {
        spaceUsage.textContent = `${message.usage}`;
    } else if (message === 'Script started') {
        showScriptRunning();
        appendLog(message);
    } else if (message === 'Script ended') {
        hideScriptRunning();
        appendLog(message);
    } else if (message !== "This is your ID") {
        appendLog(message);
    }
    // Automatically scroll to the bottom of the log display
    logDisplay.scrollTop = logDisplay.scrollHeight;

    // Check for specific messages and update UI accordingly
    if (message.includes('Yarn install finished with code 0')) {
        document.getElementById('start-btn').disabled = false;
        document.getElementById('start-btn').classList.remove('opacity-50');
    } else if (message.includes('No package.json found')) {
        document.getElementById('install-btn').disabled = true;
        document.getElementById('install-btn').classList.add('opacity-50');
    }
});

socket.on('adminUserList', ({ users, totalUserCount }) => {
    allUsers = users;
    displayUsers(users.slice(0, usersPerPage));
    setupPagination(users);
});

socket.on('adminBanResponse', (response) => {
    appendLog(response.message);
});

socket.on('adminUnbanResponse', (response) => {
    appendLog(response.message);
});

socket.on('adminDeleteUserResponse', (response) => {
    appendLog(response.message);
    if (response.success) {
        // Refresh the user list if the deletion was successful
        socket.emit('adminGetUsers');
    }
});

socket.on('serverRuntime', (runtime) => {
    serverRuntime.textContent = `${runtime}`;
});

socket.on('fileList', (files) => {
    updateFileList(files);
});

socket.on('systemStatus', (status) => {
    cpuUsage.innerHTML = `CPU Usage: <span class="font-bold">${status.cpu}%</span>`;
    memoryUsage.innerHTML = `Memory Usage: <span class="font-bold">${status.memory}%</span>`;
    diskUsage.innerHTML = `Disk Usage: <span class="font-bold">${status.disk}%</span>`;
});

socket.on('userStats', (stats) => {
    totalUsers.innerHTML = `Total Users: <span class="font-bold">${stats.total}</span>`;
    activeSessions.innerHTML = `Active Sessions: <span class="font-bold">${stats.active}</span>`;
    bannedUsers.innerHTML = `Banned Users: <span class="font-bold">${stats.banned}</span>`;
    activeUsers.textContent = stats.active;
});

logoutBtn.addEventListener('click', logout);
togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
passwordInput.addEventListener('input', checkPasswordStrength);
searchUsersInput.addEventListener('input', filterUsers);

const uploadForm = document.getElementById('upload-form');
const startProjectBtn = document.getElementById('start-project-btn');

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    formData.append('userId', currentUserId);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.text();
        appendLog(result);
        socket.emit('command', { userId: currentUserId, message: 'list' });
    } catch (error) {
        console.error('Error:', error);
        appendLog('Error uploading file');
    }
});

startProjectBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/start-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentUserId })
        });
        const result = await response.text();
        appendLog(result);
    } catch (error) {
        console.error('Error:', error);
        appendLog('Error starting project');
    }
});


// Initialize
checkExistingSession();
if (localStorage.getItem('darkMode') === 'light') {
    toggleDarkMode();
}

// Periodically update server runtime and system status
setInterval(() => {
    socket.emit('getServerRuntime');
    if (isAdmin) {
        socket.emit('getSystemStatus');
        socket.emit('getUserStats');
    }
}, 5000);

function fetchRandomQuote() {
    fetch('./quotes.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(quotes => {
            const randomIndex = Math.floor(Math.random() * quotes.length);
            const randomQuote = quotes[randomIndex];
            document.getElementById('quote-text').textContent = `${randomQuote.quote}`;
            document.getElementById('quote-author').textContent = `- ${randomQuote.author}`;
        })
        .catch(error => {
            console.error('Error fetching quote:', error);
            document.getElementById('quote-text').textContent = 'Failed to load quote';
            document.getElementById('quote-author').textContent = '';
        });
}

// Fetch a new quote every 60 seconds
setInterval(fetchRandomQuote, 60000);

// Initial quote fetch
fetchRandomQuote();

// Audio playback
const backgroundAudio = document.getElementById('backgroundAudio');
const audioControl = document.getElementById('audioControl');
let isAudioPlaying = false;

function toggleAudio() {
    if (isAudioPlaying) {
        backgroundAudio.pause();
        isAudioPlaying = false;
        audioControl.textContent = 'Play Audio';
    } else {
        backgroundAudio.play().catch(error => {
            console.error('Audio playback failed:', error);
        });
        isAudioPlaying = true;
        audioControl.textContent = 'Pause Audio';
    }
}

// Try to play audio on page load
document.addEventListener('DOMContentLoaded', () => {
    const playPromise = backgroundAudio.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isAudioPlaying = true;
            audioControl.textContent = 'Pause Audio';
            console.log('Audio started playing automatically');
        }).catch(error => {
            console.error('Autoplay was prevented:', error);
            audioControl.textContent = 'Play Audio';
        });
    }
});

// Add event listener to audio control button
audioControl.addEventListener('click', toggleAudio);

// Add event listener to document for user interaction
document.addEventListener('click', () => {
    if (!isAudioPlaying) {
        toggleAudio();
    }
});
