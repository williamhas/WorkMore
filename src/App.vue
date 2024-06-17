<script setup>
import { ref } from 'vue';
import Upcoming from './components/Upcoming.vue'
import Importcal from './components/Importcal.vue'
const count = ref(1);
const weekNumber = ref(32);
const upComingData = ref({
  data: ['...', '...', '...', '...', '...']
});

const updateCount = (newCount) => {
  count.value = newCount;
};

const fileData = (newData) => {
  upComingData.value.data = newData;
  console.log(upComingData.data);
}
const getISOWeekNumber = (date) => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  weekNumber.value = Math.ceil((firstThursday - target) / 604800000) + 1;
};
</script>

<template>
  <div class="card">
    <Upcoming :count="count" :upComingData="upComingData.data" @updateCount="updateCount" />
  </div>
  <div class="card">
    <Importcal :count="count" :weekNumber="weekNumber" @fileData="fileData" />
  </div>
</template>

<style scoped></style>
