export class MessagingService {
    /**
     * Sends a message to the background or popup.
     * @param {Object} message 
     * @returns {Promise<Object>}
     */
    static sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Adds a listener for messages.
     * @param {Function} callback 
     */
    static addListener(callback) {
        chrome.runtime.onMessage.addListener(callback);
    }
}
