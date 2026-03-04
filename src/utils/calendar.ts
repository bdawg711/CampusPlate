// ─── Canvas iCal Calendar Parser ─────────────────────────────────────────────

export interface CalendarEvent {
  name: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, ... 6=Sat
  startTime: string; // "9:30 AM"
  endTime: string;   // "10:45 AM"
  location: string;
  /** ISO date string YYYY-MM-DD for the specific occurrence */
  date: string;
  /** Raw start Date object for sorting */
  _start: Date;
  /** Raw end Date object for gap calculation */
  _end: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get ET offset accounting for DST. Returns minutes to ADD to UTC. */
function getETOffsetMinutes(date: Date): number {
  // Create a formatter that forces America/New_York and extract the offset
  // Simpler approach: check if date falls in DST (EDT = UTC-4) or EST (UTC-5)
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = date.getTimezoneOffset() < stdOffset;
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  return isDST ? -240 : -300;
}

/** Convert a Date from UTC to Eastern Time */
function toET(utcDate: Date): Date {
  const offset = getETOffsetMinutes(utcDate);
  return new Date(utcDate.getTime() + offset * 60 * 1000);
}

/** Format a Date to "9:30 AM" style */
function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Parse iCal DTSTART/DTEND value. Handles both UTC (Z suffix) and local formats. */
function parseICalDate(val: string): Date {
  // Remove any TZID parameter prefix (e.g., "TZID=America/New_York:")
  const colonIdx = val.lastIndexOf(':');
  const dateStr = colonIdx >= 0 && val.includes('TZID') ? val.substring(colonIdx + 1) : val;

  // Format: 20240115T093000Z or 20240115T093000
  const clean = dateStr.replace(/[^0-9TZ]/g, '');
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1;
  const day = parseInt(clean.substring(6, 8), 10);
  const hour = parseInt(clean.substring(9, 11), 10) || 0;
  const min = parseInt(clean.substring(11, 13), 10) || 0;
  const sec = parseInt(clean.substring(13, 15), 10) || 0;

  if (clean.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }
  // Local time — assume ET
  return new Date(year, month, day, hour, min, sec);
}

/** Get the start (Sunday) and end (Saturday) of the current week */
function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Get local YYYY-MM-DD */
function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// RRULE day abbreviations to JS day numbers
const RRULE_DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

// ── Main parser ─────────────────────────────────────────────────────────────

interface RawEvent {
  summary: string;
  dtstart: string;
  dtend: string;
  location: string;
  rrule: string | null;
}

function parseVEvents(icalText: string): RawEvent[] {
  const events: RawEvent[] = [];
  // Unfold long lines (RFC 5545: lines starting with space/tab are continuations)
  const unfolded = icalText.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    if (!block) continue;

    const lines = block.split(/\r?\n/);
    let summary = '';
    let dtstart = '';
    let dtend = '';
    let location = '';
    let rrule: string | null = null;

    for (const line of lines) {
      if (line.startsWith('SUMMARY')) {
        summary = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('DTSTART')) {
        // Could be DTSTART;TZID=...:20240115T093000 or DTSTART:20240115T093000Z
        dtstart = line.substring(line.indexOf(':') + 1).trim();
        // Preserve TZID info if present
        if (line.includes('TZID')) {
          dtstart = line.substring(line.indexOf(';') + 1).trim();
        }
      } else if (line.startsWith('DTEND')) {
        dtend = line.substring(line.indexOf(':') + 1).trim();
        if (line.includes('TZID')) {
          dtend = line.substring(line.indexOf(';') + 1).trim();
        }
      } else if (line.startsWith('LOCATION')) {
        location = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('RRULE')) {
        rrule = line.substring(line.indexOf(':') + 1).trim();
      }
    }

    if (summary && dtstart) {
      events.push({ summary, dtstart, dtend: dtend || dtstart, location, rrule });
    }
  }

  return events;
}

function expandToCurrentWeek(rawEvents: RawEvent[]): CalendarEvent[] {
  const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
  const results: CalendarEvent[] = [];

  for (const ev of rawEvents) {
    const eventStart = parseICalDate(ev.dtstart);
    const eventEnd = parseICalDate(ev.dtend);

    // Check if the event has a weekly recurrence rule
    if (ev.rrule && ev.rrule.includes('FREQ=WEEKLY')) {
      // Parse BYDAY if present (e.g., BYDAY=MO,WE,FR)
      const byDayMatch = ev.rrule.match(/BYDAY=([A-Z,]+)/);
      const untilMatch = ev.rrule.match(/UNTIL=([0-9TZ]+)/);

      // Check UNTIL — skip if recurrence ended before this week
      if (untilMatch) {
        const until = parseICalDate(untilMatch[1]);
        if (until < weekStart) continue;
      }

      let days: number[] = [];
      if (byDayMatch) {
        days = byDayMatch[1].split(',').map((d) => RRULE_DAY_MAP[d]).filter((d) => d !== undefined);
      } else {
        // No BYDAY — recurs on same day of week as DTSTART
        const etStart = eventStart.toISOString().endsWith('Z') ? toET(eventStart) : eventStart;
        days = [etStart.getDay()];
      }

      // Duration in ms
      const durationMs = eventEnd.getTime() - eventStart.getTime();
      const etStart = eventStart.toISOString().endsWith('Z') ? toET(eventStart) : eventStart;
      const startHour = etStart.getHours();
      const startMin = etStart.getMinutes();

      for (const dayNum of days) {
        // Calculate the date for this day of the current week
        const occurrenceDate = new Date(weekStart);
        occurrenceDate.setDate(weekStart.getDate() + dayNum);

        // Skip if before original event start date
        const origDate = new Date(etStart.getFullYear(), etStart.getMonth(), etStart.getDate());
        if (occurrenceDate < origDate) continue;

        // Build occurrence start/end in local time
        const occStart = new Date(
          occurrenceDate.getFullYear(),
          occurrenceDate.getMonth(),
          occurrenceDate.getDate(),
          startHour,
          startMin,
        );
        const occEnd = new Date(occStart.getTime() + durationMs);

        if (occStart >= weekStart && occStart <= weekEnd) {
          results.push({
            name: ev.summary,
            dayOfWeek: dayNum,
            startTime: formatTime(occStart),
            endTime: formatTime(occEnd),
            location: ev.location,
            date: getLocalDateStr(occStart),
            _start: occStart,
            _end: occEnd,
          });
        }
      }
    } else {
      // Non-recurring event — check if it falls in current week
      const etStart = eventStart.toISOString().endsWith('Z') ? toET(eventStart) : eventStart;
      const etEnd = eventEnd.toISOString().endsWith('Z') ? toET(eventEnd) : eventEnd;

      if (etStart >= weekStart && etStart <= weekEnd) {
        results.push({
          name: ev.summary,
          dayOfWeek: etStart.getDay(),
          startTime: formatTime(etStart),
          endTime: formatTime(etEnd),
          location: ev.location,
          date: getLocalDateStr(etStart),
          _start: etStart,
          _end: etEnd,
        });
      }
    }
  }

  // Sort by date then start time
  results.sort((a, b) => a._start.getTime() - b._start.getTime());
  return results;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch an iCal URL and parse it into calendar events for the current week.
 * Returns events sorted by start time.
 */
export async function fetchAndParseCalendar(icalUrl: string): Promise<CalendarEvent[]> {
  const response = await fetch(icalUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar: ${response.status}`);
  }
  const text = await response.text();

  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Invalid iCalendar data');
  }

  const rawEvents = parseVEvents(text);
  return expandToCurrentWeek(rawEvents);
}

/**
 * Get today's events from a pre-parsed list.
 */
export function getTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const d = new Date();
  const today = getLocalDateStr(d);
  return events.filter((e) => e.date === today);
}

/**
 * Identify meal windows (gaps >= 30 min) between classes.
 */
export function getMealWindows(events: CalendarEvent[]): { startTime: string; endTime: string; durationMin: number }[] {
  if (events.length < 2) return [];
  const windows: { startTime: string; endTime: string; durationMin: number }[] = [];

  for (let i = 0; i < events.length - 1; i++) {
    const gapMs = events[i + 1]._start.getTime() - events[i]._end.getTime();
    const gapMin = Math.round(gapMs / 60000);
    if (gapMin >= 30) {
      windows.push({
        startTime: events[i].endTime,
        endTime: events[i + 1].startTime,
        durationMin: gapMin,
      });
    }
  }

  return windows;
}
