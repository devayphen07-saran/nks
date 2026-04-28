import {
  SelectGeneric,
  ConfigSelectItem,
  Typography,
} from "@nks/mobile-ui-components";
import { useStoreCategories } from "@nks/api-manager";

interface StoreCategory {
  guuid: string;
  code: string;
  title: string;
}

interface Props {
  value?: string;
  onChange: (value?: string) => void;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const StoreCategorySelect = ({
  value,
  onChange,
  label = "Store Category",
  required,
  errorMessage,
}: Props) => {
  const { data, isLoading } = useStoreCategories();
  const items: StoreCategory[] = data?.data ?? [];

  return (
    <SelectGeneric<StoreCategory>
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
          {selected ? selected.title : "Select Category..."}
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
