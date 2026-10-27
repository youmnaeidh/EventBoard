import type { EventItem } from '../types';
const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const utc = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function calendarText(event: EventItem, url: string) {
  // One date-envelope entry: daily opening hours are explicitly included, never implied as continuous.
  const hours = event.details?.dailyStart ? `\nساعات الزيارة يوميًا: ${event.details.dailyStart}–${event.details.dailyEnd} (الرياض)` : '';
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EventBoard//Demo//AR','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',`UID:event-${event.id}@eventboard.demo`,`DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(event.startsAt)}`,`DTEND:${utc(event.endsAt)}`,`SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs('فعالية تجريبية؛ ليست تذكرة دخول. '+event.summary+hours+'\n'+url)}`,
    `LOCATION:${escapeIcs(event.venue+' · '+event.district)}`,`URL:${url}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function downloadCalendar(event: EventItem) {
  const url = URL.createObjectURL(new Blob([calendarText(event, window.location.href)], {type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download=`${event.slug}.ics`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
