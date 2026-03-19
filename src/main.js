import { createApp, computed, reactive, ref } from 'vue/dist/vue.esm-bundler.js';
import yaml from 'js-yaml';
import './styles.css';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = () => ({
  target: 'tag:Environment=Dev',
  date: new Date().toISOString().slice(0, 10),
  startTime: '08:00',
  stopTime: '18:00',
  timezone: 'America/New_York',
});

createApp({
  setup() {
    const form = reactive(emptyForm());
    const schedules = ref([]);
    const icsNotice = ref('No iCalendar data imported yet.');
    const today = new Date();
    const calendarYear = ref(today.getFullYear());
    const calendarMonth = ref(today.getMonth());

    const calendarTitle = computed(() => `${monthNames[calendarMonth.value]} ${calendarYear.value}`);

    const selectedDate = computed(() => {
      const [y, m, d] = form.date.split('-').map(Number);
      return new Date(y, m - 1, d);
    });

    const dayCells = computed(() => {
      const firstDay = new Date(calendarYear.value, calendarMonth.value, 1).getDay();
      const totalDays = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate();
      const cells = [];

      for (let i = 0; i < firstDay; i += 1) {
        cells.push({ empty: true, label: '' });
      }

      for (let day = 1; day <= totalDays; day += 1) {
        const isoDate = `${calendarYear.value}-${String(calendarMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected =
          selectedDate.value.getFullYear() === calendarYear.value &&
          selectedDate.value.getMonth() === calendarMonth.value &&
          selectedDate.value.getDate() === day;

        cells.push({ empty: false, label: String(day), isoDate, isSelected });
      }

      return cells;
    });

    const yamlPreview = computed(() => {
      const doc = {
        version: 1,
        generatedAt: new Date().toISOString(),
        schedules: schedules.value.map((item, index) => ({
          id: `schedule-${index + 1}`,
          target: item.target,
          timezone: item.timezone,
          date: item.date,
          actions: [
            { at: item.startTime, operation: 'start' },
            { at: item.stopTime, operation: 'stop' },
          ],
        })),
      };

      return yaml.dump(doc, { noRefs: true, lineWidth: 120 });
    });

    function addSchedule() {
      schedules.value.push({ ...form });
    }

    function removeSchedule(index) {
      schedules.value.splice(index, 1);
    }

    function prevMonth() {
      if (calendarMonth.value === 0) {
        calendarMonth.value = 11;
        calendarYear.value -= 1;
        return;
      }
      calendarMonth.value -= 1;
    }

    function nextMonth() {
      if (calendarMonth.value === 11) {
        calendarMonth.value = 0;
        calendarYear.value += 1;
        return;
      }
      calendarMonth.value += 1;
    }

    function selectCalendarDate(isoDate) {
      form.date = isoDate;
    }

    function downloadYaml() {
      const blob = new Blob([yamlPreview.value], { type: 'text/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ec2-schedules.yaml';
      a.click();
      URL.revokeObjectURL(url);
    }

    async function importIcs(event) {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      const text = await file.text();
      const events = parseIcsEvents(text);

      if (!events.length) {
        icsNotice.value = 'No VEVENT items found in iCalendar file.';
        return;
      }

      events.forEach((entry) => {
        schedules.value.push({
          target: form.target,
          timezone: form.timezone,
          date: entry.date,
          startTime: entry.startTime,
          stopTime: entry.stopTime,
        });
      });

      icsNotice.value = `Imported ${events.length} event(s) from iCalendar.`;
      event.target.value = '';
    }

    function parseIcsEvents(source) {
      const blocks = source.split('BEGIN:VEVENT').slice(1).map((chunk) => chunk.split('END:VEVENT')[0] || '');

      return blocks
        .map((block) => {
          const dtStart = block.match(/DTSTART(?:;[^:]+)?:([0-9T]+)/)?.[1];
          const dtEnd = block.match(/DTEND(?:;[^:]+)?:([0-9T]+)/)?.[1];
          if (!dtStart || !dtEnd || dtStart.length < 13 || dtEnd.length < 13) {
            return null;
          }

          const date = `${dtStart.slice(0, 4)}-${dtStart.slice(4, 6)}-${dtStart.slice(6, 8)}`;
          const startTime = `${dtStart.slice(9, 11)}:${dtStart.slice(11, 13)}`;
          const stopTime = `${dtEnd.slice(9, 11)}:${dtEnd.slice(11, 13)}`;
          return { date, startTime, stopTime };
        })
        .filter(Boolean);
    }

    return {
      form,
      schedules,
      yamlPreview,
      icsNotice,
      weekdayNames,
      calendarTitle,
      dayCells,
      addSchedule,
      removeSchedule,
      prevMonth,
      nextMonth,
      selectCalendarDate,
      downloadYaml,
      importIcs,
    };
  },
  template: `
    <main class="app">
      <h1>EC2 Scheduler GUI</h1>
      <p class="subtitle">Build schedules in the browser and export YAML for Lambda-driven automation.</p>

      <section class="panel">
        <h2>Calendar</h2>
        <div class="calendar-header">
          <button class="secondary" @click="prevMonth">◀</button>
          <strong>{{ calendarTitle }}</strong>
          <button class="secondary" @click="nextMonth">▶</button>
        </div>
        <div class="calendar-grid weekdays">
          <span v-for="day in weekdayNames" :key="day">{{ day }}</span>
        </div>
        <div class="calendar-grid">
          <button
            v-for="(cell, idx) in dayCells"
            :key="idx"
            class="calendar-cell"
            :class="{ muted: cell.empty, selected: cell.isSelected }"
            :disabled="cell.empty"
            @click="!cell.empty && selectCalendarDate(cell.isoDate)"
          >
            {{ cell.label }}
          </button>
        </div>
      </section>

      <section class="panel">
        <h2>Add Schedule</h2>
        <div class="grid">
          <label>
            Target (tag or instance)
            <input v-model="form.target" placeholder="tag:Environment=Dev" />
          </label>
          <label>
            Date
            <input v-model="form.date" type="date" />
          </label>
          <label>
            Start Time
            <input v-model="form.startTime" type="time" />
          </label>
          <label>
            Stop Time
            <input v-model="form.stopTime" type="time" />
          </label>
          <label>
            Timezone
            <input v-model="form.timezone" placeholder="America/New_York" />
          </label>
        </div>
        <div class="actions">
          <button @click="addSchedule">Add Entry</button>
          <button class="secondary" @click="downloadYaml">Download YAML</button>
          <label class="file-input">
            Import iCalendar (.ics)
            <input type="file" accept=".ics,text/calendar" @change="importIcs" />
          </label>
        </div>
        <p class="notice">{{ icsNotice }}</p>
      </section>

      <section class="panel">
        <h2>Scheduled Entries</h2>
        <table v-if="schedules.length">
          <thead>
            <tr><th>#</th><th>Target</th><th>Date</th><th>Start</th><th>Stop</th><th>Timezone</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in schedules" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ item.target }}</td>
              <td>{{ item.date }}</td>
              <td>{{ item.startTime }}</td>
              <td>{{ item.stopTime }}</td>
              <td>{{ item.timezone }}</td>
              <td><button class="danger" @click="removeSchedule(index)">Remove</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else>No schedules yet. Add one above.</p>
      </section>

      <section class="panel">
        <h2>YAML Preview</h2>
        <pre>{{ yamlPreview }}</pre>
      </section>
    </main>
  `,
}).mount('#app');
