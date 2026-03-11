const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { createError } = require('../../utils/tooljs');

/**
 * Execute a system power command
 * @param {'shutdown' | 'reboot'} action 
 */
async function systemPowerControl(action) {
    // In a real environment, this might need sudo or specific permissions.
    // For a NAS OS (like a custom Node server running as root or with sudoers), this is standard.
    // We add a delay to allow the response to be sent back to the client.
    
    let cmd = '';
    const platform = process.platform;

    if (action === 'shutdown') {
        if (platform === 'win32') cmd = 'shutdown /s /t 5';
        else if (platform === 'darwin') cmd = 'sudo shutdown -h +1'; // Mac requires sudo usually, +1 minute
        else cmd = 'shutdown -h +1'; // Linux, 1 minute delay
    } else if (action === 'reboot') {
        if (platform === 'win32') cmd = 'shutdown /r /t 5';
        else if (platform === 'darwin') cmd = 'sudo shutdown -r +1';
        else cmd = 'shutdown -r +1';
    } else {
        throw createError('Invalid power action', 400);
    }

    // specific handling for development/mac to avoid accidental shutdowns?
    // User asked for "NAS-like", so we implement it.
    
    // We don't await the exec because it might kill the process immediately (though we used time delay)
    // But for the API to return success, we trigger it and return.
    
    setTimeout(() => {
        exec(cmd, (error) => {
            if (error) {
                console.error(`Power control failed: ${error.message}`);
            }
        });
    }, 1000);

    return { success: true, message: `System will ${action} in 1 minute` };
}

/**
 * Control Docker Containers
 * @param {string} containerId 
 * @param {'start' | 'stop' | 'restart'} action 
 */
async function dockerControl(containerId, action) {
    if (!['start', 'stop', 'restart'].includes(action)) {
        throw createError('Invalid docker action', 400);
    }
    
    // Basic sanitization to prevent injection
    if (!/^[a-zA-Z0-9_-]+$/.test(containerId)) {
        throw createError('Invalid container ID', 400);
    }

    try {
        await execAsync(`docker ${action} ${containerId}`);
        return { success: true, message: `Container ${action}ed successfully` };
    } catch (err) {
        console.error(`Docker control error: ${err.message}`);
        throw createError(`Failed to ${action} container: ${err.message}`, 500);
    }
}

/**
 * Restart the Node.js application service
 * This implies the app is run via a manager like PM2 or Systemd, 
 * or we just exit and let the manager restart us.
 */
async function appControl(action) {
    if (action === 'restart') {
        setTimeout(() => {
            process.exit(0); // Assume a process manager (Docker/PM2) will restart it
        }, 1000);
        return { success: true, message: 'Application server restarting...' };
    }
    throw createError('Invalid app action', 400);
}

module.exports = {
    systemPowerControl,
    dockerControl,
    appControl
};
