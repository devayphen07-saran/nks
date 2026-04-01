import {
  SelectGeneric,
  ConfigSelectItem,
  Typography,
} from "@nks/mobile-ui-components";
import { useConfig } from "../../store";

interface StoreCategory {
  id: number;
  code: string;
  name: string;
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
  const {
    config: { response: configData, isLoading: loading },
  } = useConfig();

  // Categorize data from global config
  const items: StoreCategory[] = configData?.storeCategories || [];

  return (
    <SelectGeneric<StoreCategory>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="code"
      onChange={(item) => onChange(item?.code)}
      loading={loading}
      noDataMessage="No categories found"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.name : "Select Category..."}
        </Typography.Body>
      )}
      renderItem={(item, onSelect, isSelected) => (
        <ConfigSelectItem
          title={item.name}
          isSelected={isSelected}
          disabled={false}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
};
