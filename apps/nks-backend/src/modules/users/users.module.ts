import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports:     [RolesModule],
  controllers: [UsersController],
  providers:   [UsersService, UsersRepository, UserPreferencesRepository],
  exports:     [UsersService, UsersRepository, UserPreferencesRepository],
})
export class UsersModule {}
