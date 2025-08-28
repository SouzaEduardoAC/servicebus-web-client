<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-radio-group v-model="entityTypeFilter" inline class="mr-4">
            <v-radio label="Topics & Subscriptions" value="topics"></v-radio>
            <v-radio label="Queues" value="queues"></v-radio>
          </v-radio-group>
          <v-text-field
            v-model="nameFilter"
            :label="entityTypeFilter === 'topics' ? 'Filter by topic name...' : 'Filter by queue name...'"
            dense
            clearable
            hide-details
            class="flex-grow-1"
          ></v-text-field>
          <v-text-field
            v-if="entityTypeFilter === 'topics'"
            v-model="subscriptionNameFilter"
            label="Filter by subscription name..."
            dense
            clearable
            hide-details
            class="flex-grow-1 ml-4"
          ></v-text-field>
          <v-btn color="primary" @click="openCreateDialog" class="ml-4">
            Create New
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-alert v-if="error" type="error" :text="error" class="mb-4"></v-alert>

        <v-card v-if="entityTypeFilter === 'queues'">
          <v-card-title>Queues ({{ totalQueues.toLocaleString() }})</v-card-title>
          <v-data-table-server
            :headers="queueHeaders"
            :items="queues"
            :items-length="totalQueues"
            :loading="loading"
            v-model:page="currentPage"
            v-model:items-per-page="pageSize"
            @update:options="fetchData"
            class="elevation-1"
          >
            <template v-slot:item.sizeInBytes="{ item }">
              {{ (item.sizeInBytes / 1024 / 1024).toFixed(3) }} MB
            </template>
            <template v-slot:item.actions="{ item }">
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-fire" size="small" @click="purgeQueueActive(item)" :disabled="item.activeMessageCount === 0" class="mr-2">
                  </v-btn>
                </template>
                <span>Purge Active Messages</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-delete-sweep" size="small" @click="purgeQueueDlq(item)" :disabled="item.deadLetterMessageCount === 0" class="mr-2">
                  </v-btn>
                </template>
                <span>Purge Dead-lettered Messages</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" :icon="item.status === 'Active' ? 'mdi-pause-circle' : 'mdi-play-circle'" size="small" @click="toggleQueueStatus(item)" class="mr-2">
                  </v-btn>
                </template>
                <span>{{ item.status === 'Active' ? 'Disable Queue' : 'Enable Queue' }}</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-delete-forever" size="small" color="error" @click="deleteQueue(item)"></v-btn>
                </template>
                <span>Delete Queue</span>
              </v-tooltip>
            </template>
          </v-data-table-server>
        </v-card>

        <v-card v-if="entityTypeFilter === 'topics'">
          <v-card-title>Topics & Subscriptions ({{ totalSubscriptions.toLocaleString() }})</v-card-title>
          <v-data-table-server
            :headers="subscriptionHeaders"
            :items="subscriptions"
            :items-length="totalSubscriptions"
            :loading="loading"
            v-model:page="currentPage"
            v-model:items-per-page="pageSize"
            @update:options="fetchData"
            class="elevation-1"
          >
            <template v-slot:item.actions="{ item }">
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-fire" size="small" @click="purgeActive(item)" :disabled="item.activeMessageCount === 0" class="mr-2">
                  </v-btn>
                </template>
                <span>Purge Active Messages</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-delete-sweep" size="small" @click="purgeDlq(item)" :disabled="item.deadLetterMessageCount === 0" class="mr-2">
                  </v-btn>
                </template>
                <span>Purge Dead-lettered Messages</span>
              </v-tooltip>
               <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" :icon="item.status === 'Active' ? 'mdi-pause-circle' : 'mdi-play-circle'" size="small" @click="toggleSubscriptionStatus(item)" class="mr-2">
                  </v-btn>
                </template>
                <span>{{ item.status === 'Active' ? 'Disable Subscription' : 'Enable Subscription' }}</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-delete-forever" size="small" color="error" @click="deleteSubscription(item)">
                  </v-btn>
                </template>
                <span>Delete Subscription</span>
              </v-tooltip>
            </template>
          </v-data-table-server>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="createDialog" persistent max-width="600px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Create New Entity</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-radio-group v-model="newEntity.type" inline @update:modelValue="newEntity.name = ''; newEntity.subscriptionName = ''">
              <v-radio label="Queue" value="queue"></v-radio>
              <v-radio label="Topic" value="topic"></v-radio>
              <v-radio label="Subscription" value="subscription"></v-radio>
            </v-radio-group>
            <v-text-field
              v-model="newEntity.name"
              :label="getNewEntityNameLabel()"
              required
              class="mt-2"
            />
            <v-text-field
              v-if="newEntity.type === 'subscription'"
              v-model="newEntity.subscriptionName"
              label="New Subscription Name*"
              required
            ></v-text-field>
          </v-container>
          <small>*indicates required field</small>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" text @click="closeCreateDialog" :disabled="creating">Cancel</v-btn>
          <v-btn color="blue-darken-1" text @click="handleCreateEntity" :loading="creating" :disabled="creating">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

// Interfaces
interface Subscription {
  subscriptionName: string;
  topicName: string;
  status: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  transferMessageCount: number;
  transferDeadLetterMessageCount: number;
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

// Refs
const queues = ref<Queue[]>([]);
const totalQueues = ref(0);
const subscriptions = ref<(Subscription & { topicName: string })[]>([]);
const totalSubscriptions = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);
const entityTypeFilter = ref<'topics' | 'queues'>('topics');
const nameFilter = ref('');
const subscriptionNameFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10); // Default items per page
const sortBy = ref<any[]>([]);
const createDialog = ref(false);
const creating = ref(false);
const newEntity = ref({
  type: 'queue',
  name: '',
  subscriptionName: ''
});

// Headers
const queueHeaders: any = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Active', key: 'activeMessageCount', sortable: true },
  { title: 'Dead-letter', key: 'deadLetterMessageCount', sortable: true },
  { title: 'Scheduled', key: 'scheduledMessageCount', sortable: true },
  { title: 'Transfer', key: 'transferMessageCount', sortable: true },
  { title: 'Transfer DLQ', key: 'transferDeadLetterMessageCount', sortable: true },
  { title: 'Size', key: 'sizeInBytes', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end'  },
];

const subscriptionHeaders: any = [
  { title: 'Topic', key: 'topicName', sortable: true },
  { title: 'Subscription', key: 'subscriptionName', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Active', key: 'activeMessageCount', sortable: true },
  { title: 'DLQ', key: 'deadLetterMessageCount', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end'  },
];

// Methods
async function fetchData({ page, itemsPerPage, sortBy: newSortBy }: { page: number, itemsPerPage: number, sortBy: any[] }) {
  try {
    loading.value = true;
    error.value = null;

    // Update local pagination refs
    currentPage.value = page;
    pageSize.value = itemsPerPage;
    sortBy.value = newSortBy;

    const skip = (page - 1) * itemsPerPage;
    const params = new URLSearchParams({
      skip: skip.toString(),
      top: itemsPerPage.toString(),
      nameFilter: nameFilter.value,
    });

    if (entityTypeFilter.value === 'topics' && subscriptionNameFilter.value) {
      params.append('subscriptionNameFilter', subscriptionNameFilter.value);
    }

    if (newSortBy && newSortBy.length > 0) {
      params.append('orderBy', newSortBy[0].key);
      params.append('order', newSortBy[0].order);
    }

    const endpoint = entityTypeFilter.value === 'queues' ? '/api/queues' : '/api/subscriptions';
    const response = await fetch(`${endpoint}?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (entityTypeFilter.value === 'queues') {
      queues.value = data.items;
      totalQueues.value = data.total;
    } else {
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

watch([entityTypeFilter, nameFilter, subscriptionNameFilter], () => {
  currentPage.value = 1;
  // Manually trigger fetchData as options won't have changed if only filters are modified
  fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
});

function openCreateDialog() {
  createDialog.value = true;
}

function closeCreateDialog() {
  createDialog.value = false;
  // Reset form after a short delay to allow dialog to close gracefully
  setTimeout(() => {
    newEntity.value = {
      type: 'queue',
      name: '',
      subscriptionName: ''
    };
  }, 300);
}

async function handleCreateEntity() {
  creating.value = true;
  error.value = null;
  try {
    let endpoint = '';
    let body = {};
    let validationError = '';

    if (newEntity.value.type === 'queue') {
      if (!newEntity.value.name) validationError = 'Queue name is required.';
      endpoint = '/api/queues';
      body = { name: newEntity.value.name };
    } else if (newEntity.value.type === 'topic') {
      if (!newEntity.value.name) validationError = 'Topic name is required.';
      endpoint = '/api/topics';
      body = { name: newEntity.value.name };
    } else { // subscription
      if (!newEntity.value.name) validationError = 'Topic name is required.';
      else if (!newEntity.value.subscriptionName) validationError = 'Subscription name is required.';
      endpoint = '/api/subscriptions';
      body = {
        topicName: newEntity.value.name,
        subscriptionName: newEntity.value.subscriptionName
      };
    }

    if (validationError) {
      alert(validationError);
      return;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to create entity.');
    }

    alert(result.message); // Success message
    closeCreateDialog();
    // Refresh data and go to the relevant view
    if (newEntity.value.type === 'queue') {
      entityTypeFilter.value = 'queues';
    } else {
      entityTypeFilter.value = 'topics';
    }
    fetchData({ page: 1, itemsPerPage: pageSize.value, sortBy: sortBy.value });

  } catch (e: any) {
    alert(`Creation failed: ${e.message}`);
  } finally {
    creating.value = false;
  }
}

function getNewEntityNameLabel() {
  switch(newEntity.value.type) {
    case 'queue': return 'New Queue Name*';
    case 'topic': return 'New Topic Name*';
    case 'subscription': return 'Existing Topic Name*';
    default: return 'Name*';
  }
}

// Action Methods (with confirmation dialogs)
async function purgeActive(sub: Subscription) {
  if (!confirm(`Are you sure you want to purge active messages from ${sub.topicName}/${sub.subscriptionName}? This may take a while and cannot be undone.`)) return;
  // ... (rest of the logic is the same)
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
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to purge active messages: ${e.message}`;
  }
}

async function purgeDlq(sub: Subscription) {
  if (!confirm(`Are you sure you want to purge dead-letter messages from ${sub.topicName}/${sub.subscriptionName}? This may take a while and cannot be undone.`)) return;
  // ... (rest of the logic is the same)
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
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to purge DLQ messages: ${e.message}`;
  }
}

async function toggleSubscriptionStatus(sub: Subscription) {
  const newStatus = sub.status === 'Active' ? 'Disabled' : 'Active';
  const action = newStatus === 'Disabled' ? 'disable' : 'enable';
  if (!confirm(`Are you sure you want to ${action} subscription ${sub.topicName}/${sub.subscriptionName}?`)) return;
  // ... (rest of the logic is the same)
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
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to ${action} subscription: ${e.message}`;
  }
}

async function deleteSubscription(sub: Subscription) {
  if (!confirm(`Are you sure you want to DELETE subscription ${sub.topicName}/${sub.subscriptionName}? This action cannot be undone.`)) return;
  // ... (rest of the logic is the same)
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
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to delete subscription: ${e.message}`;
  }
}

async function purgeQueueActive(queue: Queue) {
  if (!confirm(`Are you sure you want to purge active messages from queue ${queue.name}? This may take a while and cannot be undone.`)) return;
  try {
    const response = await fetch('/api/queues/purge-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueName: queue.name })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to purge active messages');
    }
    const result = await response.json();
    alert(result.message);
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to purge active messages: ${e.message}`;
  }
}

async function purgeQueueDlq(queue: Queue) {
  if (!confirm(`Are you sure you want to purge dead-letter messages from queue ${queue.name}? This may take a while and cannot be undone.`)) return;
  try {
    const response = await fetch('/api/queues/purge-dlq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueName: queue.name })
    });
    if (!response.ok) {
       const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to purge DLQ messages');
    }
    const result = await response.json();
    alert(result.message);
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to purge DLQ messages: ${e.message}`;
  }
}

async function toggleQueueStatus(queue: Queue) {
  const newStatus = queue.status === 'Active' ? 'Disabled' : 'Active';
  const action = newStatus === 'Disabled' ? 'disable' : 'enable';
  if (!confirm(`Are you sure you want to ${action} queue ${queue.name}?`)) return;
  try {
    const response = await fetch(`/api/queues/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueName: queue.name, status: newStatus })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} queue`);
    }
    const result = await response.json();
    alert(result.message);
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to ${action} queue: ${e.message}`;
  }
}

async function deleteQueue(queue: Queue) {
  if (!confirm(`Are you sure you want to DELETE queue ${queue.name}? This action cannot be undone.`)) return;
  try {
    const response = await fetch('/api/queues/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueName: queue.name })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete queue');
    }
    const result = await response.json();
    alert(result.message);
    fetchData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `Failed to delete queue: ${e.message}`;
  }
}

</script>

<style scoped>
/* Scoped styles can be added here if needed, but most styling comes from Vuetify */
.v-data-table-header__icon {
  display: none !important;
}
</style>