import express from 'express';
import {
  getQueues,
  getSubscriptions,
  createTopic,
  createQueue,
  createSubscription,
  purgeActiveMessages,
  purgeDlq,
  purgeQueueActiveMessages,
  purgeQueueDlq,
  setQueueStatus,
  deleteQueue,
  setSubscriptionStatus,
  deleteSubscription,
  getServiceBuses
} from './serviceBus.js';
import { logger } from './config.js';

export const apiRouter = express.Router();

apiRouter.get('/servicebuses', (req, res) => {
  res.json(getServiceBuses());
});

apiRouter.get('/queues', async (req, res) => {
  logger.info('Received request to fetch queues...');
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const top = parseInt(req.query.top, 10) || 25;
    const nameFilter = (req.query.nameFilter || '').toLowerCase();
    const { orderBy, order, serviceBusName } = req.query;

    if (!serviceBusName) {
      return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
    }

    const { items, total } = await getQueues(serviceBusName, skip, top, nameFilter, orderBy, order);
    logger.info(`Returning ${items.length} of ${total} queues.`);
    res.json({ items, total });
  } catch (err) {
    logger.error({ err }, 'Error fetching queues:');
    res.status(500).json({ error: 'Failed to fetch queues.', message: err.message });
  }
});

apiRouter.get('/subscriptions', async (req, res) => {
  logger.info('Received request to fetch subscriptions...');
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const top = parseInt(req.query.top, 10) || 25;
    const nameFilter = (req.query.nameFilter || '').toLowerCase();
    const subscriptionNameFilter = (req.query.subscriptionNameFilter || '').toLowerCase();
    const { orderBy, order, serviceBusName } = req.query;

    if (!serviceBusName) {
      return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
    }

    const { items, total } = await getSubscriptions(serviceBusName, skip, top, nameFilter, subscriptionNameFilter, orderBy, order);
    logger.info(`Returning ${items.length} of ${total} subscriptions.`);
    res.json({ items, total });
  } catch (err) {
    logger.error({ err }, 'Error fetching subscriptions:');
    res.status(500).json({ error: 'Failed to fetch subscriptions.', message: err.message });
  }
});

apiRouter.post('/topics', async (req, res) => {
  const { serviceBusName } = req.query;
  const { name } = req.body;
  logger.info(`Creating topic: ${name}`);
  if (!name) {
    return res.status(400).json({ error: 'Topic name is required.' });
  }
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    await createTopic(serviceBusName, name);
    res.status(201).json({ message: `Topic '${name}' created successfully.` });
  } catch (err) {
    logger.error({ err }, `Error creating topic:`);
    res.status(500).json({ error: 'Failed to create topic.', message: err.message });
  }
});

apiRouter.post('/queues', async (req, res) => {
  const { serviceBusName } = req.query;
  const { name } = req.body;
  logger.info(`Creating queue: ${name}`);
  if (!name) {
    return res.status(400).json({ error: 'Queue name is required.' });
  }
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    await createQueue(serviceBusName, name);
    res.status(201).json({ message: `Queue '${name}' created successfully.` });
  } catch (err) {
    logger.error({ err }, `Error creating queue:`);
    res.status(500).json({ error: 'Failed to create queue.', message: err.message });
  }
});

apiRouter.post('/subscriptions', async (req, res) => {
  const { serviceBusName } = req.query;
  const { topicName, subscriptionName } = req.body;
  logger.info(`Creating subscription '${subscriptionName}' for topic '${topicName}'`);
  if (!topicName || !subscriptionName) {
    return res.status(400).json({ error: 'Topic name and subscription name are required.' });
  }
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    await createSubscription(serviceBusName, topicName, subscriptionName);
    res.status(201).json({ message: `Subscription '${subscriptionName}' created successfully for topic '${topicName}'.` });
  } catch (err) {
    logger.error({ err }, `Error creating subscription:`);
    res.status(500).json({ error: 'Failed to create subscription.', message: err.message });
  }
});

apiRouter.post('/subscriptions/purge-active', async (req, res) => {
  const { serviceBusName } = req.query;
  const { topicName, subscriptionName } = req.body;
  logger.info(`Purging active messages for ${topicName}/${subscriptionName}`);
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    const count = await purgeActiveMessages(serviceBusName, topicName, subscriptionName);
    logger.info(`Total purged active messages: ${count}`);
    res.json({ message: `Successfully purged ${count} active messages.` });
  } catch (err) {
    logger.error({ err }, 'Error purging active messages:');
    res.status(500).json({ error: 'Failed to purge active messages.', message: err.message });
  }
});

apiRouter.post('/subscriptions/purge-dlq', async (req, res) => {
  const { serviceBusName } = req.query;
  const { topicName, subscriptionName } = req.body;
  logger.info(`Purging DLQ messages for ${topicName}/${subscriptionName}`);
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    const count = await purgeDlq(serviceBusName, topicName, subscriptionName);
    logger.info(`Total purged DLQ messages: ${count}`);
    res.json({ message: `Successfully purged ${count} DLQ messages.` });
  } catch (err) {
    logger.error({ err }, 'Error purging DLQ messages:');
    res.status(500).json({ error: 'Failed to purge DLQ messages.', message: err.message });
  }
});

apiRouter.post('/queues/purge-active', async (req, res) => {
  const { serviceBusName } = req.query;
  const { queueName } = req.body;
  logger.info(`Purging active messages for queue ${queueName}`);
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    const count = await purgeQueueActiveMessages(serviceBusName, queueName);
    logger.info(`Total purged active messages: ${count}`);
    res.json({ message: `Successfully purged ${count} active messages.` });
  } catch (err) {
    logger.error({ err }, 'Error purging active messages from queue:');
    res.status(500).json({ error: 'Failed to purge active messages.', message: err.message });
  }
});

apiRouter.post('/queues/purge-dlq', async (req, res) => {
  const { serviceBusName } = req.query;
  const { queueName } = req.body;
  logger.info(`Purging DLQ messages for queue ${queueName}`);
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    const count = await purgeQueueDlq(serviceBusName, queueName);
    logger.info(`Total purged DLQ messages: ${count}`);
    res.json({ message: `Successfully purged ${count} DLQ messages.` });
  } catch (err) {
    logger.error({ err }, 'Error purging DLQ messages from queue:');
    res.status(500).json({ error: 'Failed to purge DLQ messages.', message: err.message });
  }
});

apiRouter.post('/queues/status', async (req, res) => {
  const { serviceBusName } = req.query;
  const { queueName, status } = req.body;
  if (status !== 'Active' && status !== 'Disabled') {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  logger.info(`Setting status to ${status} for queue ${queueName}`);
  try {
    await setQueueStatus(serviceBusName, queueName, status);
    res.json({ message: `Queue status updated to ${status}.` });
  } catch (err) {
    logger.error({ err }, `Error updating queue status:`);
    res.status(500).json({ error: 'Failed to update queue status.', message: err.message });
  }
});

apiRouter.delete('/queues/delete', async (req, res) => {
  const { serviceBusName } = req.query;
  const { queueName } = req.body;
  logger.info(`Deleting queue ${queueName}`);
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    await deleteQueue(serviceBusName, queueName);
    res.json({ message: 'Queue deleted successfully.' });
  } catch (err) {
    logger.error({ err }, 'Error deleting queue:');
    res.status(500).json({ error: 'Failed to delete queue.', message: err.message });
  }
});

apiRouter.post('/subscriptions/status', async (req, res) => {
  const { serviceBusName } = req.query;
  const { topicName, subscriptionName, status } = req.body;
  if (status !== 'Active' && status !== 'Disabled') {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  logger.info(`Setting status to ${status} for subscription ${topicName}/${subscriptionName}`);
  try {
    await setSubscriptionStatus(serviceBusName, topicName, subscriptionName, status);
    res.json({ message: `Subscription status updated to ${status}.` });
  } catch (err) {
    logger.error({ err }, `Error updating subscription status:`);
    res.status(500).json({ error: 'Failed to update subscription status.', message: err.message });
  }
});

apiRouter.delete('/subscriptions/delete', async (req, res) => {
  const { serviceBusName } = req.query;
  const { topicName, subscriptionName } = req.body;
  logger.info(`Deleting subscription ${topicName}/${subscriptionName}`);
  if (!serviceBusName) {
    return res.status(400).json({ error: 'serviceBusName query parameter is required.' });
  }
  try {
    await deleteSubscription(serviceBusName, topicName, subscriptionName);
    res.json({ message: 'Subscription deleted successfully.' });
  } catch (err) {
    logger.error({ err }, 'Error deleting subscription:');
    res.status(500).json({ error: 'Failed to delete subscription.', message: err.message });
  }
});
