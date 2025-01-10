const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const AdmZip = require('adm-zip');

const serverStartTime = Date.now();

const userStates = {};
const bannedFilePath = path.join(__dirname, 'banned.json');
const usersFilePath = path.join(__dirname, 'users.json');

let activeUsers = 0;

// Ensure files exist
async function ensureFilesExist() {
    try {
        await fs.access(bannedFilePath);
    } catch {
        await fs.writeFile(bannedFilePath, JSON.stringify([]));
    }

    try {
        await fs.access(usersFilePath);
    } catch {
        await fs.writeFile(usersFilePath, JSON.stringify({
            BLUE: { id: 'admin', password: 'Taloalob.1', isAdmin: true },
            CRACKS: { id: 'admin2', password: 'Taloalob', isAdmin: true }
        }));
    }
}

ensureFilesExist();

// File operations with error handling
const loadBannedUsers = async () => {
    try {
        const data = await fs.readFile(bannedFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading banned users:', error);
        return [];
    }
};

const saveBannedUsers = async (bannedUsers) => {
    try {
        await fs.writeFile(bannedFilePath, JSON.stringify(bannedUsers));
    } catch (error) {
        console.error('Error saving banned users:', error);
    }
};

const loadUsers = async () => {
    try {
        const data = await fs.readFile(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users:', error);
        return {};
    }
};

const saveUsers = async (users) => {
    try {
        await fs.writeFile(usersFilePath, JSON.stringify(users));
    } catch (error) {
        console.error('Error saving users:', error);
    }
};

const deleteUser = async (userId) => {
    try {
        const users = await loadUsers();
        const userToDelete = Object.keys(users).find(username => users[username].id === userId);
        if (userToDelete) {
            delete users[userToDelete];
            await saveUsers(users);

            // Delete user's directory
            const userDir = path.join(__dirname, 'users', String(userId));
            await fs.rmdir(userDir, { recursive: true });

            // Remove user from banned users if they were banned
            const bannedUsers = await loadBannedUsers();
            const index = bannedUsers.indexOf(userId);
            if (index > -1) {
                bannedUsers.splice(index, 1);
                await saveBannedUsers(bannedUsers);
            }

            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting user:', error);
        return false;
    }
};

const getClientAccountCount = async (clientId) => {
    const users = await loadUsers();
    return Object.values(users).filter(user => user.clientId === clientId).length;
};

const getTotalUserCount = async () => {
    const users = await loadUsers();
    return Object.keys(users).length;
};

const getBannedUserCount = async () => {
    const bannedUsers = await loadBannedUsers();
    return bannedUsers.length;
};

const calculateDirectorySize = async (directory) => {
    let totalSize = 0;
    const files = await fs.readdir(directory);
    
    for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
            totalSize += stats.size;
        } else if (stats.isDirectory()) {
            totalSize += await calculateDirectorySize(filePath);
        }
    }
    
    return totalSize;
};

async function checkPackageJson(userId) {
    const userDir = path.join(__dirname, 'users', String(userId));
    try {
        await fs.access(path.join(userDir, 'package.json'));
        return true;
    } catch {
        return false;
    }
}

async function checkNodeModules(userId) {
    const userDir = path.join(__dirname, 'users', String(userId));
    try {
        await fs.access(path.join(userDir, 'node_modules'));
        return true;
    } catch {
        return false;
    }
}

app.use(express.static('public'));
app.use(express.json());

function getServerRuntime() {
    const uptime = Date.now() - serverStartTime;
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((uptime % (60 * 1000)) / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getSystemStatus() {
    // This is a placeholder. In a real-world scenario, you'd use a library like 'os-utils' to get actual system stats
    return {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100)
    };
}

async function getUserStats() {
    return {
        total: await getTotalUserCount(),
        active: activeUsers,
        banned: await getBannedUserCount()
    };
}

async function validateUserSession(userId, isAdmin) {
    const users = await loadUsers();
    const user = Object.values(users).find(u => u.id === userId);
    return user && user.isAdmin === isAdmin;
}

io.on('connection', (socket) => {
    console.log('A user connected');
    activeUsers++;
    io.emit('userStats', getUserStats());

    socket.on('register', async ({ username, password, clientId }) => {
        try {
            if (typeof username !== 'string' || typeof password !== 'string' || typeof clientId !== 'string') {
                throw new Error('Invalid input types');
            }

            if (password.length < 7) {
                socket.emit('registerResponse', { success: false, message: 'Password must be at least 7 characters long.' });
                return;
            }

            const users = await loadUsers();

            if (await getTotalUserCount() >= 40) {
                socket.emit('registerResponse', { success: false, message: 'Maximum of 40 users limit reached. Cannot create new accounts at this time.' });
            } else if (await getClientAccountCount(clientId) >= 1) {
                socket.emit('registerResponse', { success: false, message: 'You can only create up to 1 accounts per device 😊' });
            } else if (users[username]) {
                socket.emit('registerResponse', { success: false, message: 'Username already exists 🐐' });
            } else {
                const userId = Math.random().toString(36).substr(2, 9);
                users[username] = { id: userId, password: password, isAdmin: false, clientId: clientId };
                await saveUsers(users);
                socket.emit('registerResponse', { success: true, userId: userId });
            }
        } catch (error) {
            console.error('Error during registration:', error);
            socket.emit('registerResponse', { success: false, message: 'An error occurred during registration' });
        }
    });

    socket.on('login', async ({ username, password }) => {
        try {
            if (typeof username !== 'string' || typeof password !== 'string') {
                throw new Error('Invalid input types');
            }

            const users = await loadUsers();

            if (users[username] && users[username].password === password) {
                socket.emit('loginResponse', { 
                    success: true, 
                    userId: users[username].id, 
                    isAdmin: users[username].isAdmin 
                });
            } else {
                socket.emit('loginResponse', { success: false, message: 'Invalid username or password' });
            }
        } catch (error) {
            console.error('Error during login:', error);
            socket.emit('loginResponse', { success: false, message: 'An error occurred during login' });
        }
    });

    socket.on('adminGetUsers', async () => {
        try {
            const users = await loadUsers();
            const userList = Object.keys(users).map(username => ({
                username,
                id: users[username].id,
                isAdmin: users[username].isAdmin,
                password: users[username].password // Include password
            }));
            const totalUserCount = await getTotalUserCount();
            socket.emit('adminUserList', { users: userList, totalUserCount });
        } catch (error) {
            console.error('Error getting user list:', error);
            socket.emit('adminUserList', { users: [], totalUserCount: 0 });
        }
    });

    socket.on('adminBanUser', async (userId) => {
        try {
            if (typeof userId !== 'string') {
                throw new Error('Invalid input type');
            }

            const bannedUsers = await loadBannedUsers();
            if (!bannedUsers.includes(userId)) {
                bannedUsers.push(userId);
                await saveBannedUsers(bannedUsers);
                socket.emit('adminBanResponse', { success: true, message: 'User banned successfully' });
                io.emit('userStats', await getUserStats());
            } else {
                socket.emit('adminBanResponse', { success: false, message: 'User is already banned' });
            }
        } catch (error) {
            console.error('Error banning user:', error);
            socket.emit('adminBanResponse', { success: false, message: 'An error occurred while banning the user' });
        }
    });

    socket.on('adminUnbanUser', async (userId) => {
        try {
            if (typeof userId !== 'string') {
                throw new Error('Invalid input type');
            }

            const bannedUsers = await loadBannedUsers();
            const index = bannedUsers.indexOf(userId);
            if (index > -1) {
                bannedUsers.splice(index, 1);
                await saveBannedUsers(bannedUsers);
                socket.emit('adminUnbanResponse', { success: true, message: 'User unbanned successfully' });
                io.emit('userStats', await getUserStats());
            } else {
                socket.emit('adminUnbanResponse', { success: false, message: 'User is not banned' });
            }
        } catch (error) {
            console.error('Error unbanning user:', error);
            socket.emit('adminUnbanResponse', { success: false, message: 'An error occurred while unbanning the user' });
        }
    });

    socket.on('adminDeleteUser', async (userId) => {
        try {
            if (typeof userId !== 'string') {
                throw new Error('Invalid input type');
            }

            if (await deleteUser(userId)) {
                socket.emit('adminDeleteUserResponse', { success: true, message: 'User deleted successfully' });
                io.emit('userStats', await getUserStats());
            } else {
                socket.emit('adminDeleteUserResponse', { success: false, message: 'User not found or could not be deleted' });
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            socket.emit('adminDeleteUserResponse', { success: false, message: 'An error occurred while deleting the user' });
        }
    });

    socket.on('adminMakeAdmin', async (userId) => {
        try {
            if (typeof userId !== 'string') {
                throw new Error('Invalid input type');
            }

            const users = await loadUsers();
            const userToUpdate = Object.keys(users).find(username => users[username].id === userId);
            if (userToUpdate) {
                users[userToUpdate].isAdmin = true;
                await saveUsers(users);
                socket.emit('adminMakeAdminResponse', { success: true, message: 'User is now an admin' });
            } else {
                socket.emit('adminMakeAdminResponse', { success: false, message: 'User not found' });
            }
        } catch (error) {
            console.error('Error making user admin:', error);
            socket.emit('adminMakeAdminResponse', { success: false, message: 'An error occurred while making the user an admin' });
        }
    });

    socket.on('adminRemoveAdmin', async (userId) => {
        try {
            if (typeof userId !== 'string') {
                throw new Error('Invalid input type');
            }

            const users = await loadUsers();
            const userToUpdate = Object.keys(users).find(username => users[username].id === userId);
            if (userToUpdate) {
                users[userToUpdate].isAdmin = false;
                await saveUsers(users);
                socket.emit('adminRemoveAdminResponse', { success: true, message: 'Admin privileges removed from user' });
            } else {
                socket.emit('adminRemoveAdminResponse', { success: false, message: 'User not found' });
            }
        } catch (error) {
            console.error('Error removing admin privileges:', error);
            socket.emit('adminRemoveAdminResponse', { success: false, message: 'An error occurred while removing admin privileges' });
        }
    });

    socket.on('start', async (userId) => {
        try {
            if (typeof userId !== 'string') {
                throw new Error('Invalid input type');
            }

            const bannedUsers = await loadBannedUsers();

            if (bannedUsers.includes(userId)) {
                socket.emit('message', '❌ You are banned from using this service by BLUEDEMON 🤤');
                return;
            }

            const userDir = path.join(__dirname, 'users', String(userId));
            await fs.mkdir(userDir, { recursive: true });

            const spaceUsed = await calculateDirectorySize(userDir);
            const spaceUsedMB = (spaceUsed / (1024 * 1024)).toFixed(2);
            socket.emit('message', { type: 'spaceUsage', usage: `${spaceUsedMB} MB` });

            userStates[userId] = { step: 'ready', started: true };
            socket.emit('message', '🌹 WELCOME! Your environment is ready. You can now upload files or use commands.👅');
        } catch (error) {
            console.error('Error starting user session:', error);
            socket.emit('message', '❌ An error occurred while starting your session. Please try again.');
        }
    });

    socket.on('command', async (data) => {
        try {
            if (typeof data !== 'object' || typeof data.userId !== 'string' || typeof data.message !== 'string') {
                throw new Error('Invalid input types');
            }

            const { userId, message } = data;
            const bannedUsers = await loadBannedUsers();

            if (bannedUsers.includes(userId)) {
                socket.emit('message', '❌ You are banned from using this service by BLUEDEMON 🤤');
                return;
            }

            if (!userStates[userId]?.started) {
                socket.emit('message', '❌ Please use the start command before proceeding so as to avoid error');
                return;
            }

            const userDir = path.join(__dirname, 'users', String(userId));
            if (!userStates[userId]) {
                userStates[userId] = { step: 'ready', started: false };
            }
            const userState = userStates[userId];

            if (userState.runningProcess && message.startsWith('/')) {
                // Handle interaction with running script
                const command = message.slice(1);
                userState.runningProcess.stdin.write(command + '\n');
                socket.emit('message', `Command sent to script: ${command}`);
            } else {
                switch (true) {
                    case message.toLowerCase() === 'clear':
                        try {
                            await fs.rmdir(userDir, { recursive: true });
                            await fs.mkdir(userDir, { recursive: true });
                            socket.emit('message', '✅ Your directory has been cleared successfully.');
                        } catch (error) {
                            console.error('Error clearing directory:', error);
                            socket.emit('message', '❌ Failed to clear your directory.');
                        }
                        break;

                    case message.toLowerCase() === 'list':
                        try {
                            const files = await fs.readdir(userDir);
                            if (files.length === 0) {
                                socket.emit('message', '❌ No files found.');
                            } else {
                                const fileList = await Promise.all(files.map(async file => {
                                    const stats = await fs.stat(path.join(userDir, file));
                                    return {
                                        name: file,
                                        type: stats.isDirectory() ? 'folder' : 'file',
                                        size: stats.size,
                                        lastModified: stats.mtime
                                    };
                                }));
                                socket.emit('fileList', fileList);
                            }
                        } catch (error) {
                            console.error('Error listing files:', error);
                            socket.emit('message', '❌ Failed to list files.');
                        }
                        break;

                    case message.toLowerCase() === 'install':
                        if (await checkPackageJson(userId)) {
                            const installProcess = spawn('yarn', ['install'], { cwd: userDir });
                            installProcess.stdout.on('data', (data) => socket.emit('message', `✅ YARN OUTPUT:\n${data}`));
                            installProcess.stderr.on('data', (data) => socket.emit('message', `⚠️ YARN ERROR:\n${data}`));
                            installProcess.on('close', (code) => {
                                socket.emit('message', `🚀 Yarn install finished with code ${code}`);
                            });
                        } else {
                            socket.emit('message', '❌ No package.json found. Cannot run yarn install.');
                        }
                        break;

                    case message.toLowerCase() === 'start':
                        if (await checkNodeModules(userId)) {
                            const startProcess = spawn('npm', ['start'], { cwd: userDir });
                            userState.runningProcess = startProcess;
                            socket.emit('message', 'Script started');
                            startProcess.stdout.on('data', (data) => socket.emit('message', `✅ NPM START OUTPUT:\n${data}`));
                            startProcess.stderr.on('data', (data) => socket.emit('message', `⚠️ NPM START ERROR:\n${data}`));
                            startProcess.on('close', (code) => {
                                socket.emit('message', `🚀 npm start finished with code ${code}`);
                                socket.emit('message', 'Script ended');
                                delete userState.runningProcess;
                            });
                        } else {
                            socket.emit('message', '❌ No node_modules found. Please run install first.');
                        }
                        break;

                    case message.toLowerCase() === 'pause':
                        if (userState.runningProcess) {
                            userState.runningProcess.kill('SIGSTOP');
                            socket.emit('message', '⏸️ Project paused');
                        } else {
                            socket.emit('message', '❌ No active process to pause');
                        }
                        break;

                    default:
                        socket.emit('message', '❌ Unrecognized command. Use list, clear, install, start, pause or /command to interact with a running script.');
                }
            }
        } catch (error) {
            console.error('Error processing command:', error);
            socket.emit('message', '❌ An error occurred while processing your command. Please try again.');
        }
    });

    socket.on('getServerRuntime', () => {
        try {
            socket.emit('serverRuntime', getServerRuntime());
        } catch (error) {
            console.error('Error getting server runtime:', error);
            socket.emit('serverRuntime', 'Error getting server runtime');
        }
    });

    socket.on('getSystemStatus', () => {
        try {
            socket.emit('systemStatus', getSystemStatus());
        } catch (error) {
            console.error('Error getting system status:', error);
            socket.emit('systemStatus', { cpu: 0, memory: 0, disk: 0 });
        }
    });

    socket.on('getUserStats', async () => {
        try {
            socket.emit('userStats', await getUserStats());
        } catch (error) {
            console.error('Error getting user stats:', error);
            socket.emit('userStats', { total: 0, active: 0, banned: 0 });
        }
    });

    socket.on('validateSession', async ({ userId, isAdmin }) => {
        try {
            const isValid = await validateUserSession(userId, isAdmin);
            socket.emit('sessionValidated', { valid: isValid });
        } catch (error) {
            console.error('Error validating session:', error);
            socket.emit('sessionValidated', { valid: false });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        activeUsers--;
        io.emit('userStats', getUserStats());
    });
});

setInterval(async () => {
    try {
        io.emit('serverRuntime', getServerRuntime());
        io.emit('systemStatus', getSystemStatus());
        io.emit('userStats', await getUserStats());
    } catch (error) {
        console.error('Error emitting periodic updates:', error);
    }
}, 5000);

const PORT = process.env.PORT || 7860;
http.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}.`));

app.post('/upload', upload.single('zipFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const userId = req.body.userId;
    const userDir = path.join(__dirname, 'users', userId);

    try {
        await fs.mkdir(userDir, { recursive: true });

        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();

        for (const entry of zipEntries) {
            if (entry.isDirectory) {
                continue;
            }

            const entryPath = path.join(userDir, entry.entryName);
            await fs.mkdir(path.dirname(entryPath), { recursive: true });
            await fs.writeFile(entryPath, entry.getData());
        }

        await fs.unlink(req.file.path); // Delete the uploaded zip file

        // Move all files to the main branch (root of the user directory)
        const files = await fs.readdir(userDir, { withFileTypes: true });
        for (const file of files) {
            if (file.isDirectory()) {
                const subDirPath = path.join(userDir, file.name);
                const subDirFiles = await fs.readdir(subDirPath);
                for (const subFile of subDirFiles) {
                    await fs.rename(path.join(subDirPath, subFile), path.join(userDir, subFile));
                }
                await fs.rmdir(subDirPath);
            }
        }

        res.send('File uploaded, extracted, and moved to main branch successfully.');
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).send('Error processing upload.');
    }
});


app.post('/start-project', (req, res) => {
    const { userId } = req.body;
    const userDir = path.join(__dirname, 'users', userId);

    exec('yarn install', { cwd: userDir }, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send('Error running yarn install');
        }
        res.send('yarn install completed successfully.');
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Optionally, you can implement a restart mechanism here
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, you can implement a restart mechanism here
});

