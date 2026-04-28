import {
  SelectGeneric,
  ConfigSelectItem,
  Typography,
} from "@nks/mobile-ui-components";
import { useStoreLegalTypes } from "@nks/api-manager";

interface StoreLegalType {
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

export const StoreLegalTypeSelect = ({
  value,
  onChange,
  label = "Legal Type",
  required,
  errorMessage,
}: Props) => {
  const { data, isLoading } = useStoreLegalTypes();
  const items: StoreLegalType[] = data?.data ?? [];

  return (
    <SelectGeneric<StoreLegalType>
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
          {selected ? selected.title : "Select Legal Type..."}
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
