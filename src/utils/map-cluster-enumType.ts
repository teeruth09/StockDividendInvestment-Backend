import { ClusterType } from 'src/stock/stockAnalysis.type';

export function mapClusterToType(mlText: string): ClusterType {
  const text = mlText.toLowerCase();

  if (text.includes('trap')) return ClusterType.DIVIDEND_TRAP;
  if (text.includes('golden')) return ClusterType.GOLDEN_GOOSE;
  if (text.includes('neutral')) return ClusterType.NEUTRAL;
  if (text.includes('rebound')) return ClusterType.REBOUND_STAR;

  return ClusterType.UNKNOWN;
}
