<template>
    <div class="container">
        <div class="header">
            <h1>{{ props.activeMonth.monthName }}</h1>
            <button class="new-page" @click="onNextClicked(0)" :disabled="activeMonthIndex === 0"><</button>
            <button class="new-page" @click="onNextClicked(1)" :disabled="activeMonthIndex === 11">></button>
        </div>
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Monday</th>
                    <th>Tuesday</th>
                    <th>Wednesday</th>
                    <th>Thursday</th>
                    <th>Friday</th>
                    <th>Saturday</th>
                    <th>Sunday</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(week, index) in props.activeMonth.weeks" :key="index">
                    <td>{{ week.weekNumber }}</td>
                    <td>{{ week.days[0] }}</td>
                    <td>{{ week.days[1] }}</td>
                    <td>{{ week.days[2] }}</td>
                    <td>{{ week.days[3] }}</td>
                    <td>{{ week.days[4] }}</td>
                    <td>{{ week.days[5] }}</td>
                    <td>{{ week.days[6] }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import Button from 'primevue/button';
const props = defineProps({
    activeMonth: Object,
    activeMonthIndex: Number,
});
const emit = defineEmits(['updateMonth']);
const onNextClicked = (nr) => {
    emit('updateMonth', nr);
    
};
</script>

<style>


table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

th, td {
  border: 1px solid #ccc;
  padding: 10px;
}

th {
  background-color: #f4f4f4;
}

td {
  text-align: center;
  background-color: #f4f4f4;
}

.new-page {
    background-color: #FFF0E6;
    font-size: 20px;
    font-weight: 200;
    border: 2px solid #D3D3D3;
    border-radius: 5px;
}

.new-page:hover {
    background-color: #e9dcd3;
    border: 2px solid #bebebe;
}

</style>