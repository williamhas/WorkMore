<template>
    <div class="card">
        <TypesView :types="store.types" :modules="store.modules" :addedEvents="store.addedEvents" @addType="addType"
            @updateType="updateType" @deleteType="deleteType" />
    </div>
    <div class="card">
        <ModulesView :modules="store.modules" :types="store.types" :addedEvents="store.addedEvents"
            @addModule="addModule" @updateModule="updateModule" @deleteModule="deleteModule" />
    </div>
</template>

<script setup>
import TypesView from '../components/TypesView.vue';
import ModulesView from '../components/ModulesView.vue';
import { addModule, addType, deleteModule, deleteType, store, updateModule, updateType } from '../store.js';
</script>
