import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const level =
          configService.get<string>('LOG_LEVEL') ?? (isProduction ? 'info' : 'debug');
        return {
          pinoHttp: {
            genReqId: (req: import('http').IncomingMessage) =>
              (req.headers['x-request-id'] as string) || randomUUID(),
            level,
            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    messageFormat:
                      '{req.method} {req.url} → {res.statusCode} ({responseTime}ms) | {msg}',
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
