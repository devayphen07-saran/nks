import { Injectable } from '@nestjs/common';
import { OnboardingService } from '../services/flows/onboarding.service';
import type { OnboardingCompleteDto } from '../dto/onboarding.dto';

/**
 * Orchestrates user onboarding completion (name, email+password, phone setup).
 */
@Injectable()
export class UserOnboardingUseCase {
  constructor(private readonly onboarding: OnboardingService) {}

  completeProfile(userId: number, dto: OnboardingCompleteDto) {
    return this.onboarding.completeOnboarding(userId, dto);
  }
}
