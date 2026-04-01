# Reusable Select Implementation Guide

This document provides a standardized blueprint for creating dedicated, lookup-driven select components throughout the mobile application.

## 1. Goal Description
Abstract the data fetching and configuration for a specific lookup (e.g., [EntityName]) into a standalone component. This promotes code reuse and keeps feature pages (like forms) clean and maintainable.

## 2. Standardized Pattern

Create the new component under `apps/nks-mobile/components/selects/[EntityName]Select.tsx`.

### Implementation Template

```tsx
import React, { useEffect, useState } from "react";
import { SelectGeneric, BaseSelectItem, Typography } from "@nks/mobile-ui-components";
import { apiGet } from "@nks/mobile-utils";

interface Item { 
  id: number; 
  name: string; // Or the specific display field name
}

interface Props {
  value?: number;
  onChange: (value?: number) => void;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const EntityNameSelect = ({ 
  value, 
  onChange, 
  label = "Label", 
  required = false, 
  errorMessage 
}: Props) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiGet<any>("your/api/endpoint");
        if (res.data) {
          setItems(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <SelectGeneric<Item>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="id"
      onChange={(item) => onChange(item?.id)}
      loading={loading}
      noDataMessage="No items found"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.name : "Select..."}
        </Typography.Body>
      )}
      renderItem={(item, onSelect, isSelected) => (
        <BaseSelectItem
          title={item.name}
          isSelected={isSelected}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
};
```

## 3. Registration
Add the new component to the central export point: `apps/nks-mobile/components/selects/index.ts`.

```tsx
export * from "./[EntityName]Select";
```

## 4. Usage in Forms
Integrate with `react-hook-form` using a `Controller`:

```tsx
<Controller
  name="fieldFk"
  control={control}
  render={({ field: { onChange, value } }) => (
    <EntityNameSelect
      required
      value={value}
      onChange={onChange}
      errorMessage={errors.fieldFk?.message}
    />
  )}
/>
```

## 5. Verification Checklist
- [ ] Component renders with `loading` state initially.
- [ ] Data is correctly fetched from the specified backend endpoint.
- [ ] List renders items with the correct display field.
- [ ] Selection correctly updates the parent form state.
- [ ] Validation errors (from parent) are displayed correctly.
