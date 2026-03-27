import React from "react";
import {
  FlatList,
  FlatListProps,
  StyleProp,
  View,
  ViewStyle,
  ActivityIndicator,
} from "react-native";
import { useMobileTheme } from "@nks/mobile-theme";
import { Divider } from "../divider";
import { LucideIconNameType } from "../lucide-icon";
import { NoDataContainer } from "./NoDataContainer";

interface ActionButtonProps {
  onPress: () => void;
  buttonText: string;
}

export interface ThemedFlatListProps<T> extends FlatListProps<T> {
  showDivider?: boolean;
  showBg?: boolean;
  dividerInsetLeft?: number;
  dividerInsetRight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  EmptyComponentTitle?: string;
  EmptyComponentDescription?: string;
  EmptyComponentIcon?: LucideIconNameType;
  loading?: boolean;
  buttonProps?: ActionButtonProps;
}

export function ThemedFlatList<T>({
  data,
  renderItem,
  showDivider = false,
  dividerInsetLeft = 10,
  dividerInsetRight = 10,
  scrollEnabled = false,
  contentContainerStyle,
  containerStyle,
  ListEmptyComponent,
  EmptyComponentTitle = "No Data Found",
  EmptyComponentDescription = "Try adding new items",
  EmptyComponentIcon = "Inbox",
  loading = false,
  buttonProps,
  showBg = false,
  ...rest
}: ThemedFlatListProps<T>) {
  const { theme } = useMobileTheme();
  const isEmpty = !data || data.length === 0;

  const renderEmpty = () => (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
        minHeight: 300,
      }}
    >
      {ListEmptyComponent ? (
        React.isValidElement(ListEmptyComponent) ? (
          ListEmptyComponent
        ) : (
          React.createElement(ListEmptyComponent as React.ComponentType<any>)
        )
      ) : (
        <NoDataContainer
          message={EmptyComponentTitle}
          description={EmptyComponentDescription}
          iconName={EmptyComponentIcon}
          buttonProps={buttonProps}
        />
      )}
    </View>
  );

  if (loading) {
    // Placeholder for ContainerCardLoading since it was not found
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <ActivityIndicator size="large" color={theme.colorPrimary} />
      </View>
    );
  }

  return (
    <FlatList
      style={[
        {
          marginHorizontal: theme.padding.xSmall,
          backgroundColor: isEmpty || !showBg ? "transparent" : theme.colorBgContainer,
          borderRadius: isEmpty ? 0 : 10,
          marginVertical: 10,
          ...(isEmpty ? {} : {}), // Removed flexGrow: 0 to allow the list to expand and scroll
        },
        containerStyle,
      ]}
      data={data}
      scrollEnabled={scrollEnabled}
      ItemSeparatorComponent={
        showDivider
          ? () => (
              <Divider
                marginVertical={0}
                insetLeft={dividerInsetLeft}
                insetRight={dividerInsetRight}
              />
            )
          : undefined
      }
      contentContainerStyle={[
        {
          flexGrow: 1,
          justifyContent: data?.length ? "flex-start" : "center",
        },
        contentContainerStyle,
      ]}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={renderEmpty}
      {...rest}
    />
  );
}
