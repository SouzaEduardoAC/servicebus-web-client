<template>
  <v-dialog :model-value="open" @update:model-value="$emit('update:open', $event)" persistent max-width="600px">
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
        <v-btn color="blue-darken-1" text @click="$emit('close')" :disabled="creating">Cancel</v-btn>
        <v-btn color="blue-darken-1" text @click="handleCreateEntity" :loading="creating" :disabled="creating">
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { createEntity } from '../services/api';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{(e: 'update:open', value: boolean): void; (e: 'close'): void; (e: 'created', entityType: string): void;}>();

const creating = ref(false);
const newEntity = ref({
  type: 'queue',
  name: '',
  subscriptionName: ''
});

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    setTimeout(() => {
      newEntity.value = {
        type: 'queue',
        name: '',
        subscriptionName: ''
      };
    }, 300);
  }
});

function getNewEntityNameLabel() {
  switch(newEntity.value.type) {
    case 'queue': return 'New Queue Name*';
    case 'topic': return 'New Topic Name*';
    case 'subscription': return 'Existing Topic Name*';
    default: return 'Name*';
  }
}

async function handleCreateEntity() {
  creating.value = true;
  try {
    const result = await createEntity(newEntity.value.type, newEntity.value.name, newEntity.value.subscriptionName);
    alert(result.message);
    emit('created', newEntity.value.type);
    emit('close');
  } catch (e: any) {
    alert(`Creation failed: ${e.message}`);
  } finally {
    creating.value = false;
  }
}
</script>
