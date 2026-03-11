const si = require('systeminformation');
const { getTableCount } = require('../../utils/db-utils');
const { createError } = require('../../utils/tooljs');

async function getDashboardStats() {
    const usersCount = await getTableCount('users');
    const mountsCount = await getTableCount('user_mounts');

    // Parallel fetch for system info
    const [
        cpu,
        mem,
        osInfo,
        currentLoad,
        fsSize,
        networkStats,
        networkInterfaces,
        cpuTemperature,
        diskLayout,
        dockerInfo,
        dockerContainers
    ] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.currentLoad(),
        si.fsSize(),
        si.networkStats(),
        si.networkInterfaces(),
        si.cpuTemperature(),
        si.diskLayout(),
        si.dockerInfo().catch(() => null),
        si.dockerContainers().catch(() => [])
    ]);

    // Format Network Interfaces (active only, IPv4)
    const nets = [];
    // si.networkInterfaces returns array of objects
    const interfaces = Array.isArray(networkInterfaces) ? networkInterfaces : [networkInterfaces];
    interfaces.forEach(iface => {
        if (!iface.internal && iface.ip4) {
            nets.push({
                name: iface.iface,
                address: iface.ip4,
                mac: iface.mac,
                type: iface.type,
                speed: iface.speed
            });
        }
    });

    // Calculate aggregated network speed
    let rx_sec = 0;
    let tx_sec = 0;
    if (networkStats && networkStats.length > 0) {
        networkStats.forEach(stat => {
            rx_sec += stat.rx_sec;
            tx_sec += stat.tx_sec;
        });
    }

    const time = si.time();

    return {
      usersCount,
      mountsCount,
      system: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        hostname: osInfo.hostname,
        arch: osInfo.arch,
        uptime: time.uptime,
        timezone: time.timezone,
        time: time.current,
        cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            speed: cpu.speed,
            cores: cpu.cores,
            physicalCores: cpu.physicalCores,
            load: currentLoad.currentLoad,
            loadUser: currentLoad.currentLoadUser,
            loadSystem: currentLoad.currentLoadSystem,
            temperature: cpuTemperature.main
        },
        memory: {
            total: mem.total,
            free: mem.free,
            used: mem.used,
            active: mem.active,
            available: mem.available,
            swaptotal: mem.swaptotal,
            swapused: mem.swapused,
            swapfree: mem.swapfree
        },
        storage: {
            mounts: fsSize.map(d => ({
                fs: d.fs,
                type: d.type,
                size: d.size,
                used: d.used,
                use: d.use,
                mount: d.mount
            })),
            disks: diskLayout.map(d => ({
                device: d.device,
                type: d.type,
                name: d.name,
                vendor: d.vendor,
                size: d.size,
                serialNum: d.serialNum,
                interfaceType: d.interfaceType,
                smartStatus: d.smartStatus
            }))
        },
        network: {
            interfaces: nets,
            speed: {
                rx_sec, // bytes per second
                tx_sec
            }
        },
        docker: dockerInfo ? {
            active: true,
            containers: dockerInfo.containers,
            running: dockerInfo.containersRunning,
            paused: dockerInfo.containersPaused,
            stopped: dockerInfo.containersStopped,
            images: dockerInfo.images,
            details: dockerContainers.map(c => ({
                id: c.id,
                name: c.name,
                image: c.image,
                state: c.state,
                status: c.status,
                created: c.created,
                ports: c.ports
            }))
        } : { active: false }
      }
    };

}

async function getSystemInfo() {
    const [
        osInfo,
        system,
        bios,
        baseboard,
        cpu,
        memLayout,
        graphics,
        versions,
    ] = await Promise.all([
        si.osInfo(),
        si.system().catch(() => null),
        si.bios().catch(() => null),
        si.baseboard().catch(() => null),
        si.cpu(),
        si.memLayout().catch(() => []),
        si.graphics().catch(() => null),
        si.versions().catch(() => null),
    ]);

    return {
        os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            kernel: osInfo.kernel,
            arch: osInfo.arch,
            hostname: osInfo.hostname,
        },
        system: system
            ? {
                manufacturer: system.manufacturer,
                model: system.model,
                serial: system.serial,
                uuid: system.uuid,
                sku: system.sku,
                virtual: system.virtual,
            }
            : null,
        bios: bios
            ? {
                vendor: bios.vendor,
                version: bios.version,
                releaseDate: bios.releaseDate,
            }
            : null,
        baseboard: baseboard
            ? {
                manufacturer: baseboard.manufacturer,
                model: baseboard.model,
                version: baseboard.version,
                serial: baseboard.serial,
            }
            : null,
        cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            speed: cpu.speed,
            cores: cpu.cores,
            physicalCores: cpu.physicalCores,
            virtualization: cpu.virtualization,
        },
        memory: {
            layout: Array.isArray(memLayout)
                ? memLayout.map((m) => ({
                    size: m.size,
                    type: m.type,
                    clockSpeed: m.clockSpeed,
                    manufacturer: m.manufacturer,
                    partNum: m.partNum,
                    serialNum: m.serialNum,
                }))
                : [],
        },
        graphics: graphics
            ? {
                controllers: (graphics.controllers || []).map((c) => ({
                    vendor: c.vendor,
                    model: c.model,
                    vram: c.vram,
                    vramDynamic: c.vramDynamic,
                    bus: c.bus,
                })),
                displays: (graphics.displays || []).map((d) => ({
                    vendor: d.vendor,
                    model: d.model,
                    main: d.main,
                    resolutionX: d.resolutionX,
                    resolutionY: d.resolutionY,
                    currentRefreshRate: d.currentRefreshRate,
                    connection: d.connection,
                })),
            }
            : null,
        versions: versions || null,
        virtualization: null,
    };
}

async function getSystemMetrics(query = {}) {
    const iface = String(query.iface || '').trim();
    const networkIf = iface ? iface : undefined;

    const [
        time,
        currentLoad,
        mem,
        cpuTemperature,
        fsSize,
        fsStats,
        diskIO,
        networkStats,
        battery,
        users,
    ] = await Promise.all([
        si.time(),
        si.currentLoad(),
        si.mem(),
        si.cpuTemperature().catch(() => ({ main: null })),
        si.fsSize(),
        si.fsStats().catch(() => null),
        si.disksIO().catch(() => null),
        (networkIf ? si.networkStats(networkIf) : si.networkStats()).catch(() => []),
        si.battery().catch(() => null),
        si.users().catch(() => []),
    ]);

    const netStats = Array.isArray(networkStats) ? networkStats : [];
    let rx_sec = 0;
    let tx_sec = 0;
    netStats.forEach((s) => {
        rx_sec += Number(s.rx_sec || 0);
        tx_sec += Number(s.tx_sec || 0);
    });

    const mounts = Array.isArray(fsSize) ? fsSize : [];
    const storageTotals = mounts.reduce(
        (acc, m) => {
            acc.total += Number(m.size || 0);
            acc.used += Number(m.used || 0);
            return acc;
        },
        { total: 0, used: 0 }
    );

    return {
        time: {
            current: time.current,
            uptime: time.uptime,
            timezone: time.timezone,
        },
        cpu: {
            load: currentLoad.currentLoad,
            loadUser: currentLoad.currentLoadUser,
            loadSystem: currentLoad.currentLoadSystem,
            temperature: cpuTemperature?.main ?? null,
        },
        memory: {
            total: mem.total,
            free: mem.free,
            used: mem.used,
            active: mem.active,
            available: mem.available,
            swaptotal: mem.swaptotal,
            swapused: mem.swapused,
            swapfree: mem.swapfree,
        },
        storage: {
            totals: storageTotals,
            mounts: mounts.map((m) => ({
                fs: m.fs,
                type: m.type,
                size: m.size,
                used: m.used,
                use: m.use,
                mount: m.mount,
            })),
            fsStats: fsStats
                ? {
                    rx: fsStats.rx,
                    wx: fsStats.wx,
                    tx: fsStats.tx,
                    rx_sec: fsStats.rx_sec,
                    wx_sec: fsStats.wx_sec,
                    tx_sec: fsStats.tx_sec,
                    ms: fsStats.ms,
                }
                : null,
            diskIO: diskIO
                ? {
                    rIO: diskIO.rIO,
                    wIO: diskIO.wIO,
                    tIO: diskIO.tIO,
                    rIO_sec: diskIO.rIO_sec,
                    wIO_sec: diskIO.wIO_sec,
                    tIO_sec: diskIO.tIO_sec,
                    ms: diskIO.ms,
                }
                : null,
        },
        network: {
            iface: networkIf || null,
            speed: { rx_sec, tx_sec },
            stats: netStats.map((s) => ({
                iface: s.iface,
                operstate: s.operstate,
                rx_bytes: s.rx_bytes,
                tx_bytes: s.tx_bytes,
                rx_sec: s.rx_sec,
                tx_sec: s.tx_sec,
                ms: s.ms,
            })),
        },
        battery: battery
            ? {
                hasBattery: !!battery.hasBattery,
                isCharging: !!battery.isCharging,
                percent: battery.percent,
                timeRemaining: battery.timeRemaining,
                voltage: battery.voltage,
                temperature: battery.temperature,
            }
            : null,
        users: Array.isArray(users)
            ? users.map((u) => ({
                user: u.user,
                tty: u.tty,
                date: u.date,
                time: u.time,
                ip: u.ip,
            }))
            : [],
    };
}

async function getNetworkConnections(query = {}) {
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(2000, Math.max(1, Number(query.limit))) : 500;
    const state = String(query.state || '').trim().toLowerCase();

    const list = await si.networkConnections().catch(() => []);
    const normalized = (Array.isArray(list) ? list : [])
        .map((c) => ({
            protocol: c.protocol,
            localAddress: c.localAddress,
            localPort: c.localPort,
            peerAddress: c.peerAddress,
            peerPort: c.peerPort,
            state: c.state,
            pid: c.pid,
            process: c.process,
        }))
        .filter((c) => (state ? String(c.state || '').toLowerCase() === state : true))
        .slice(0, limit);

    return { list: normalized, limit, state: state || null };
}

async function getStorageIo() {
    const diskIO = await si.disksIO().catch(() => null);
    if (!diskIO) return null;
    return {
        rIO: diskIO.rIO,
        wIO: diskIO.wIO,
        tIO: diskIO.tIO,
        rIO_sec: diskIO.rIO_sec,
        wIO_sec: diskIO.wIO_sec,
        tIO_sec: diskIO.tIO_sec,
        ms: diskIO.ms,
    };
}

async function getFsStats() {
    const fsStats = await si.fsStats().catch(() => null);
    if (!fsStats) return null;
    return {
        rx: fsStats.rx,
        wx: fsStats.wx,
        tx: fsStats.tx,
        rx_sec: fsStats.rx_sec,
        wx_sec: fsStats.wx_sec,
        tx_sec: fsStats.tx_sec,
        ms: fsStats.ms,
    };
}

const normalizeProcessList = (payload) => {
    const list = Array.isArray(payload?.list) ? payload.list : [];
    return list.map((item) => ({
        pid: Number(item.pid),
        ppid: Number(item.parentPid ?? item.ppid ?? 0),
        name: item.name || '',
        user: item.user || '',
        command: item.command || item.path || '',
        path: item.path || '',
        state: item.state || '',
        cpu: Number(item.cpu ?? 0),
        mem: Number(item.mem ?? 0),
        memRss: Number(item.memRss ?? 0),
        threads: Number(item.threads ?? 0),
        priority: Number(item.priority ?? 0),
        nice: Number(item.nice ?? 0),
        started: item.started ?? null,
        time: Number(item.time ?? 0),
    }));
};

const sortProcessList = (list, sortBy, order) => {
    const dir = order === 'asc' ? 1 : -1;
    const key = sortBy || 'cpu';
    return [...list].sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va || '').localeCompare(String(vb || '')) * dir;
    });
};

async function getProcessSnapshot(query = {}) {
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(500, Math.max(1, Number(query.limit))) : 200;
    const offset = Number.isFinite(Number(query.offset)) ? Math.max(0, Number(query.offset)) : 0;
    const q = String(query.q || '').trim().toLowerCase();
    const sortBy = String(query.sortBy || 'cpu');
    const order = String(query.order || 'desc');

    const payload = await si.processes();
    let list = normalizeProcessList(payload);

    if (q) {
        list = list.filter((item) => {
            return (
                item.name.toLowerCase().includes(q) ||
                item.command.toLowerCase().includes(q) ||
                item.path.toLowerCase().includes(q) ||
                item.user.toLowerCase().includes(q) ||
                String(item.pid).includes(q)
            );
        });
    }

    list = sortProcessList(list, sortBy, order);
    const paged = list.slice(offset, offset + limit);

    return {
        summary: {
            all: Number(payload?.all ?? list.length),
            running: Number(payload?.running ?? 0),
            blocked: Number(payload?.blocked ?? 0),
            sleeping: Number(payload?.sleeping ?? 0),
        },
        list: paged,
        total: list.length,
        limit,
        offset,
    };
}

async function getProcessDetail(pidRaw) {
    const pid = Number(pidRaw);
    if (!Number.isFinite(pid) || pid <= 0) {
        throw createError('Invalid pid', 400);
    }

    const [payload, load] = await Promise.all([
        si.processes(),
        si.processLoad(pid).catch(() => null),
    ]);

    const list = normalizeProcessList(payload);
    const entry = list.find((item) => item.pid === pid);

    if (!entry) {
        throw createError('Process not found', 404);
    }

    return {
        process: entry,
        load: load ? {
            pid: Number(load.pid ?? pid),
            cpu: Number(load.cpu ?? 0),
            mem: Number(load.mem ?? 0),
            memRss: Number(load.memRss ?? 0),
            time: Number(load.time ?? 0),
            timestamp: Number(load.timestamp ?? Date.now()),
        } : null,
    };
}

async function killProcess(pidRaw, signalRaw) {
    const pid = Number(pidRaw);
    if (!Number.isFinite(pid) || pid <= 0) {
        throw createError('Invalid pid', 400);
    }
    const signal = String(signalRaw || 'SIGTERM').toUpperCase();
    const allowedSignals = new Set(['SIGTERM', 'SIGKILL', 'SIGINT']);
    if (!allowedSignals.has(signal)) {
        throw createError('Invalid signal', 400);
    }

    try {
        process.kill(pid, signal);
    } catch (err) {
        throw createError(err?.message || 'Kill failed', 500);
    }

    return { pid, signal };
}

module.exports = {
    getDashboardStats,
    getSystemInfo,
    getSystemMetrics,
    getNetworkConnections,
    getStorageIo,
    getFsStats,
    getProcessSnapshot,
    getProcessDetail,
    killProcess,
};
