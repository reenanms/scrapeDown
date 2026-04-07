import { ProfileManager } from '../src/config/ProfileManager';
import { StorageService } from '../src/core/StorageService';
import { DEFAULT_CONFIG } from '../src/config/DefaultConfig';

jest.mock('../src/core/StorageService', () => ({
    StorageService: {
        get: jest.fn(),
        set: jest.fn()
    }
}));

describe('ProfileManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('loadProfiles returns profiles and activeId', async () => {
        const mockData = {
            scraper_profiles: { profile1: { name: 'P1' } },
            scraper_active_profile_id: 'profile1'
        };
        StorageService.get.mockResolvedValue(mockData);

        const result = await ProfileManager.loadProfiles();
        expect(StorageService.get).toHaveBeenCalledWith(['scraper_profiles', 'scraper_active_profile_id']);
        expect(result.profiles).toEqual(mockData.scraper_profiles);
        expect(result.activeId).toBe('profile1');
    });

    test('parseConfigJson returns config with defaults on valid JSON', () => {
        const jsonStr = '{"rootSelector": "body"}';
        const result = ProfileManager.parseConfigJson(jsonStr);

        expect(result.ok).toBe(true);
        expect(result.config.profileName).toBe('Unnamed');
        expect(result.config.delay).toBe(3000);
        expect(result.config.stopCondition).toBeDefined();
    });

    test('parseConfigJson returns error on invalid JSON', () => {
        const jsonStr = '{invalid_json}';
        const result = ProfileManager.parseConfigJson(jsonStr);

        expect(result.ok).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('initDefaults creates __default__ if it does not exist', async () => {
        StorageService.get.mockResolvedValue({});
        StorageService.set.mockResolvedValue();

        const result = await ProfileManager.initDefaults();

        expect(StorageService.set).toHaveBeenCalledWith(expect.objectContaining({
            scraper_profiles: { __default__: DEFAULT_CONFIG }
        }));
        expect(result.profiles.__default__).toEqual(DEFAULT_CONFIG);
    });
});
