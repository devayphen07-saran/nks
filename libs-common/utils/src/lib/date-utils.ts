import dayjs from 'dayjs';

// <-------------- Date Format -------------->

export const viewDateFormat = 'MMM DD, YYYY';

export const apiDateFormat = 'YYYY-MM-DD';

export const dateAndTimeFormat = 'DD-MMM-YYYY HH:mm';

export const timeFormat = 'HH:mm';

export const formatDate = (date?: string, companyDateFormat?: string) => {
  return date
    ? dayjs(date).format(companyDateFormat ?? viewDateFormat).toString()
    : '';
};

export const formatDateTime = (
  dateString?: string,
  companyDateFormat?: string
): string => {
  if (dateString) {
    const date = dayjs(dateString);
    if (date.isValid()) {
      return date
        .format(`${companyDateFormat ?? viewDateFormat} hh:mm A`)
        .toUpperCase();
    }
  }
  return '';
};


export const getRelativeTime = (dateString: string): string => {
  const targetDate = new Date(dateString);
  const currentDate = new Date();

  const diffInMs = currentDate.getTime() - targetDate.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInDays === 0) {
    if (diffInHours === 0) {
      if (diffInMinutes === 0) return `${diffInSeconds} second(s) ago`;
      return `${diffInMinutes} minute(s) ago`;
    }
    return `${diffInHours} hour(s) ago`;
  } else if (diffInDays === 1) {
    return 'yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} day(s) ago`;
  } else if (diffInWeeks === 1) {
    return 'last week';
  } else if (diffInWeeks < 5) {
    return `${diffInWeeks} week(s) ago`;
  } else if (diffInMonths === 1) {
    return 'last month';
  } else if (diffInMonths < 12) {
    return `${diffInMonths} month(s) ago`;
  } else if (diffInYears === 1) {
    return 'last year';
  } else {
    return `${diffInYears} year(s) ago`;
  }
};

export const dayDifference = (
  planExpiresOn: string,
  dateFormatValue?: string
) => {
  const today = dayjs().toDate();
  const expiry = dayjs(planExpiresOn, dateFormatValue ? dateFormatValue : viewDateFormat);
  return expiry.diff(today, 'day');
};

export function formatMinutesToDuration(minutes: number): string {
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  return parts.join(' ') || '0m';
}

export const parseTimeSpent = (timeSpent?: string) => {
  if (!timeSpent) return null;
  const match = timeSpent.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
