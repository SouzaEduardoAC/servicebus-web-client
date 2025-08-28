
import type { Queue, Subscription } from './models';

export async function fetchData(serviceBusName: string, entityTypeFilter: 'topics' | 'queues', currentPage: number, pageSize: number, nameFilter: string, subscriptionNameFilter: string, sortBy: any[]) {
    const skip = (currentPage - 1) * pageSize;
    const params = new URLSearchParams({
      skip: skip.toString(),
      top: pageSize.toString(),
      nameFilter: nameFilter,
      serviceBusName,
    });

    if (entityTypeFilter === 'topics' && subscriptionNameFilter) {
      params.append('subscriptionNameFilter', subscriptionNameFilter);
    }

    if (sortBy && sortBy.length > 0) {
      params.append('orderBy', sortBy[0].key);
      params.append('order', sortBy[0].order);
    }

    const endpoint = entityTypeFilter === 'queues' ? '/api/queues' : '/api/subscriptions';
    const response = await fetch(`${endpoint}?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

export async function createEntity(serviceBusName: string, entityType: string, name: string, subscriptionName?: string) {
    let endpoint = '';
    let body = {};
    let validationError = '';

    if (entityType === 'queue') {
      if (!name) validationError = 'Queue name is required.';
      endpoint = '/api/queues';
      body = { name };
    } else if (entityType === 'topic') {
      if (!name) validationError = 'Topic name is required.';
      endpoint = '/api/topics';
      body = { name };
    } else { // subscription
      if (!name) validationError = 'Topic name is required.';
      else if (!subscriptionName) validationError = 'Subscription name is required.';
      endpoint = '/api/subscriptions';
      body = {
        topicName: name,
        subscriptionName
      };
    }

    if (validationError) {
      throw new Error(validationError);
    }

    const response = await fetch(`${endpoint}?serviceBusName=${serviceBusName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to create entity.');
    }

    return result;
}

async function serviceBusAction(serviceBusName: string, endpoint: string, body: object) {
  const response = await fetch(`${endpoint}?serviceBusName=${serviceBusName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to perform action');
  }
  return await response.json();
}

export async function purgeActive(serviceBusName: string, sub: Subscription) {
  return serviceBusAction(serviceBusName, '/api/subscriptions/purge-active', { topicName: sub.topicName, subscriptionName: sub.subscriptionName });
}

export async function purgeDlq(serviceBusName: string, sub: Subscription) {
  return serviceBusAction(serviceBusName, '/api/subscriptions/purge-dlq', { topicName: sub.topicName, subscriptionName: sub.subscriptionName });
}

export async function toggleSubscriptionStatus(serviceBusName: string, sub: Subscription) {
  const newStatus = sub.status === 'Active' ? 'Disabled' : 'Active';
  return serviceBusAction(serviceBusName, '/api/subscriptions/status', { topicName: sub.topicName, subscriptionName: sub.subscriptionName, status: newStatus });
}

export async function deleteSubscription(serviceBusName: string, sub: Subscription) {
  const response = await fetch(`/api/subscriptions/delete?serviceBusName=${serviceBusName}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicName: sub.topicName, subscriptionName: sub.subscriptionName })
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete subscription');
  }
  return await response.json();
}

export async function purgeQueueActive(serviceBusName: string, queue: Queue) {
  return serviceBusAction(serviceBusName, '/api/queues/purge-active', { queueName: queue.name });
}

export async function purgeQueueDlq(serviceBusName: string, queue: Queue) {
  return serviceBusAction(serviceBusName, '/api/queues/purge-dlq', { queueName: queue.name });
}

export async function toggleQueueStatus(serviceBusName: string, queue: Queue) {
  const newStatus = queue.status === 'Active' ? 'Disabled' : 'Active';
  return serviceBusAction(serviceBusName, '/api/queues/status', { queueName: queue.name, status: newStatus });
}

export async function deleteQueue(serviceBusName: string, queue: Queue) {
  const response = await fetch(`/api/queues/delete?serviceBusName=${serviceBusName}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueName: queue.name })
  });
  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete queue');
  }
  return await response.json();
}

export async function getServiceBuses() {
    const response = await fetch('/api/servicebuses');
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
}
