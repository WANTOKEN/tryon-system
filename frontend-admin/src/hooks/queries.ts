/**
 * 基于 @tanstack/react-query 的数据查询 hooks。
 * 统一管理后台各页面的初始数据获取，替代手写 useEffect + useState 取数模式。
 */
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, fileApi, clothingApi, configApi } from '../api';

/** 仪表盘 / 系统监控统计 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });
}

/** 文件管理统计 */
export function useFileStats() {
  return useQuery({
    queryKey: ['files', 'stats'],
    queryFn: () => fileApi.stats(),
  });
}

/** 服装分类（相对静态，缓存 5 分钟） */
export function useClothingCategories() {
  return useQuery({
    queryKey: ['clothing', 'categories'],
    queryFn: () => clothingApi.getCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

/** 系统配置分组 */
export function useConfigGrouped() {
  return useQuery({
    queryKey: ['config', 'grouped'],
    queryFn: () => configApi.getGrouped(),
  });
}
