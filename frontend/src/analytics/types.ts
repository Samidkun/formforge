export interface FunnelMetrics {
  views: number;
  starts: number;
  completes: number;
  conversion_rate: number;
}

export interface FieldDropoff {
  field_key: string;
  label: string;
  type: string;
  interactions: number;
  dropouts: number;
  drop_rate: number;
}

export interface DailyStat {
  date: string;
  views: number;
  starts: number;
  completes: number;
}

export interface AnalyticsData {
  funnel: FunnelMetrics;
  dropoff: FieldDropoff[];
  daily: DailyStat[];
}

export interface AnalyticsResult {
  success: boolean;
  data: AnalyticsData;
}
