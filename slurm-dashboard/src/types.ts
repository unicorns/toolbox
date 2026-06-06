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

export interface SlurmData {
  partitions: Map<string, PartitionData>;
  nodes: Map<string, NodeData>;
  queue: SlurmQueueItem[];
  history: SlurmHistoryItem[];
  clusterDate: string | null;
  detectedTimezone: string | null;
}

/** total/allocated count all nodes; free counts only schedulable nodes. */
export interface ResourcePool {
  total: number;
  allocated: number;
  free: number;
}

export interface UnavailableNode {
  name: string;
  state: string;
  reason: string | null;
}

export interface PartitionCapacity {
  name: string;
  /** null when the partition has no GPUs configured. */
  gpu: ResourcePool | null;
  cpu: ResourcePool;
  memMB: ResourcePool;
  nodesTotal: number;
  nodesIdle: number;
  /** Largest free GPU count on a single schedulable node. */
  largestFreeGpuBlock: number;
  unavailable: UnavailableNode[];
  pendingJobs: number;
  pendingGpus: number;
  pendingCpus: number;
}

export interface ClusterTotals {
  gpu: ResourcePool;
  cpu: ResourcePool;
  memMB: ResourcePool;
  nodesTotal: number;
  nodesIdle: number;
  nodesUnavailable: number;
}

export interface UserUsage {
  user: string;
  jobCount: number;
  nodeCount: number;
  gpus: number;
  cpus: number;
  memMB: number;
  /** StartTime of the user's oldest running job (raw Slurm timestamp). */
  oldestStart: string | null;
  jobs: SlurmQueueItem[];
}

export interface QueueStats {
  total: number;
  running: number;
  pending: number;
  other: number;
}

export interface HistoryStateCount {
  state: string;
  count: number;
}
