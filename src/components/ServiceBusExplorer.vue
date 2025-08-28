
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
          <v-btn color="primary" @click="createDialog = true" class="ml-4">
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
            @update:options="loadData"
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
            @update:options="loadData"
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
    <CreateEntityDialog
      :open="createDialog"
      @update:open="createDialog = $event"
      @close="createDialog = false"
      @created="handleEntityCreated"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Queue, Subscription } from '../services/models';
import * as api from '../services/api';
import CreateEntityDialog from './CreateEntityDialog.vue';

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
const pageSize = ref(10);
const sortBy = ref<any[]>([]);
const createDialog = ref(false);

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
async function loadData({ page, itemsPerPage, sortBy: newSortBy }: { page: number, itemsPerPage: number, sortBy: any[] }) {
  try {
    loading.value = true;
    error.value = null;

    currentPage.value = page;
    pageSize.value = itemsPerPage;
    sortBy.value = newSortBy;

    const data = await api.fetchData(entityTypeFilter.value, currentPage.value, pageSize.value, nameFilter.value, subscriptionNameFilter.value, sortBy.value);

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
  loadData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
});

function handleEntityCreated(entityType: string) {
  if (entityType === 'queue') {
    entityTypeFilter.value = 'queues';
  } else {
    entityTypeFilter.value = 'topics';
  }
  loadData({ page: 1, itemsPerPage: pageSize.value, sortBy: sortBy.value });
}

async function performAction(action: Promise<any>, successMessage: string, errorMessage: string) {
  try {
    const result = await action;
    alert(result.message || successMessage);
    loadData({ page: currentPage.value, itemsPerPage: pageSize.value, sortBy: sortBy.value });
  } catch (e: any) {
    error.value = `${errorMessage}: ${e.message}`;
  }
}

async function purgeActive(sub: Subscription) {
  if (!confirm(`Are you sure you want to purge active messages from ${sub.topicName}/${sub.subscriptionName}? This may take a while and cannot be undone.`)) return;
  await performAction(
    api.purgeActive(sub),
    'Successfully purged active messages.',
    'Failed to purge active messages'
  );
}

async function purgeDlq(sub: Subscription) {
  if (!confirm(`Are you sure you want to purge dead-letter messages from ${sub.topicName}/${sub.subscriptionName}? This may take a while and cannot be undone.`)) return;
  await performAction(
    api.purgeDlq(sub),
    'Successfully purged dead-letter messages.',
    'Failed to purge DLQ messages'
  );
}

async function toggleSubscriptionStatus(sub: Subscription) {
  const newStatus = sub.status === 'Active' ? 'Disabled' : 'Active';
  const action = newStatus === 'Disabled' ? 'disable' : 'enable';
  if (!confirm(`Are you sure you want to ${action} subscription ${sub.topicName}/${sub.subscriptionName}?`)) return;
  await performAction(
    api.toggleSubscriptionStatus(sub),
    `Successfully ${action}d subscription.`,
    `Failed to ${action} subscription`
  );
}

async function deleteSubscription(sub: Subscription) {
  if (!confirm(`Are you sure you want to DELETE subscription ${sub.topicName}/${sub.subscriptionName}? This action cannot be undone.`)) return;
  await performAction(
    api.deleteSubscription(sub),
    'Successfully deleted subscription.',
    'Failed to delete subscription'
  );
}

async function purgeQueueActive(queue: Queue) {
  if (!confirm(`Are you sure you want to purge active messages from queue ${queue.name}? This may take a while and cannot be undone.`)) return;
  await performAction(
    api.purgeQueueActive(queue),
    'Successfully purged active messages.',
    'Failed to purge active messages'
  );
}

async function purgeQueueDlq(queue: Queue) {
  if (!confirm(`Are you sure you want to purge dead-letter messages from queue ${queue.name}? This may take a while and cannot be undone.`)) return;
  await performAction(
    api.purgeQueueDlq(queue),
    'Successfully purged dead-letter messages.',
    'Failed to purge DLQ messages'
  );
}

async function toggleQueueStatus(queue: Queue) {
  const newStatus = queue.status === 'Active' ? 'Disabled' : 'Active';
  const action = newStatus === 'Disabled' ? 'disable' : 'enable';
  if (!confirm(`Are you sure you want to ${action} queue ${queue.name}?`)) return;
  await performAction(
    api.toggleQueueStatus(queue),
    `Successfully ${action}d queue.`,
    `Failed to ${action} queue`
  );
}

async function deleteQueue(queue: Queue) {
  if (!confirm(`Are you sure you want to DELETE queue ${queue.name}? This action cannot be undone.`)) return;
  await performAction(
    api.deleteQueue(queue),
    'Successfully deleted queue.',
    'Failed to delete queue'
  );
}

</script>

<style scoped>
.v-data-table-header__icon {
  display: none !important;
}
</style>
