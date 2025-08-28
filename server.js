import express from 'express';
import cors from 'cors';
import { ServiceBusAdministrationClient, ServiceBusClient } from '@azure/service-bus';
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
console.log(connectionString);
if (!connectionString) {
  throw new Error(
    "SERVICEBUS_CONNECTION_STRING_MANAGE environment variable not set. It requires 'Manage' permissions."
  );
}

const adminClient = new ServiceBusAdministrationClient(connectionString);
const sbClient = new ServiceBusClient(connectionString);

// Serve static files from the Vue app build directory
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/queues', async (req, res) => {
  console.log('Received request to fetch queues...');
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const top = parseInt(req.query.top, 10) || 25;
    const nameFilter = (req.query.nameFilter || '').toLowerCase();
    const { orderBy, order } = req.query;

    let allQueueProps = [];
    const queueIterator = adminClient.listQueues();
    for await (const queueProps of queueIterator) {
      allQueueProps.push(queueProps);
    }

    if (nameFilter) {
      allQueueProps = allQueueProps.filter((q) => q.name.toLowerCase().includes(nameFilter));
    }

    if (orderBy && allQueueProps.length > 0) {
      allQueueProps.sort((a, b) => {
        const valA = a[orderBy];
        const valB = b[orderBy];

        if (typeof valA === 'string') {
          return order === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        // for numbers or other types
        if (valA < valB) return order === 'desc' ? 1 : -1;
        if (valA > valB) return order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    const total = allQueueProps.length;
    const pagedQueueProps = allQueueProps.slice(skip, skip + top);

    const items = await Promise.all(
      pagedQueueProps.map(async (queueProps) => {
        const runtimeProps = await adminClient.getQueueRuntimeProperties(queueProps.name);
        return { ...queueProps, ...runtimeProps };
      })
    );

    console.log(`Returning ${items.length} of ${total} queues.`);
    res.json({ items, total });
  } catch (err) {
    console.error('Error fetching queues:', err);
    res.status(500).json({ error: 'Failed to fetch queues.', message: err.message });
  }
});

app.get('/api/subscriptions', async (req, res) => {
  console.log('Received request to fetch subscriptions...');
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const top = parseInt(req.query.top, 10) || 25;
    const nameFilter = (req.query.nameFilter || '').toLowerCase();
    const subscriptionNameFilter = (req.query.subscriptionNameFilter || '').toLowerCase();
    const { orderBy, order } = req.query;

    let allSubscriptionsInfo = [];
    const topicIterator = adminClient.listTopics();
    for await (const topicProps of topicIterator) {
      // If filtering by topic name, skip topics that don't match.
      if (nameFilter && !topicProps.name.toLowerCase().includes(nameFilter)) {
        continue;
      }

      const subscriptionIterator = adminClient.listSubscriptions(topicProps.name);
      for await (const subProps of subscriptionIterator) {
        // If filtering by subscription name, skip subscriptions that don't match.
        if (subscriptionNameFilter && !subProps.subscriptionName.toLowerCase().includes(subscriptionNameFilter)) {
          continue;
        }
        allSubscriptionsInfo.push({ ...subProps, topicName: topicProps.name });
      }
    }

    if (orderBy && allSubscriptionsInfo.length > 0) {
      allSubscriptionsInfo.sort((a, b) => {
        const valA = a[orderBy];
        const valB = b[orderBy];

        if (typeof valA === 'string') {
          return order === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        // for numbers or other types
        if (valA < valB) return order === 'desc' ? 1 : -1;
        if (valA > valB) return order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    const total = allSubscriptionsInfo.length;
    const pagedSubscriptionsInfo = allSubscriptionsInfo.slice(skip, skip + top);

    const items = await Promise.all(
      pagedSubscriptionsInfo.map(async (subInfo) => {
        const subRuntimeProps = await adminClient.getSubscriptionRuntimeProperties(
          subInfo.topicName,
          subInfo.subscriptionName
        );
        return { ...subInfo, ...subRuntimeProps };
      })
    );

    console.log(`Returning ${items.length} of ${total} subscriptions.`);
    res.json({ items, total });
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions.', message: err.message });
  }
});

app.post('/api/topics', async (req, res) => {
  const { name } = req.body;
  console.log(`Creating topic: ${name}`);
  if (!name) {
    return res.status(400).json({ error: 'Topic name is required.' });
  }
  try {
    await adminClient.createTopic(name);
    res.status(201).json({ message: `Topic '${name}' created successfully.` });
  } catch (err) {
    console.error(`Error creating topic:`, err);
    res.status(500).json({ error: 'Failed to create topic.', message: err.message });
  }
});

app.post('/api/queues', async (req, res) => {
  const { name } = req.body;
  console.log(`Creating queue: ${name}`);
  if (!name) {
    return res.status(400).json({ error: 'Queue name is required.' });
  }
  try {
    await adminClient.createQueue(name);
    res.status(201).json({ message: `Queue '${name}' created successfully.` });
  } catch (err) {
    console.error(`Error creating queue:`, err);
    res.status(500).json({ error: 'Failed to create queue.', message: err.message });
  }
});

app.post('/api/subscriptions', async (req, res) => {
  const { topicName, subscriptionName } = req.body;
  console.log(`Creating subscription '${subscriptionName}' for topic '${topicName}'`);
  if (!topicName || !subscriptionName) {
    return res.status(400).json({ error: 'Topic name and subscription name are required.' });
  }
  try {
    // Check if topic exists first to provide a better error message
    await adminClient.getTopic(topicName);
    await adminClient.createSubscription(topicName, subscriptionName);
    res.status(201).json({ message: `Subscription '${subscriptionName}' created successfully for topic '${topicName}'.` });
  } catch (err) {
    console.error(`Error creating subscription:`, err);
    res.status(500).json({ error: 'Failed to create subscription.', message: err.message });
  }
});

app.post('/api/subscriptions/purge-active', async (req, res) => {
  const { topicName, subscriptionName } = req.body;
  console.log(`Purging active messages for ${topicName}/${subscriptionName}`);
  try {
    const receiver = sbClient.createReceiver(topicName, subscriptionName, {
      receiveMode: 'receiveAndDelete',
    });
    let count = 0;
    while (true) {
      // Purge in batches of 100, with a 2-second timeout if no messages are available.
      const messages = await receiver.receiveMessages(100, { maxWaitTimeInMs: 2000 });
      if (messages.length === 0) {
        break;
      }
      count += messages.length;
      console.log(`Purged ${messages.length} messages...`);
    }
    await receiver.close();
    console.log(`Total purged active messages: ${count}`);
    res.json({ message: `Successfully purged ${count} active messages.` });
  } catch (err) {
    console.error('Error purging active messages:', err);
    res.status(500).json({ error: 'Failed to purge active messages.', message: err.message });
  }
});

app.post('/api/subscriptions/purge-dlq', async (req, res) => {
  const { topicName, subscriptionName } = req.body;
  console.log(`Purging DLQ messages for ${topicName}/${subscriptionName}`);
  try {
    const receiver = sbClient.createReceiver(topicName, subscriptionName, {
      subQueueType: 'deadLetter',
      receiveMode: 'receiveAndDelete',
    });
    let count = 0;
    while (true) {
      const messages = await receiver.receiveMessages(100, { maxWaitTimeInMs: 2000 });
      if (messages.length === 0) {
        break;
      }
      count += messages.length;
      console.log(`Purged ${messages.length} DLQ messages...`);
    }
    await receiver.close();
    console.log(`Total purged DLQ messages: ${count}`);
    res.json({ message: `Successfully purged ${count} DLQ messages.` });
  } catch (err) {
    console.error('Error purging DLQ messages:', err);
    res.status(500).json({ error: 'Failed to purge DLQ messages.', message: err.message });
  }
});

app.post('/api/queues/purge-active', async (req, res) => {
  const { queueName } = req.body;
  console.log(`Purging active messages for queue ${queueName}`);
  try {
    const receiver = sbClient.createReceiver(queueName, {
      receiveMode: 'receiveAndDelete',
    });
    let count = 0;
    while (true) {
      const messages = await receiver.receiveMessages(100, { maxWaitTimeInMs: 2000 });
      if (messages.length === 0) {
        break;
      }
      count += messages.length;
      console.log(`Purged ${messages.length} messages...`);
    }
    await receiver.close();
    console.log(`Total purged active messages: ${count}`);
    res.json({ message: `Successfully purged ${count} active messages.` });
  } catch (err) {
    console.error('Error purging active messages from queue:', err);
    res.status(500).json({ error: 'Failed to purge active messages.', message: err.message });
  }
});

app.post('/api/queues/purge-dlq', async (req, res) => {
  const { queueName } = req.body;
  console.log(`Purging DLQ messages for queue ${queueName}`);
  try {
    const receiver = sbClient.createReceiver(queueName, {
      subQueueType: 'deadLetter',
      receiveMode: 'receiveAndDelete',
    });
    let count = 0;
    while (true) {
      const messages = await receiver.receiveMessages(100, { maxWaitTimeInMs: 2000 });
      if (messages.length === 0) {
        break;
      }
      count += messages.length;
      console.log(`Purged ${messages.length} DLQ messages...`);
    }
    await receiver.close();
    console.log(`Total purged DLQ messages: ${count}`);
    res.json({ message: `Successfully purged ${count} DLQ messages.` });
  } catch (err) {
    console.error('Error purging DLQ messages from queue:', err);
    res.status(500).json({ error: 'Failed to purge DLQ messages.', message: err.message });
  }
});

app.post('/api/queues/status', async (req, res) => {
  const { queueName, status } = req.body;
  if (status !== 'Active' && status !== 'Disabled') {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  console.log(`Setting status to ${status} for queue ${queueName}`);
  try {
    const queue = await adminClient.getQueue(queueName);
    queue.status = status;
    await adminClient.updateQueue(queue);
    res.json({ message: `Queue status updated to ${status}.` });
  } catch (err) {
    console.error(`Error updating queue status:`, err);
    res.status(500).json({ error: 'Failed to update queue status.', message: err.message });
  }
});

app.delete('/api/queues/delete', async (req, res) => {
  const { queueName } = req.body;
  console.log(`Deleting queue ${queueName}`);
  try {
    await adminClient.deleteQueue(queueName);
    res.json({ message: 'Queue deleted successfully.' });
  } catch (err) {
    console.error('Error deleting queue:', err);
    res.status(500).json({ error: 'Failed to delete queue.', message: err.message });
  }
});

app.post('/api/subscriptions/status', async (req, res) => {
  const { topicName, subscriptionName, status } = req.body;
  if (status !== 'Active' && status !== 'Disabled') {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  console.log(`Setting status to ${status} for subscription ${topicName}/${subscriptionName}`);
  try {
    const sub = await adminClient.getSubscription(topicName, subscriptionName);
    sub.status = status;
    await adminClient.updateSubscription(sub);
    res.json({ message: `Subscription status updated to ${status}.` });
  } catch (err) {
    console.error(`Error updating subscription status:`, err);
    res.status(500).json({ error: 'Failed to update subscription status.', message: err.message });
  }
});

app.delete('/api/subscriptions/delete', async (req, res) => {
  const { topicName, subscriptionName } = req.body;
  console.log(`Deleting subscription ${topicName}/${subscriptionName}`);
  try {
    await adminClient.deleteSubscription(topicName, subscriptionName);
    res.json({ message: 'Subscription deleted successfully.' });
  } catch (err) {
    console.error('Error deleting subscription:', err);
    res.status(500).json({ error: 'Failed to delete subscription.', message: err.message });
  }
});

// Handle SPA routing: send index.html for any other requests that don't match API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});