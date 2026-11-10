import type { ActionItem } from './contracts/types';

function icsDate(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8);
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** 行动清单导出为 ICS 日历文件内容 */
export function buildIcs(actions: ActionItem[], calendarName = 'ActionEngine'): string {
  const events = actions
    .filter((a) => a.status !== 'dismissed')
    .map((a) =>
      [
        'BEGIN:VEVENT',
        `UID:${a.id}@actionengine`,
        `DTSTART;VALUE=DATE:${icsDate(a.due)}`,
        `SUMMARY:${escapeText(a.title)}（${escapeText(a.owner)}）`,
        `DESCRIPTION:${escapeText(`来源建议：${a.fromSuggestion}${a.note ? `；备注：${a.note}` : ''}`)}`,
        'END:VEVENT',
      ].join('\r\n'),
    );
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//actionengine//CN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
