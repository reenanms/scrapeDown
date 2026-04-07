import { StorageService } from '../core/StorageService';
import { DEFAULT_CONFIG } from './DefaultConfig';

const STORAGE_KEYS = {
    PROFILES: 'scraper_profiles',
    ACTIVE_PROFILE_ID: 'scraper_active_profile_id'
};

export class ProfileManager {
    static async loadProfiles() {
        const data = await StorageService.get([STORAGE_KEYS.PROFILES, STORAGE_KEYS.ACTIVE_PROFILE_ID]);
        const profiles = data[STORAGE_KEYS.PROFILES] || {};
        const activeId = data[STORAGE_KEYS.ACTIVE_PROFILE_ID] || '__default__';
        return { profiles, activeId };
    }

    static async saveProfiles(profiles, activeId) {
        await StorageService.set({
            [STORAGE_KEYS.PROFILES]: profiles,
            [STORAGE_KEYS.ACTIVE_PROFILE_ID]: activeId
        });
    }

    static async saveNewProfile(configData) {
        const { profiles, activeId } = await this.loadProfiles();
        const id = 'custom_' + Date.now();
        profiles[id] = configData;
        await this.saveProfiles(profiles, id);
        return id;
    }

    static parseConfigJson(raw) {
        try {
            const parsed = JSON.parse(raw);
            if (!parsed.profileName) parsed.profileName = 'Unnamed';
            if (parsed.delay == null) parsed.delay = 3000;
            if (!parsed.stopCondition) parsed.stopCondition = { selector: "button[disabled]", type: "exists" };
            return { ok: true, config: parsed };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    static async initDefaults() {
        const { profiles, activeId } = await this.loadProfiles();
        if (!profiles.__default__) {
            profiles.__default__ = DEFAULT_CONFIG;
            await this.saveProfiles(profiles, activeId);
        }
        return { profiles, activeId };
    }
}
