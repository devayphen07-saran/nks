import { SelectGeneric, ConfigSelectItem, Typography } from "@nks/mobile-ui-components";
import { useDistrictsSelect, type DistrictSelectItem } from "../../lib/hooks";
import type { SelectMode } from "../../lib/hooks";

interface Props {
  stateGuuid?: string;
  value?: string;
  onChange: (item: DistrictSelectItem | undefined) => void;
  mode?: SelectMode;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const DistrictSelect = ({
  stateGuuid,
  value,
  onChange,
  mode = "fallback",
  label = "District",
  required,
  errorMessage,
}: Props) => {
  const { items, isLoading } = useDistrictsSelect(stateGuuid, mode);

  const noDataMessage = stateGuuid ? "No districts found" : "Select a state first";

  return (
    <SelectGeneric<DistrictSelectItem>
      label={label}
      required={required}
      options={items}
      value={value}
      valueKey="guuid"
      onChange={onChange}
      loading={isLoading}
      noDataMessage={noDataMessage}
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.districtName : "Select a district"}
        </Typography.Body>
      )}
      renderItem={(item, onSelect, isSelected) => (
        <ConfigSelectItem
          title={item.districtName}
          isSelected={isSelected}
          disabled={false}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
};
