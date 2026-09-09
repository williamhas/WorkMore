<template>
  <div class="container">
    <div class="header-text">
      <h1>Upcoming days</h1>
    </div>
    <div class="days-container">
      <div v-for="(item, index) in itemsWithHeaders" :key="index" class="box" @mouseover="hoverItem = index"
        @mouseout="hoverItem = null" :class="{ 'hovered': hoverItem === index }">
        <h3>{{ item.header }}</h3>
        <p>{{ item.text }}</p>
      </div>
    </div>
    <button type="button" @click="incrementCount">count is {{ props.count }}</button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  count: Number,
  upComingData: Array,
});
const emit = defineEmits(['updateCount']);
let hoverItem = ref(null);
const itemsWithHeaders = computed(() => {
  return props.upComingData.map((text, index) => ({
    header: headers[index],
    text: text,
  }));
});

const incrementCount = () => {
  emit('updateCount', props.count + 1);
};



const getDayOfWeek = (date) => {
  const options = { weekday: 'long' };
  return new Intl.DateTimeFormat('en-US', options).format(date);
};

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(today.getDate() + 2);

const twoDaysAfterTomorrow = new Date(today);
twoDaysAfterTomorrow.setDate(today.getDate() + 3);

const threeDaysAfterTomorrow = new Date(today);
threeDaysAfterTomorrow.setDate(today.getDate() + 4);

const headers = [
  'Today',
  'Tomorrow',
  getDayOfWeek(dayAfterTomorrow),
  getDayOfWeek(twoDaysAfterTomorrow),
  getDayOfWeek(threeDaysAfterTomorrow),
];

watch(() => props.upComingData, (newData) => {
  itemsWithHeaders.value = newData.map((text, index) => ({
    header: headers[index],
    text: text,
  }));
});

</script>

<style scoped>
.container {
  
}

.days-container {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.box {
  flex: 1;
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.box:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.hovered {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
</style>
