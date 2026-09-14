# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (previously Volar) and disable Vetur


# About the project

## Idea
This project is was inspired by the personal use to fit modular workouts into the calendar. While that was in the beginning the sole purpose, it was later extended to a fully managable calendar with external bookings.

## Functionality

### Modular functionality
The soly purpose and difference with calendar is that it is based on a modular calendar solution. Since most people have strict habits especially during weekdays, with the same wakeup time, breakfast etc. This page allows for a quick and easy way to modularize the standard schedule. This is done with two different variables, which are "types" and "modules". 

Types are used as a general header to sort activities into broader categories and highlight each in the calendar with a specified color coding to increase visibility in the application when using it. For example, one could make the "meeting" type orange, "workout" green, and "food" red to easier spot what types of activities they have.

The modules are then used to apply the same activity, during the same time on different days and weeks continuously. These are created with a header, type, time, and a description. One might always have lunch with a collegue on thursdays at 12.00. Using the type "Food", selecting a specific time (12.00) and day (Thursday) as well as selecting a repeating activity every week. Sometimes activities are only tied to days and does not need to be a specific time, like vacuuming the house every sunday. Great! Deselect the time and the activity will be shown at the top of each sunday.

### Calendar
The main functionality includes the calendar which showcase each activity during the specific time unless time is not selected in which case it will be shown at the top of the day. In the calendar you can click on the activities to open up the detailed description of them as well as giving the option to be modified as well. It is also possible to add one time calendar activities that do not appear multiple times. This option is the most accesible at the site as it will be used the most. There is also an option to import other calendars into this application or export in a ics format which is most commonly used by other calendar applications.

### Overview
The overview is showcased at the top of the first view once entering the application. This shows the upcoming activities for the day and the upcoming days to easily access the most important information quickly and easily.

### Profile
To access the application, one needs to create a profile, which is done from the first page once entering the application. Here you will be asked to log in or create an account. The account keeps track of your specific calendar. It also allows you to add a name and profile picture in addition to a personalized link.

### External meetings
Sending the link accessed in your profile to an external. Allows them to see your name and profile picture and book a meeting with you. This gives them an option of 15-60 minutes as well as to descripe the contents of the meeting. The available time slots will only be during regular working hours and during times where you do not yet have any bookings. Once sent, you can see these in your calendar.
