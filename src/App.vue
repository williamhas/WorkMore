<script setup>
import { ref } from 'vue';
import Upcoming from './components/Upcoming.vue'
import Importcal from './components/Importcal.vue'
import Calendar from './components/Calendar.vue'


const getISOWeekNumber = (date) => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return Math.ceil((firstThursday - target) / 604800000) + 1;
};
const getWeekDates = (year, week) => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay();
  const ISOweekStart = simple;
  if (dayOfWeek <= 4) 
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(ISOweekStart);
    date.setDate(ISOweekStart.getDate() + i);
    days.push(date.getDate());
  }
  return days;
};
const getWeeksOfMonth = (year, monthIndex) => {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
  const firstWeek = getISOWeekNumber(firstDayOfMonth);
  const lastWeek = getISOWeekNumber(lastDayOfMonth);
  let weekAmount = 0;
  if (Math.abs(lastWeek - firstWeek) > 45) {
    weekAmount = 53 - firstWeek + 1;
  } else {
    weekAmount = getISOWeekNumber(lastDayOfMonth) - firstWeek + 1;
  }
  const weeks = [];
  for (let i = 0; i < weekAmount; i++) {
    const weekNumber = firstWeek + i;
    weeks.push({
      weekNumber,
      days: getWeekDates(year, weekNumber),
    }) 
  }
  return weeks;
};

const setActiveMonth = (monthIndex) => {
  activeMonth.value = months.value[monthIndex];
};


const count = ref(1);
const upComingData = ref({
  data: ['...', '...', '...', '...', '...']
});

const today = new Date();
const year = today.getFullYear();
console.log(year);
const activeMonthIndex = ref(today.getMonth());
const januaryFirst = new Date(today.getFullYear(), 0, 1);
const currentWeekNumber = ref(32);
const currentYear = today.getFullYear();
// Generate weeks data
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];
const months = ref([]);

for (let i = 0; i < 12; i++) {
  const monthName = monthNames[i];
  months.value.push({
    monthName,
    weeks: getWeeksOfMonth(year, i),
  })
};

const activeMonth = ref([]);
setActiveMonth(activeMonthIndex.value);
//console.log("Year", getWeeksOfMonth(11));
// months.value
//console.log("Weeks", weeks); 

const updateCount = (newCount) => {
  count.value = newCount;
};

const fileData = (newData) => {
  upComingData.value.data = newData;
  console.log(upComingData.data);
}

const updateMonth = (nr) => {
  if (nr == 1) {
    activeMonthIndex.value += 1;
  } else {
    activeMonthIndex.value -= 1;
  }
  setActiveMonth(activeMonthIndex.value);
}

</script>

<template>
  <div class="card">
    <Upcoming :count="count" :upComingData="upComingData.data" @updateCount="updateCount" />
  </div>
  <div class="card">
    <Importcal :count="count" :weekNumber="currentWeekNumber" @fileData="fileData" />
  </div>
  <div class="card">
    <Calendar :activeMonth="activeMonth" :activeMonthIndex="activeMonthIndex" @updateMonth="updateMonth"/>
  </div>
</template>

<style scoped></style>
