import { Test, TestingModule } from '@nestjs/testing';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferencesService } from '../../features/user-preferences/user-preferences.service';
import {
  UpdateUserPreferencesDto,
  UpdateThemeDto,
  UpdateTimezoneDto,
  ThemeEnum,
} from './dto';

describe('UserPreferencesController', () => {
  let controller: UserPreferencesController;
  let service: UserPreferencesService;

  const mockPreferences = {
    id: 1,
    userFk: 123,
    theme: 'light',
    timezone: 'Asia/Kolkata',
    notificationsEnabled: true,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockUserPreferencesService = {
    get: jest.fn().mockResolvedValue(mockPreferences),
    getOrCreate: jest.fn().mockResolvedValue(mockPreferences),
    update: jest.fn().mockResolvedValue(mockPreferences),
    setTheme: jest
      .fn()
      .mockResolvedValue({ ...mockPreferences, theme: 'dark' }),
    setTimezone: jest
      .fn()
      .mockResolvedValue({ ...mockPreferences, timezone: 'UTC' }),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserPreferencesController],
      providers: [
        {
          provide: UserPreferencesService,
          useValue: mockUserPreferencesService,
        },
      ],
    }).compile();

    controller = module.get<UserPreferencesController>(
      UserPreferencesController,
    );
    service = module.get<UserPreferencesService>(UserPreferencesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return user preferences successfully', async () => {
      const userId = 123;

      const result = await controller.getPreferences(userId);

      expect(result).toBeDefined();
      expect(result.data).toEqual(mockPreferences);
      expect(service.get).toHaveBeenCalledWith(userId);
    });

    it('should create preferences if they do not exist', async () => {
      const userId = 123;
      mockUserPreferencesService.get.mockResolvedValueOnce(null);

      const result = await controller.getPreferences(userId);

      expect(result).toBeDefined();
      expect(service.getOrCreate).toHaveBeenCalledWith(userId, userId);
    });

    it('should handle service errors gracefully', async () => {
      const userId = 123;
      const error = new Error('Database error');
      mockUserPreferencesService.get.mockRejectedValueOnce(error);

      await expect(controller.getPreferences(userId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update multiple preferences at once', async () => {
      const userId = 123;
      const updateDto: UpdateUserPreferencesDto = {
        theme: ThemeEnum.DARK,
      };

      const result = await controller.updatePreferences(userId, updateDto);

      expect(result).toBeDefined();
      expect(service.update).toHaveBeenCalledWith(userId, updateDto, userId);
    });

    it('should update only provided fields', async () => {
      const userId = 123;
      const updateDto: UpdateUserPreferencesDto = {
        notificationsEnabled: false,
      };

      const result = await controller.updatePreferences(userId, updateDto);

      expect(result).toBeDefined();
      expect(service.update).toHaveBeenCalledWith(userId, updateDto, userId);
    });

    it('should handle validation errors', async () => {
      const userId = 123;
      const invalidDto = {
        theme: 'invalid_theme',
      };

      await controller.updatePreferences(
        userId,
        invalidDto as UpdateUserPreferencesDto,
      );

      expect(service.update).toHaveBeenCalled();
    });
  });

  describe('updateTheme', () => {
    it('should update theme successfully', async () => {
      const userId = 123;
      const updateDto: UpdateThemeDto = {
        theme: ThemeEnum.DARK,
      };

      const result = await controller.updateTheme(userId, updateDto);

      expect(result).toBeDefined();
      expect(result.data!.theme).toEqual('dark');
      expect(service.setTheme).toHaveBeenCalledWith(
        userId,
        ThemeEnum.DARK,
        userId,
      );
    });

    it('should return only theme in response', async () => {
      const userId = 123;
      const updateDto: UpdateThemeDto = {
        theme: ThemeEnum.LIGHT,
      };

      const result = await controller.updateTheme(userId, updateDto);

      expect(result.data).toHaveProperty('theme');
      expect(Object.keys(result.data!)).toEqual(['theme']);
    });
  });

  describe('updateTimezone', () => {
    it('should update timezone successfully', async () => {
      const userId = 123;
      const updateDto: UpdateTimezoneDto = {
        timezone: 'UTC',
      };

      const result = await controller.updateTimezone(userId, updateDto);

      expect(result).toBeDefined();
      expect(result.data!.timezone).toEqual('UTC');
      expect(service.setTimezone).toHaveBeenCalledWith(userId, 'UTC', userId);
    });

    it('should accept any valid IANA timezone', async () => {
      const userId = 123;
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Australia/Sydney',
        'Asia/Tokyo',
      ];

      for (const tz of timezones) {
        const updateDto: UpdateTimezoneDto = { timezone: tz };
        await controller.updateTimezone(userId, updateDto);
        expect(service.setTimezone).toHaveBeenCalledWith(userId, tz, userId);
      }
    });

    it('should return only timezone in response', async () => {
      const userId = 123;
      const updateDto: UpdateTimezoneDto = {
        timezone: 'Asia/Kolkata',
      };

      const result = await controller.updateTimezone(userId, updateDto);

      expect(result.data).toHaveProperty('timezone');
      expect(Object.keys(result.data!)).toEqual(['timezone']);
    });
  });

  describe('Response Format', () => {
    it('should return ApiResponse format for all endpoints', async () => {
      const userId = 123;

      const getResult = await controller.getPreferences(userId);
      expect(getResult).toHaveProperty('status');
      expect(getResult).toHaveProperty('data');
      expect(getResult).toHaveProperty('message');

      const updateResult = await controller.updatePreferences(userId, {});
      expect(updateResult).toHaveProperty('status');
      expect(updateResult).toHaveProperty('data');
      expect(updateResult).toHaveProperty('message');
    });

    it('should return success status for OK responses', async () => {
      const userId = 123;

      const getResult = await controller.getPreferences(userId);
      expect(getResult.status).toBe('success');

      const updateResult = await controller.updatePreferences(userId, {});
      expect(updateResult.status).toBe('success');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors for getPreferences', async () => {
      const userId = 123;
      const error = new Error('Service error');
      mockUserPreferencesService.get.mockRejectedValueOnce(error);

      await expect(controller.getPreferences(userId)).rejects.toThrow(
        'Service error',
      );
    });

    it('should handle service errors for updatePreferences', async () => {
      const userId = 123;
      const error = new Error('Update failed');
      mockUserPreferencesService.update.mockRejectedValueOnce(error);

      await expect(controller.updatePreferences(userId, {})).rejects.toThrow(
        'Update failed',
      );
    });

    it('should handle service errors for setTheme', async () => {
      const userId = 123;
      const error = new Error('Theme update failed');
      mockUserPreferencesService.setTheme.mockRejectedValueOnce(error);

      await expect(
        controller.updateTheme(userId, { theme: ThemeEnum.DARK }),
      ).rejects.toThrow('Theme update failed');
    });
  });
});
