import type { CategoryItem } from '../types';

export function isCategoryItem(value: unknown): value is CategoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'number' && typeof item.name === 'string'
    && typeof item.slug === 'string' && typeof item.groupName === 'string'
    && typeof item.activeCount === 'number' && typeof item.sortOrder === 'number'
    && (item.description === null || typeof item.description === 'string');
}

export function groupCategories(value: unknown): Record<string, CategoryItem[]> {
  const groups: Record<string, CategoryItem[]> = Object.create(null);
  if (!Array.isArray(value)) return groups;
  for (const category of value) {
    if (!isCategoryItem(category)) continue;
    (groups[category.groupName] ??= []).push(category);
  }
  return groups;
}
