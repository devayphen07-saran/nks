import {
  SelectGeneric,
  ConfigSelectItem,
  Typography,
} from "@nks/mobile-ui-components";
import { useConfig } from "../../store";

interface StoreLegalType {
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

export const StoreLegalTypeSelect = ({
  value,
  onChange,
  label = "Legal Type",
  required,
  errorMessage,
}: Props) => {
  const {
    config: { response: configData, isLoading: loading },
  } = useConfig();

  // Extract from global config
  const items: StoreLegalType[] = configData?.storeLegalTypes || [];

  return (
    <SelectGeneric<StoreLegalType>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="code"
      onChange={(item) => onChange(item?.code)}
      loading={loading}
      noDataMessage="No legal types found"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.name : "Select Legal Type..."}
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
