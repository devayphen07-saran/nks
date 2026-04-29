import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SlackAlertParams =
  | {
      type: 'success';
      summary: string;
      details: { oldKid: string; newKid: string; reason?: string; durationMs: number; rotatedAt?: Date };
      critical?: boolean;
    }
  | {
      type: 'failure';
      summary: string;
      details: { oldKid: string; error: string };
      critical?: boolean;
    };

/**
 * Key Rotation Alert Service
 *
 * Notification channels (in priority order):
 *   1. Structured pino log  — always fires, works with any log aggregator
 *   2. Slack webhook         — optional, configure SLACK_WEBHOOK_URL
 *
 * Configuration (env vars):
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/...   (optional)
 *   KEY_ROTATION_ALERT_ENABLED=true|false            (default: true)
 */
@Injectable()
export class KeyRotationAlertService {
  private readonly logger = new Logger(KeyRotationAlertService.name);
  private readonly slackWebhookUrl: string | null;
  private readonly alertsEnabled: boolean;

  private static readonly SLACK_TIMEOUT_MS = 5_000;

  constructor(private readonly configService: ConfigService) {
    const alertEnabledEnv = this.configService.get<string>(
      'KEY_ROTATION_ALERT_ENABLED',
      'true',
    );
    this.alertsEnabled = alertEnabledEnv.toLowerCase() !== 'false';

    this.slackWebhookUrl =
      this.configService.get<string>('SLACK_WEBHOOK_URL', '') || null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Alert on successful key rotation.
   * Always emits a structured log regardless of Slack configuration.
   */
  async alertRotationSuccess(details: {
    oldKid: string;
    newKid: string;
    reason: 'scheduled' | 'emergency';
    durationMs: number;
    rotatedAt: Date;
  }): Promise<void> {
    this.logger.log({
      event: 'KEY_ROTATION_SUCCESS',
      oldKid: details.oldKid,
      newKid: details.newKid,
      reason: details.reason,
      durationMs: details.durationMs,
      rotatedAt: details.rotatedAt.toISOString(),
    });

    if (!this.alertsEnabled) return;

    await this.sendSlackAlert({
      type: 'success',
      summary: `JWT key rotation completed successfully at ${details.rotatedAt.toISOString()}`,
      details,
    });
  }

  /**
   * Alert on key rotation failure (CRITICAL).
   *
   * Attempts Slack delivery. If Slack also fails, emits a second structured
   * log with severity FATAL so a log aggregator can trigger an independent
   * alert without any external delivery channel being available.
   */
  async alertRotationFailure(details: {
    oldKid: string;
    reason: 'scheduled' | 'emergency';
    error: string;
    durationMs: number;
    timestamp: Date;
  }): Promise<void> {
    // Always log first — this is the last line of defence if Slack is down
    this.logger.error({
      event: 'KEY_ROTATION_FAILED',
      oldKid: details.oldKid,
      reason: details.reason,
      error: details.error,
      durationMs: details.durationMs,
      timestamp: details.timestamp.toISOString(),
    });

    if (!this.alertsEnabled) return;

    const slackDelivered = await this.sendSlackAlert({
      type: 'failure',
      summary: `JWT key rotation failed at ${details.timestamp.toISOString()}: ${details.error}`,
      details,
      critical: true,
    });

    if (!slackDelivered) {
      // Slack failed — emit a FATAL structured log.
      // Configure your log aggregator (Datadog, CloudWatch, etc.) to alert on
      // event = KEY_ROTATION_ALERT_ALL_CHANNELS_FAILED independently of Slack.
      this.logger.error({
        event: 'KEY_ROTATION_ALERT_ALL_CHANNELS_FAILED',
        severity: 'FATAL',
        originalError: details.error,
        kid: details.oldKid,
        reason: details.reason,
        timestamp: details.timestamp.toISOString(),
        message:
          'CRITICAL: Key rotation failed AND all alert delivery channels failed. ' +
          'Manual intervention required. Check application logs immediately.',
      });
    }
  }

  /**
   * Test alert configuration.
   *
   * IMPORTANT: Expose only via a SUPER_ADMIN-guarded endpoint:
   *
   *   @Get('test-alerts')
   *   @UseGuards(RBACGuard)
   *   @RequireEntityPermission({
   *     entityCode: EntityCodes.AUDIT_LOG,
   *     action: PermissionActions.VIEW,
   *     scope: 'PLATFORM',
   *   })
   *   testAlerts() { return this.keyRotationAlertService.testAlertConfiguration(); }
   */
  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Send a Slack notification.
   * Returns true if delivered, false if failed or not configured.
   * Never throws. Includes a 5-second timeout.
   */
  private async sendSlackAlert(params: SlackAlertParams): Promise<boolean> {
    if (!this.slackWebhookUrl) return false;

    const color = params.type === 'success' ? '#36a64f' : '#ff0000';
    const icon  = params.type === 'success' ? '✅' : '🚨';

    const fields =
      params.type === 'success'
        ? [
            { title: 'Old KID',  value: params.details.oldKid,                         short: true  },
            { title: 'New KID',  value: params.details.newKid,                         short: true  },
            { title: 'Duration', value: `${params.details.durationMs}ms`,              short: true  },
            { title: 'Reason',   value: params.details.reason?.toUpperCase() ?? 'N/A', short: true  },
          ]
        : [
            { title: 'Error',                   value: params.details.error,           short: false },
            { title: 'Current KID (unchanged)', value: params.details.oldKid,          short: true  },
            { title: 'Action Required',         value: params.critical ? 'CRITICAL' : 'Investigate', short: true },
          ];

    const controller = new AbortController();
    const timeoutId  = setTimeout(
      () => controller.abort(),
      KeyRotationAlertService.SLACK_TIMEOUT_MS,
    );

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body: JSON.stringify({
          attachments: [
            {
              color,
              title: `${icon} JWT Key Rotation ${params.type === 'success' ? 'Success' : 'Failure'}`,
              text:   params.summary,
              fields,
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn({
          event: 'KEY_ROTATION_SLACK_FAILED',
          status: response.status,
          statusText: response.statusText,
        });
        return false;
      }

      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      const isTimeout = (error as Error).name === 'AbortError';
      this.logger.error({
        event: 'KEY_ROTATION_SLACK_FAILED',
        reason: isTimeout
          ? `Timeout after ${KeyRotationAlertService.SLACK_TIMEOUT_MS}ms`
          : String(error),
      });
      return false;
    }
  }
}