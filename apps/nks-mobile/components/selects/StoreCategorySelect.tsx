import { SelectGeneric, ConfigSelectItem, Typography } from "@nks/mobile-ui-components";
import { useStoreCategoriesSelect, type StoreCategorySelectItem } from "../../lib/hooks";
import type { SelectMode } from "../../lib/hooks";

interface Props {
  value?: string;
  onChange: (value?: string) => void;
  mode?: SelectMode;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const StoreCategorySelect = ({
  value,
  onChange,
  mode = "fallback",
  label = "Store category",
  required,
  errorMessage,
}: Props) => {
  const { items, isLoading } = useStoreCategoriesSelect(mode);

  return (
    <SelectGeneric<StoreCategorySelectItem>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="code"
      onChange={(item) => onChange(item?.code)}
      loading={isLoading}
      noDataMessage="No categories found"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.title : "Select a category"}
        </Typography.Body>
      )}
      renderItem={(item, onSelect, isSelected) => (
        <ConfigSelectItem
          title={item.title}
          isSelected={isSelected}
          disabled={false}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
};
