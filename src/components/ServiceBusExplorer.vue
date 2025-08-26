<template>
  <div class="explorer">
    <h1>Azure Service Bus Explorer</h1>

    <div v-if="loading" class="loading">Loading entities...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="!loading && !error">
      <section>
        <h2>Queues ({{ queues.length }})</h2>
        <table v-if="queues.length">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Active Messages</th>
              <th>Dead-lettered Messages</th>
              <th>Size (MB)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="queue in queues" :key="queue.name">
              <td>{{ queue.name }}</td>
              <td>{{ queue.status }}</td>
              <td>{{ queue.activeMessageCount.toLocaleString() }}</td>
              <td>{{ queue.deadLetterMessageCount.toLocaleString() }}</td>
              <td>{{ (queue.sizeInBytes / 1024 / 1024).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else>No queues found.</p>
      </section>

      <section>
        <h2>Topics ({{ topics.length }})</h2>
        <div v-if="topics.length">
          <div v-for="topic in topics" :key="topic.name" class="topic-container">
            <h3>Topic: {{ topic.name }}</h3>
            <p>
              Status: {{ topic.status }} | Size: {{ (topic.sizeInBytes / 1024 / 1024).toFixed(2) }} MB
            </p>
            <h4>Subscriptions ({{ topic.subscriptions.length }})</h4>
            <table v-if="topic.subscriptions.length">
              <thead>
                <tr>
                  <th>Subscription Name</th>
                  <th>Status</th>
                  <th>Active Messages</th>
                  <th>Dead-lettered Messages</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sub in topic.subscriptions" :key="sub.subscriptionName">
                  <td>{{ sub.subscriptionName }}</td>
                  <td>{{ sub.status }}</td>
                  <td>{{ sub.activeMessageCount.toLocaleString() }}</td>
                  <td>{{ sub.deadLetterMessageCount.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else>No subscriptions found for this topic.</p>
          </div>
        </div>
        <p v-else>No topics found.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Subscription {
  subscriptionName: string;
  status: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
}

interface Topic {
  name: string;
  status: string;
  sizeInBytes: number;
  subscriptions: Subscription[];
}

interface Queue {
  name: string;
  status: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  sizeInBytes: number;
}

const queues = ref<Queue[]>([]);
const topics = ref<Topic[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function fetchEntities() {
  try {
    loading.value = true;
    error.value = null;
    const response = await fetch('/api/entities');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    queues.value = data.queues;
    topics.value = data.topics;
  } catch (e: any) {
    console.error('Failed to fetch entities:', e);
    error.value = `Failed to fetch data: ${e.message}`;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchEntities();
});
</script>

<style scoped>
.explorer {
  font-family: sans-serif;
  padding: 1rem;
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
.topic-container {
  border: 1px solid #ccc;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 5px;
}
</style>

