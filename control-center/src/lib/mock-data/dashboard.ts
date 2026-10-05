import { MetricItem, SendingCapacity } from '@/types';

export const mockDashboardMetrics: MetricItem[] = [
  {
    id: 'total-contacts',
    title: 'Total Contacts',
    value: 49333,
    supportingText: 'All contacts in the database',
    iconName: 'users',
    trend: {
      text: 'contacts DB',
      variant: 'neutral',
    },
  },
  {
    id: 'eligible-contacts',
    title: 'Eligible Contacts',
    value: 12420,
    supportingText: 'Currently eligible to receive email',
    iconName: 'user-check',
    trend: {
      text: '25.2% eligible',
      variant: 'success',
    },
  },
  {
    id: 'sent-today',
    title: 'Sent Today',
    value: 87,
    supportingText: 'Emails successfully sent today',
    iconName: 'send',
    trend: {
      text: 'Enforced rate',
      variant: 'neutral',
    },
  },
  {
    id: 'remaining-today',
    title: 'Remaining Today',
    value: 213,
    supportingText: 'Remaining provider/day capacity',
    iconName: 'calendar',
    trend: {
      text: 'Under quota',
      variant: 'warning',
    },
  },
  {
    id: 'active-campaigns',
    title: 'Active Campaigns',
    value: 2,
    supportingText: 'Currently running',
    iconName: 'flame',
    trend: {
      text: '2 running',
      variant: 'success',
    },
  },
  {
    id: 'failed-sends',
    title: 'Failed Sends',
    value: 3,
    supportingText: 'Requires attention',
    iconName: 'alert-triangle',
    trend: {
      text: '0.6% error',
      variant: 'danger',
    },
  },
];

export const mockSendingCapacity: SendingCapacity = {
  sentToday: 87,
  remainingToday: 213,
  capacityLimit: 300,
  percentage: 29,
  globalLimit: 500,
  campaignLimit: 200,
  providerLimit: 300,
  effectiveLimit: 200, // Lowest applicable limit = min(Global 500, Campaign 200, Provider 300) = 200
  providerName: 'Brevo SMTP Relay',
};
