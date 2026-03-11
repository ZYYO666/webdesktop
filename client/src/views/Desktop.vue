<template>
  <div>
    <component
      v-if="APPS.DESKTOP && APPS.DESKTOP.component"
      :is="APPS.DESKTOP.component"
    />
    <ContextMenu />
  </div>
</template>

<script setup>
import { APPS } from '@/os/registry/index';
import { createOs, provideOs } from '@/os';
import ContextMenu from '../components/ui/ContextMenu.vue';

const desktopOs = createOs({ windowId: APPS.DESKTOP.id });
provideOs(desktopOs);
</script>
