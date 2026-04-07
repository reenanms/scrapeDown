export class StorageService {
    /**
     * Get an item or multiple items from local storage.
     * @param {string|string[]} keys 
     * @returns {Promise<Object>}
     */
    static async get(keys) {
        return chrome.storage.local.get(keys);
    }

    /**
     * Set items to local storage.
     * @param {Object} items 
     * @returns {Promise<void>}
     */
    static async set(items) {
        return chrome.storage.local.set(items);
    }

    /**
     * Listen for changes on local storage.
     * @param {Function} callback 
     */
    static onChange(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local') {
                callback(changes);
            }
        });
    }
}
