import { ServiceBusAdministrationClient, ServiceBusClient } from '@azure/service-bus';
import { serviceBusConfigs } from './config.js';

const clientsCache = new Map();

function getClients(name) {
  if (clientsCache.has(name)) {
    return clientsCache.get(name);
  }

  const config = serviceBusConfigs.find((c) => c.name === name);
  if (!config) {
    throw new Error(`Service Bus configuration with name '${name}' not found.`);
  }

  const adminClient = new ServiceBusAdministrationClient(config.connectionString);
  const sbClient = new ServiceBusClient(config.connectionString);
  const clients = { adminClient, sbClient };
  clientsCache.set(name, clients);
  return clients;
}

export async function getQueues(serviceBusName, skip, top, nameFilter, orderBy, order) {
  const { adminClient } = getClients(serviceBusName);

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

  return { items, total };
}

export async function getSubscriptions(serviceBusName, skip, top, nameFilter, subscriptionNameFilter, orderBy, order) {
  const { adminClient } = getClients(serviceBusName);

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

  return { items, total };
}

export async function createTopic(serviceBusName, name) {
  const { adminClient } = getClients(serviceBusName);
  await adminClient.createTopic(name);
}

export async function createQueue(serviceBusName, name) {
  const { adminClient } = getClients(serviceBusName);
  await adminClient.createQueue(name);
}

export async function createSubscription(serviceBusName, topicName, subscriptionName) {
  const { adminClient } = getClients(serviceBusName);
  // Check if topic exists first to provide a better error message
  await adminClient.getTopic(topicName);
  await adminClient.createSubscription(topicName, subscriptionName);
}

export async function purgeActiveMessages(serviceBusName, topicName, subscriptionName) {
  const { sbClient } = getClients(serviceBusName);
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
  }
  await receiver.close();
  return count;
}

export async function purgeDlq(serviceBusName, topicName, subscriptionName) {
  const { sbClient } = getClients(serviceBusName);
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
  }
  await receiver.close();
  return count;
}

export async function purgeQueueActiveMessages(serviceBusName, queueName) {
  const { sbClient } = getClients(serviceBusName);
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
  }
  await receiver.close();
  return count;
}

export async function purgeQueueDlq(serviceBusName, queueName) {
  const { sbClient } = getClients(serviceBusName);
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
  }
  await receiver.close();
  return count;
}

export async function setQueueStatus(serviceBusName, queueName, status) {
  const { adminClient } = getClients(serviceBusName);
  const queue = await adminClient.getQueue(queueName);
  queue.status = status;
  await adminClient.updateQueue(queue);
}

export async function deleteQueue(serviceBusName, queueName) {
  const { adminClient } = getClients(serviceBusName);
  await adminClient.deleteQueue(queueName);
}

export async function setSubscriptionStatus(serviceBusName, topicName, subscriptionName, status) {
  const { adminClient } = getClients(serviceBusName);
  const sub = await adminClient.getSubscription(topicName, subscriptionName);
  sub.status = status;
  await adminClient.updateSubscription(sub);
}

export async function deleteSubscription(serviceBusName, topicName, subscriptionName) {
  const { adminClient } = getClients(serviceBusName);
  await adminClient.deleteSubscription(topicName, subscriptionName);
}

export function getServiceBuses() {
  return serviceBusConfigs.map(c => ({ name: c.name }));
}
