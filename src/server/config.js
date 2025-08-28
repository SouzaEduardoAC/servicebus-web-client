import 'dotenv/config';
import pino from 'pino';

export const logger = pino();

export const serviceBusConfigs = [];
// Legacy single connection string for backward compatibility
if (process.env.SERVICEBUS_CONNECTION_STRING_MANAGE) {
  serviceBusConfigs.push({
    name: process.env.SERVICEBUS_NAME || 'default',
    connectionString: process.env.SERVICEBUS_CONNECTION_STRING_MANAGE,
  });
}

// Multi-connection string support e.g. SERVICEBUS_1_NAME, SERVICEBUS_1_CONNECTION_STRING
let i = 1;
while (process.env[`SERVICEBUS_${i}_NAME`] && process.env[`SERVICEBUS_${i}_CONNECTION_STRING`]) {
  serviceBusConfigs.push({
    name: process.env[`SERVICEBUS_${i}_NAME`],
    connectionString: process.env[`SERVICEBUS_${i}_CONNECTION_STRING`],
  });
  i++;
}

if (serviceBusConfigs.length === 0) {
  logger.error('No Service Bus connection strings configured. Set SERVICEBUS_CONNECTION_STRING_MANAGE or SERVICEBUS_1_NAME/SERVICEBUS_1_CONNECTION_STRING etc. environment variables.');
  process.exit(1);
}

logger.info(`Found ${serviceBusConfigs.length} service bus configurations:`, serviceBusConfigs.map(c => c.name).join(', '));

export const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
export const apiKey = process.env.API_KEY;
export const port = process.env.PORT || 3001;
