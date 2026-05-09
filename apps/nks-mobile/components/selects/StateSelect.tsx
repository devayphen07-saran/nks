import { SelectGeneric, ConfigSelectItem, Typography } from "@nks/mobile-ui-components";
import { useStatesSelect, type StateSelectItem } from "../../lib/hooks";
import type { SelectMode } from "../../lib/hooks";

interface Props {
  value?: string;
  onChange: (item: StateSelectItem | undefined) => void;
  mode?: SelectMode;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const StateSelect = ({
  value,
  onChange,
  mode = "fallback",
  label = "State",
  required,
  errorMessage,
}: Props) => {
  const { items, isLoading } = useStatesSelect(mode);

  return (
    <SelectGeneric<StateSelectItem>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="guuid"
      onChange={onChange}
      loading={isLoading}
      noDataMessage="No states available"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.stateName : "Select a state"}
        </Typography.Body>
      )}
      renderItem={(item, onSelect, isSelected) => (
        <ConfigSelectItem
          title={item.stateName}
          isSelected={isSelected}
          disabled={false}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
};
