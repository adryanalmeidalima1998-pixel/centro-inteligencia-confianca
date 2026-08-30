export {
  WYSCOUT_COL_MAP as WYSCOUT_SERIE_D_HEADERS,
  WYSCOUT_GROUP_LABELS,
  WYSCOUT_CORE_METRICS,
  WYSCOUT_METRIC_GROUPS,
  WYSCOUT_POSITION_GROUPS,
  getRecognizedWyscoutHeaders,
  getSuggestedWyscoutMinimumMinutes,
  getWyscoutDatasetMeta as getWyscoutSerieDMeta,
  getWyscoutMetric,
  getWyscoutMetricGroup,
  getWyscoutPositionGroup,
  normalizeWyscoutPosition,
  parseWyscoutExcel as parseWyscoutSerieD,
  parseWyscoutNumber,
  parseWyscoutRow as parseWyscoutSerieDRow,
  resolveWyscoutHeader,
} from '@/data/wyscout-map'

import { WYSCOUT_METRIC_GROUPS } from '@/data/wyscout-map'
export const WYSCOUT_SERIE_D_METRICS = Object.values(WYSCOUT_METRIC_GROUPS).flatMap(group=>group.metricas)
