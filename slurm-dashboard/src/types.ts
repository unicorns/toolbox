export type TimezoneMode = 'auto' | 'utc' | 'local';

export interface TresResources {
  cpu: string;
  mem: string;
  gres: Record<string, string>;
}

export interface PartitionData {
  nodes: Set<string>;
  details: Record<string, string>;
}

export interface NodeData {
  details: Record<string, string>;
}

export interface SlurmQueueItem {
  JobId: string;
  Partition: string;
  Name: string;
  User: string;
  State: string;
  Time: string;
  TimeLimit: string;
  Nodes: string;
  NodeList: string;
  details?: Record<string, string>;
}

export interface SlurmHistoryItem {
  JobID: string;
  JobName: string;
  User: string;
  Partition: string;
  State: string;
  Start: string;
  End: string;
  Elapsed: string;
  ReqMem: string;
  ReqCPUS: string;
  ReqTRES: string;
  steps?: SlurmHistoryItem[];
}

export interface JobRowProps {
  job: SlurmQueueItem | SlurmHistoryItem;
  isHistory: boolean;
  timezoneMode: TimezoneMode;
  detectedTimezone: string | null;
}

export interface SlurmData {
  partitions: Map<string, PartitionData>;
  nodes: Map<string, NodeData>;
  queue: SlurmQueueItem[];
  history: SlurmHistoryItem[];
  clusterDate: string | null;
  detectedTimezone: string | null;
}

export interface GresTypeSummary {
  type: string;
  total: number;
  allocated: number;
}

export interface PartitionResourceSummary {
  partitionName: string;
  nodesTotal: number;
  nodesUp: number;
  nodesDown: number;
  cpuTotal: number;
  cpuAllocated: number;
  memTotalMB: number;
  memAllocatedMB: number;
  gres: GresTypeSummary[];
}

export interface ClusterResourceSummary {
  partitions: PartitionResourceSummary[];
  totals: PartitionResourceSummary;
}
