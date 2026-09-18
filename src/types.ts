/**
 * Type definitions for admin-youngtube
 */

export type TabType = 'telemetry' | 'blocks' | 'channels' | 'announcements' | 'status' | 'settings';

export type TimeRangeDays = 7 | 30 | 90;

export interface TelemetryCountry {
  country?: string;
  code?: string;
  country_code?: string;
  name?: string;
  parent_sessions?: number;
  parentSessions?: number;
  parent_duration?: number;
  parentDuration?: number;
  child_sessions?: number;
  childSessions?: number;
  child_duration?: number;
  childDuration?: number;
  unique_users?: number;
  uniqueUsers?: number;
  unique?: number;
  total_sessions?: number;
  totalSessions?: number;
  total_duration?: number;
  totalDuration?: number;
  [key: string]: any;
}

export interface TelemetryDaily {
  date: string;
  parent_sessions?: number;
  parentSessions?: number;
  parent_duration?: number;
  parentDuration?: number;
  child_sessions?: number;
  childSessions?: number;
  child_duration?: number;
  childDuration?: number;
  unique?: number;
  unique_users?: number;
  [key: string]: any;
}

export interface TelemetryData {
  // Common parent/child aggregates
  parent_sessions?: number;
  parentSessions?: number;
  parent_duration?: number; // in seconds
  parentDuration?: number;
  child_sessions?: number;
  childSessions?: number;
  child_duration?: number; // in seconds (PLAYING)
  childDuration?: number;
  unique_users?: number;
  uniqueUsers?: number;
  unique_devices?: number;
  unique?: number;
  total_sessions?: number;
  total_duration?: number;

  // Breakdown lists
  countries?: TelemetryCountry[];
  by_country?: TelemetryCountry[];
  daily?: TelemetryDaily[];
  timeline?: TelemetryDaily[];
  history?: TelemetryDaily[];
  [key: string]: any;
}

export interface BlockItem {
  id: string;
  type: 'channel' | 'playlist';
  title?: string;
  createdAt?: string | number;
  reason?: string;
  [key: string]: any;
}

export interface ChannelItem {
  sourceId: string;
  sourceType: 'channel' | 'playlist';
  title: string;
  categories?: string[];
  thumbnail?: string;
  itemCount?: number;
  addedAt?: string | number;
  [key: string]: any;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning';
  active: boolean;
  createdAt?: string | number;
  updatedAt?: string | number;
  [key: string]: any;
}

export interface StatusResponse {
  ok?: boolean;
  status?: string;
  version?: string;
  channels_count?: number;
  channelsCount?: number;
  channels?: ChannelItem[] | any[];
  sources?: any[];
  archive?: any;
  cache?: {
    cached?: boolean;
    timestamp?: number | string;
    ttl?: number;
    [key: string]: any;
  };
  server_time?: string;
  uptime?: number | string;
  environment?: string;
  [key: string]: any;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}
