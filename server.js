import express from 'express';
import cors from 'cors';
import { ServiceBusAdministrationClient } from '@azure/service-bus';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING_MANAGE;

if (!connectionString) {
  throw new Error(
    "SERVICEBUS_CONNECTION_STRING_MANAGE environment variable not set. It requires 'Manage' permissions."
  );
}

const adminClient = new ServiceBusAdministrationClient(connectionString);

// Serve static files from the Vue app build directory
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/entities', async (req, res) => {
  console.log('Received request to fetch Service Bus entities...');
  try {
    // Queues
    const queueIterator = adminClient.listQueues();
    const queues = [];
    for await (const queueProps of queueIterator) {
      const runtimeProps = await adminClient.getQueueRuntimeProperties(queueProps.name);
      queues.push({ ...queueProps, ...runtimeProps });
    }
    console.log(`Found ${queues.length} queues.`);

    // Topics
    const topicIterator = adminClient.listTopics();
    const topics = [];
    for await (const topicProps of topicIterator) {
      const topicRuntimeProps = await adminClient.getTopicRuntimeProperties(topicProps.name);

      // Subscriptions
      const subscriptionIterator = adminClient.listSubscriptions(topicProps.name);
      const subscriptions = [];
      for await (const subProps of subscriptionIterator) {
        const subRuntimeProps = await adminClient.getSubscriptionRuntimeProperties(
          topicProps.name,
          subProps.subscriptionName
        );
        subscriptions.push({ ...subProps, ...subRuntimeProps });
      }
      topics.push({ ...topicProps, ...topicRuntimeProps, subscriptions });
      console.log(`Found topic '${topicProps.name}' with ${subscriptions.length} subscriptions.`);
    }
    console.log(`Found ${topics.length} topics.`);

    res.json({ queues, topics });
  } catch (err) {
    console.error('Error fetching Service Bus entities:', err);
    res.status(500).json({ error: 'Failed to fetch Service Bus entities.', message: err.message });
  }
});

// Handle SPA routing: send index.html for any other requests that don't match API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});