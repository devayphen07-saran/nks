import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

/**
 * Configure and initialize Swagger OpenAPI documentation.
 */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('NKS Backend API')
    .setDescription('API documentation. All responses include `X-API-Version: 1`. Deprecated routes additionally carry `Deprecation: true` and `Sunset` headers (RFC 8594).')
    .setVersion('1')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Version' }, 'api-version')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);
}
