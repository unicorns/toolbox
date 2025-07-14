// Type definitions for Slurm dashboard data structures

export interface SlurmPartition {
  PartitionName: string;
  [key: string]: string;
}

export interface SlurmNode {
  NodeName: string;
  State: string;
  Partition?: string;
  [key: string]: string | undefined;
}

export interface SlurmJob {
  JobId: string;
  JobName: string;
  User: string;
  Partition: string;
  State: string;
  [key: string]: string;
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
  [key: string]: string | Record<string, string> | undefined;
}

export interface JobRowProps {
  job: SlurmQueueItem | SlurmHistoryItem;
  isHistory: boolean;
  timezoneMode: string;
  detectedTimezone: string | null;
}

export type NodeJobsMap = Record<string, SlurmQueueItem[]>;

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
  [key: string]: string | SlurmHistoryItem[] | undefined;
}

export interface SlurmData {
  partitions: Map<string, { nodes: Set<string>; details: Record<string, string> }>;
  nodes: Map<string, { details: Record<string, string> }>;
  queue: SlurmQueueItem[];
  history: SlurmHistoryItem[];
  clusterDate: string | null;
  detectedTimezone: string | null;
}

export interface ParsedSlurmData {
  partitions: SlurmPartition[];
  nodes: SlurmNode[];
  queue: SlurmQueueItem[];
  jobs: SlurmJob[];
  history: SlurmHistoryItem[];
}