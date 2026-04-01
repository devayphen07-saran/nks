import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserPreferencesController } from './user-preferences.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserPreferencesService } from '../../features/user-preferences/user-preferences.service';

@Module({
  controllers: [UsersController, UserPreferencesController],
  providers: [UsersService, UsersRepository, UserPreferencesService],
  exports: [UsersService, UsersRepository, UserPreferencesService],
})
export class UsersModule {}
