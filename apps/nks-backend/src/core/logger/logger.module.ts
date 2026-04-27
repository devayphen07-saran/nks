import type { IncomingMessage, ServerResponse } from 'http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

type ExpressReq = IncomingMessage & { route?: { path?: string } };

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';
        const isProduction = nodeEnv === 'production';
        const level =
          configService.get<string>('LOG_LEVEL') ?? (isProduction ? 'info' : 'debug');
        const env = nodeEnv;

        return {
          pinoHttp: {
            genReqId: (req: IncomingMessage) =>
              (req.headers['x-request-id'] as string) || randomUUID(),

            level,

            // Stamped on every log line — lets you filter by service / env in
            // Datadog, ELK, or any other log aggregator without parsing the msg.
            base: { service: 'nks-backend', env },

            // Censor sensitive header values before the log is serialized.
            // The field key is still present (so you can see a header was sent)
            // but the value is replaced with [REDACTED].
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },

            // Append the Express route template (e.g. /users/:id/roles) as a
            // dedicated field. pinoHttp logs the raw URL by default, which
            // contains actual param values and creates unbounded cardinality in
            // aggregators. routeTemplate is set at response-complete time so
            // req.route is guaranteed to be populated by Express routing.
            customSuccessObject: (
              req: IncomingMessage,
              _res: ServerResponse,
              val: Record<string, unknown>,
            ): Record<string, unknown> => ({
              ...val,
              routeTemplate: (req as ExpressReq).route?.path,
            }),

            customErrorObject: (
              req: IncomingMessage,
              _res: ServerResponse,
              _err: Error,
              val: Record<string, unknown>,
            ): Record<string, unknown> => ({
              ...val,
              routeTemplate: (req as ExpressReq).route?.path,
            }),

            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname,service,env',
                    // routeTemplate replaces req.url so aggregators see a
                    // stable key rather than a path with param values.
                    messageFormat:
                      '{req.method} {routeTemplate} → {res.statusCode} ({responseTime}ms) | {msg}',
                  },
                }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
