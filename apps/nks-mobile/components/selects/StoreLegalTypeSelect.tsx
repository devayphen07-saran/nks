import { SelectGeneric, ConfigSelectItem, Typography } from "@nks/mobile-ui-components";
import { useStoreLegalTypesSelect, type StoreLegalTypeSelectItem } from "../../lib/hooks";
import type { SelectMode } from "../../lib/hooks";

interface Props {
  value?: string;
  onChange: (value?: string) => void;
  mode?: SelectMode;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const StoreLegalTypeSelect = ({
  value,
  onChange,
  mode = "fallback",
  label = "Legal type",
  required,
  errorMessage,
}: Props) => {
  const { items, isLoading } = useStoreLegalTypesSelect(mode);

  return (
    <SelectGeneric<StoreLegalTypeSelectItem>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="code"
      onChange={(item) => onChange(item?.code)}
      loading={isLoading}
      noDataMessage="No legal types found"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.title : "Select a legal type"}
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
