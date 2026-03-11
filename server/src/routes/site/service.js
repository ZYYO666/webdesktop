const db = require('../../config/db');
const { getSettings } = require('../settings/service');

async function getSiteInfo(userId) {
    const settings = await getSettings();
    const result = {
        title: settings.title || 'CloudGallery',
        wallpaper: null,
        fullscreenCoverDock: false,
        dockPosition: 'bottom',
        dockMode: 'floating',
        windowStyle: 'mac'
    };

    if (userId && userId > 0) {
        return new Promise((resolve, reject) => {
            db.get(
                "SELECT wallpaper, fullscreen_cover_dock, dock_position, dock_mode, window_style FROM users WHERE id = ?",
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (row) {
                        result.wallpaper = row.wallpaper || null;
                        result.fullscreenCoverDock = (row.fullscreen_cover_dock === 1 || row.fullscreen_cover_dock === '1' || row.fullscreen_cover_dock === true);
                        result.dockPosition = row.dock_position || 'bottom';
                        result.dockMode = row.dock_mode || 'floating';
                        result.windowStyle = (row.window_style === 'win') ? 'win' : 'mac';
                    }
                    resolve(result);
                }
            );
        });
    }

    return result;
}

module.exports = {
    getSiteInfo
};
