<template>
  <v-app>
    <v-app-bar>
      <v-app-bar-title>Azure Service Bus Explorer</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="toggleTheme">
        <v-icon>mdi-theme-light-dark</v-icon>
      </v-btn>
    </v-app-bar>
    <v-main>
      <v-container fluid>
        <ServiceBusExplorer />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
import ServiceBusExplorer from './components/ServiceBusExplorer.vue'

const theme = useTheme()

function toggleTheme() {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
}
</script>

<style>
body {
  font-family: 'Roboto', sans-serif;
}
</style>