<template>
  <v-app>
    <v-app-bar app>
      <v-app-bar-title>Azure Service Bus Explorer</v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-container fluid>
        <ServiceBusExplorer />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import ServiceBusExplorer from './components/ServiceBusExplorer.vue'
</script>

<style>
body {
  font-family: 'Roboto', sans-serif;
}
</style>