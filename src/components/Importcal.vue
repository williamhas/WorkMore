<template>
    <div class="container">
      <p>Count from parent component: {{ count }}</p>
      <input type="file" @change="handleFileUpload" />
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import * as XLSX from 'xlsx';
    const props = defineProps({
      count: Number,
      weekNumber: Number,
    });
    
    const emit = defineEmits(['fileData']);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                
                emit('fileData', extractRelevantData(jsonData));
            };
        reader.readAsArrayBuffer(file);
        }
    };
    const extractRelevantData = (data) => {
        let dayOfWeek = (new Date().getDay() - 1)
        const weekNumber = props.weekNumber + 8;
        const headers = ['__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6'];
        const keys = Object.keys(data);
        const extractedData = [];
        for (let i = 1; i < keys.length; i++) {
            const key = keys[i];
            let value = data[key];
            let weekRow = Number(value["Träningsprogram Marathon "].split(' ')[1]);
            if (weekRow == weekNumber) {
                for (let j = 0; j < 5; j++) {
                    extractedData.push(value[headers[dayOfWeek]]);
                    dayOfWeek += 1;
                    if (dayOfWeek >= 7) {
                        dayOfWeek = dayOfWeek % 7;
                        value = data[keys[i+1]];
                    }
                }
            }
        }

        
        console.log(extractedData);
        return extractedData;
    };

    

  </script>
  
  <style scoped>
  /* Add scoped styles here if needed */
  </style>
  