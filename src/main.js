import { createApp, computed, reactive, ref, watch } from 'vue/dist/vue.esm-bundler.js';
import yaml from 'js-yaml';
import './styles.css';
import { normalizeMonthDate, parseIsoDate, shiftMonth, shiftYear } from './calendar-utils.js';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toIsoDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function buildMonthGrid({ year, month, schedulesByDate, selectedDateSet, activeDay, primaryDate }) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const isoDate = toIsoDate(date);
    const eventItems = schedulesByDate[isoDate] || [];
    const isPrimaryDate =
      primaryDate.getFullYear() === date.getFullYear() &&
      primaryDate.getMonth() === date.getMonth() &&
      primaryDate.getDate() === date.getDate();

    cells.push({
      empty: false,
      inCurrentMonth: date.getMonth() === month,
      label: String(date.getDate()),
      isoDate,
      isSelected: selectedDateSet.has(isoDate),
      isPrimaryDate,
      isActive: activeDay === isoDate,
      eventItems,
      eventCount: eventItems.length,
    });
  }

  return cells;
}

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
    const calendarView = ref(normalizeMonthDate(today));
    const selectedDates = ref([form.date]);
    const activeDay = ref(form.date);

    const calendarYear = computed(() => calendarView.value.getFullYear());
    const calendarMonth = computed(() => calendarView.value.getMonth());

    const calendarTitle = computed(() => `${monthNames[calendarMonth.value]} ${calendarYear.value}`);

    const selectedDate = computed(() => parseIsoDate(form.date) || new Date());

    const selectedDateSet = computed(() => new Set(selectedDates.value));

    const schedulesByDate = computed(() =>
      schedules.value.reduce((acc, item, index) => {
        if (!acc[item.date]) {
          acc[item.date] = [];
        }
        acc[item.date].push({ ...item, index });
        return acc;
      }, {})
    );

    const activeDaySchedules = computed(() => schedulesByDate.value[activeDay.value] || []);

    const dayCells = computed(() => {
      return buildMonthGrid({
        year: calendarYear.value,
        month: calendarMonth.value,
        schedulesByDate: schedulesByDate.value,
        selectedDateSet: selectedDateSet.value,
        activeDay: activeDay.value,
        primaryDate: selectedDate.value,
      });
    });

    function syncCalendarToDate(date) {
      calendarView.value = normalizeMonthDate(date);
    }

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
      const datesToAdd = selectedDates.value.length ? [...selectedDates.value] : [form.date];

      datesToAdd.forEach((date) => {
        schedules.value.push({
          target: form.target,
          date,
          startTime: form.startTime,
          stopTime: form.stopTime,
          timezone: form.timezone,
        });
      });

      icsNotice.value = `Added ${datesToAdd.length} schedule entr${datesToAdd.length === 1 ? 'y' : 'ies'} from day selection.`;
    }

    function removeSchedule(index) {
      schedules.value.splice(index, 1);
    }

    function prevMonth() {
      calendarView.value = shiftMonth(calendarView.value, -1);
    }

    function nextMonth() {
      calendarView.value = shiftMonth(calendarView.value, 1);
    }

    function prevYear() {
      calendarView.value = shiftYear(calendarView.value, -1);
    }

    function nextYear() {
      calendarView.value = shiftYear(calendarView.value, 1);
    }

    function toggleCalendarDate(isoDate) {
      const picked = new Set(selectedDates.value);
      if (picked.has(isoDate)) {
        picked.delete(isoDate);
      } else {
        picked.add(isoDate);
      }

      const nextSelected = [...picked].sort();
      selectedDates.value = nextSelected;
      form.date = isoDate;
      activeDay.value = isoDate;
      const pickedDate = parseIsoDate(isoDate);
      if (pickedDate) {
        syncCalendarToDate(pickedDate);
      }
    }

    function focusCalendarDate(isoDate) {
      form.date = isoDate;
      activeDay.value = isoDate;
      const pickedDate = parseIsoDate(isoDate);
      if (pickedDate) {
        syncCalendarToDate(pickedDate);
      }
    }

    function clearSelectedDates() {
      selectedDates.value = [];
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

    watch(
      () => form.date,
      (isoDate) => {
        const date = parseIsoDate(isoDate);
        if (!date) {
          return;
        }
        syncCalendarToDate(date);
        if (!selectedDates.value.includes(isoDate)) {
          selectedDates.value = [...selectedDates.value, isoDate].sort();
        }
      },
      { immediate: true }
    );

    return {
      form,
      schedules,
      yamlPreview,
      icsNotice,
      weekdayNames,
      calendarTitle,
      dayCells,
      selectedDates,
      activeDay,
      activeDaySchedules,
      addSchedule,
      removeSchedule,
      prevYear,
      prevMonth,
      nextMonth,
      nextYear,
      toggleCalendarDate,
      focusCalendarDate,
      clearSelectedDates,
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
          <div class="calendar-nav-group">
            <button type="button" class="secondary" @click="prevYear">«</button>
            <button type="button" class="secondary" @click="prevMonth">◀</button>
          </div>
          <strong>{{ calendarTitle }}</strong>
          <div class="calendar-nav-group">
            <button type="button" class="secondary" @click="nextMonth">▶</button>
            <button type="button" class="secondary" @click="nextYear">»</button>
          </div>
        </div>
        <div class="calendar-grid weekdays">
          <span v-for="day in weekdayNames" :key="day">{{ day }}</span>
        </div>
        <div class="calendar-grid">
          <button
            v-for="(cell, idx) in dayCells"
            :key="idx"
            class="calendar-cell"
            :class="{ muted: !cell.inCurrentMonth, selected: cell.isSelected, active: cell.isActive, hasEvents: cell.eventCount > 0 }"
            :disabled="cell.empty"
            @click="!cell.empty && toggleCalendarDate(cell.isoDate)"
          >
            <span class="day-label">{{ cell.label }}</span>
            <span v-if="cell.eventCount" class="event-count">{{ cell.eventCount }} event{{ cell.eventCount > 1 ? 's' : '' }}</span>
            <span
              v-for="(event, eventIdx) in cell.eventItems.slice(0, 2)"
              :key="cell.isoDate + '-' + eventIdx"
              class="event-pill"
            >
              {{ event.startTime }} → {{ event.stopTime }}
            </span>
            <span v-if="cell.eventCount > 2" class="event-pill more">+{{ cell.eventCount - 2 }} more</span>
          </button>
        </div>
        <div class="actions calendar-actions">
          <button type="button" class="secondary" @click="clearSelectedDates">Clear Selected Days</button>
          <span class="notice">Selected days: {{ selectedDates.length || 0 }}</span>
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
          <button type="button" @click="addSchedule">Add Entry</button>
          <button type="button" class="secondary" @click="downloadYaml">Download YAML</button>
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
              <td><button type="button" class="danger" @click="removeSchedule(index)">Remove</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else>No schedules yet. Add one above.</p>
      </section>

      <section class="panel">
        <h2>Day Drill-down</h2>
        <p class="subtitle day-title">{{ activeDay }}</p>
        <table v-if="activeDaySchedules.length">
          <thead>
            <tr><th>#</th><th>Target</th><th>Start</th><th>Stop</th><th>Timezone</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="item in activeDaySchedules" :key="item.date + '-' + item.index">
              <td>{{ item.index + 1 }}</td>
              <td>{{ item.target }}</td>
              <td>{{ item.startTime }}</td>
              <td>{{ item.stopTime }}</td>
              <td>{{ item.timezone }}</td>
              <td>
                <button type="button" class="secondary" @click="focusCalendarDate(item.date)">Focus</button>
                <button type="button" class="danger" @click="removeSchedule(item.index)">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else>No entries for this day yet.</p>
      </section>

      <section class="panel">
        <h2>YAML Preview</h2>
        <pre>{{ yamlPreview }}</pre>
      </section>
    </main>
  `,
}).mount('#app');
