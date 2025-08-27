<template>
  <div class="explorer">
    <h1>Azure Service Bus Explorer</h1>
 
    <div v-if="loading" class="loading">Loading entities...</div>
    <div v-if="error" class="error">{{ error }}</div>
 
    <div v-if="!loading && !error">
      <div class="filters">
        <div class="filter-group">
          <label>
            <input type="radio" v-model="entityTypeFilter" value="topics" />
            Topics
          </label>
          <label>
            <input type="radio" v-model="entityTypeFilter" value="queues" />
            Queues
          </label>
        </div>
        <div class="filter-group">
          <input type="text" v-model="nameFilter" placeholder="Filter by name..." class="filter-input" />
        </div>
      </div>
 
      <section v-if="entityTypeFilter === 'queues'">
        <h2>Queues ({{ totalQueues.toLocaleString() }})</h2>
        <table v-if="queues.length">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th title="Active Messages">Active</th>
              <th title="Dead-lettered Messages">Dead-letter</th>
              <th title="Scheduled Messages">Scheduled</th>
              <th title="Transfer Messages">Transfer</th>
              <th title="Transfer Dead-lettered Messages">Transfer DLQ</th>
              <th title="Size in Bytes">Size (MB)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="queue in queues" :key="queue.name">
              <td>{{ queue.name }}</td>
              <td>{{ queue.status }}</td>
              <td>{{ queue.activeMessageCount.toLocaleString() }}</td>
              <td>{{ queue.deadLetterMessageCount.toLocaleString() }}</td>
              <td>{{ queue.scheduledMessageCount.toLocaleString() }}</td>
              <td>{{ queue.transferMessageCount.toLocaleString() }}</td>
              <td>{{ queue.transferDeadLetterMessageCount.toLocaleString() }}</td>
              <td>{{ (queue.sizeInBytes / 1024 / 1024).toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="totalPages > 1" class="pagination">
          <button @click="prevPage" :disabled="currentPage === 1">Previous</button>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <button @click="nextPage" :disabled="currentPage === totalPages">Next</button>
        </div>
        <p v-else>No queues found.</p>
      </section>
 
      <section v-if="entityTypeFilter === 'topics'">
        <h2>Topics & Subscriptions ({{ totalSubscriptions.toLocaleString() }})</h2>
        <table v-if="subscriptions.length">
          <thead>
            <tr>
              <th>Topic Name</th>
              <th>Subscription</th>
              <th>Status</th>
              <th title="Active Messages">Active</th>
              <th title="Dead-lettered Messages">DLQ</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in subscriptions" :key="`${sub.topicName}-${sub.subscriptionName}`">
              <td>{{ sub.topicName }}</td>
              <td>{{ sub.subscriptionName }}</td>
              <td>{{ sub.status }}</td>
              <td>{{ sub.activeMessageCount.toLocaleString() }}</td>
              <td>{{ sub.deadLetterMessageCount.toLocaleString() }}</td>
              <td class="actions-cell">
                <button @click="purgeActive(sub)" title="Purge Active Messages" :disabled="sub.activeMessageCount === 0">
                  Purge Active
                </button>
                <button @click="purgeDlq(sub)" title="Purge Dead-lettered Messages" :disabled="sub.deadLetterMessageCount === 0">
                  Purge DLQ
                </button>
                <button @click="toggleSubscriptionStatus(sub)" :title="sub.status === 'Active' ? 'Disable Subscription' : 'Enable Subscription'">
                  {{ sub.status === 'Active' ? 'Disable' : 'Enable' }}
                </button>
                <button @click="deleteSubscription(sub)" title="Delete Subscription" class="danger">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="totalPages > 1" class="pagination">
          <button @click="prevPage" :disabled="currentPage === 1">Previous</button>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <button @click="nextPage" :disabled="currentPage === totalPages">Next</button>
        </div>
        <p v-else-if="!subscriptions.length">No topics or subscriptions found.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';

interface Subscription {
  subscriptionName: string;
  topicName: string;
  status: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  transferMessageCount: number;
  transferDeadLetterMessageCount: number;
}

interface Topic {
  name: string;
  status: string;
  sizeInBytes: number;
  scheduledMessageCount: number;
  subscriptions: Subscription[];
}

interface Queue {
  name: string;
  status: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  scheduledMessageCount: number;
  transferMessageCount: number;
  transferDeadLetterMessageCount: number;
  sizeInBytes: number;
}

const queues = ref<Queue[]>([]);
const totalQueues = ref(0);
const subscriptions = ref<(Subscription & { topicName: string })[]>([]);
const totalSubscriptions = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);
const entityTypeFilter = ref<'topics' | 'queues'>('topics');
const nameFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(25);

const totalPages = computed(() => {
  if (entityTypeFilter.value === 'queues') {
    return Math.ceil(totalQueues.value / pageSize.value);
  }
  return Math.ceil(totalSubscriptions.value / pageSize.value);
});

async function fetchData() {
  try {
    loading.value = true;
    error.value = null;
    const skip = (currentPage.value - 1) * pageSize.value;
    const params = new URLSearchParams({
      skip: skip.toString(),
      top: pageSize.value.toString(),
      nameFilter: nameFilter.value,
    });

    if (entityTypeFilter.value === 'queues') {
      const response = await fetch(`/api/queues?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      queues.value = data.items;
      totalQueues.value = data.total;
    } else {
      // topics -> subscriptions
      const response = await fetch(`/api/subscriptions?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      subscriptions.value = data.items;
      totalSubscriptions.value = data.total;
    }
  } catch (e: any) {
    console.error('Failed to fetch entities:', e);
    error.value = `Failed to fetch data: ${e.message}`;
  } finally {
    loading.value = false;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    fetchData();
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchData();
  }
}

onMounted(() => {
  fetchData();
});

watch([entityTypeFilter, nameFilter], () => {
  currentPage.value = 1;
  fetchData();
});

async function purgeActive(sub: Subscription) {
  if (!confirm(`Are you sure you want to purge active messages from ${sub.topicName}/${sub.subscriptionName}? This may take a while and cannot be undone.`)) return;
  try {
    const response = await fetch('/api/subscriptions/purge-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName: sub.topicName, subscriptionName: sub.subscriptionName })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to purge active messages');
    }
    const result = await response.json();
    alert(result.message);
    fetchData();
  } catch (e: any) {
    error.value = `Failed to purge active messages: ${e.message}`;
  }
}

async function purgeDlq(sub: Subscription) {
  if (!confirm(`Are you sure you want to purge dead-letter messages from ${sub.topicName}/${sub.subscriptionName}? This may take a while and cannot be undone.`)) return;
  try {
    const response = await fetch('/api/subscriptions/purge-dlq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName: sub.topicName, subscriptionName: sub.subscriptionName })
    });
    if (!response.ok) {
       const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to purge DLQ messages');
    }
    const result = await response.json();
    alert(result.message);
    fetchData();
  } catch (e: any) {
    error.value = `Failed to purge DLQ messages: ${e.message}`;
  }
}

async function toggleSubscriptionStatus(sub: Subscription) {
  const newStatus = sub.status === 'Active' ? 'Disabled' : 'Active';
  const action = newStatus === 'Disabled' ? 'disable' : 'enable';
  if (!confirm(`Are you sure you want to ${action} subscription ${sub.topicName}/${sub.subscriptionName}?`)) return;
  try {
    const response = await fetch(`/api/subscriptions/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName: sub.topicName, subscriptionName: sub.subscriptionName, status: newStatus })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} subscription`);
    }
    const result = await response.json();
    alert(result.message);
    fetchData();
  } catch (e: any) {
    error.value = `Failed to ${action} subscription: ${e.message}`;
  }
}

async function deleteSubscription(sub: Subscription) {
  if (!confirm(`Are you sure you want to DELETE subscription ${sub.topicName}/${sub.subscriptionName}? This action cannot be undone.`)) return;
  try {
    const response = await fetch('/api/subscriptions/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName: sub.topicName, subscriptionName: sub.subscriptionName })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete subscription');
    }
    const result = await response.json();
    alert(result.message);
    fetchData();
  } catch (e: any) {
    error.value = `Failed to delete subscription: ${e.message}`;
  }
}
</script>

<style scoped>
.explorer {
  font-family: sans-serif;
  padding: 1rem;
}
.filters {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  align-items: center;
}
.filter-group {
  display: flex;
  gap: 1rem;
  align-items: center;
}
.filter-input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
label {
  cursor: pointer;
}
.actions-cell {
  white-space: nowrap;
}
.actions-cell button {
  margin-right: 5px;
  padding: 4px 8px;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 3px;
  background-color: #f0f0f0;
}
.actions-cell button:hover:not(:disabled) {
  background-color: #e0e0e0;
}
.actions-cell button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pagination {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.pagination button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.actions-cell button.danger {
  background-color: #f44336;
  color: white;
  border-color: #f44336;
}
.actions-cell button.danger:hover:not(:disabled) {
  background-color: #d32f2f;
}
section {
  margin-bottom: 2rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
th,
td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
  white-space: nowrap;
}
th[title] {
  cursor: help;
}
th {
  background-color: #f2f2f2;
}
tr:nth-child(even) {
  background-color: #f9f9f9;
}
.loading,
.error {
  padding: 1rem;
  font-size: 1.2rem;
}
.error {
  color: red;
  background-color: #ffebeb;
  border: 1px solid red;
  border-radius: 4px;
}
</style>
