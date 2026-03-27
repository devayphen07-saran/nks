import { FlatList, FlatListProps, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileTheme } from "@nks/mobile-theme";
import Divider from "../divider";
import { NoDataContainer } from "./NoDataContainer";
import { FlatListLoading } from "./FlatListLoading";

export interface SerializedError {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
}

interface FlatListScaffoldProps<T> extends FlatListProps<T> {
  listProps: {
    error?:
      | SerializedError
      | {
          status: number;
          data: any;
        };

    refetch: () => void;
    addNew: () => void;
  };
  loaderProps: {
    isLoading: boolean;
    isFetching: boolean;
    loadingCard: React.ReactNode;
    loaderLength: number;
  };
  isThemed?: boolean;
}

export function FlatListScaffold<T>({
  listProps,
  loaderProps,
  isThemed,
  ...restProps
}: FlatListScaffoldProps<T>) {
  const { theme } = useMobileTheme();
  const { error, refetch, addNew } = listProps;
  const insets = useSafeAreaInsets();
  const { isLoading, isFetching, loaderLength, loadingCard } = loaderProps;

  const isEmpty = !restProps.data || restProps.data.length === 0;

  //   Load for the first time. if error... load for fetching...
  if (isLoading || (isFetching && !!error)) {
    return (
      <FlatListLoading
        isLoading={isLoading}
        loadingCard={loadingCard}
        length={loaderLength}
        isFetching={isFetching}
        scrollEnabled={restProps.scrollEnabled}
      />
    );
  }

  if (error) {
    const errorData = error as any;
    return (
      <View style={{ paddingTop: "50%", height: "100%" }}>
        <NoDataContainer
          message="Something went wrong"
          description={errorData?.data?.message}
          iconName="CircleAlert"
          buttonProps={{
            buttonText: "Refresh",
            onPress: refetch,
          }}
        />
      </View>
    );
  }

  return (
    <FlatList
      {...restProps}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <NoDataContainer
            message="No Data Found"
            description={"Add new"}
            iconName="Database"
            buttonProps={{
              buttonText: "Add New",
              onPress: () => {
                addNew();
              },
            }}
          />
        </View>
      }
      refreshControl={
        <RefreshControl
          tintColor={theme.color.primary.main}
          colors={[theme.color.primary.main]}
          refreshing={isFetching}
          style={{
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
          onRefresh={() => {
            refetch();
          }}
        />
      }
      ItemSeparatorComponent={
        isThemed
          ? () => <Divider insetLeft={0} thickness={1} />
          : () => <View style={{ height: 8 }} />
      }
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingHorizontal: theme.padding.xSmall,
        flexGrow: isEmpty ? 1 : undefined,
        paddingTop: theme.padding.xSmall,
        paddingBottom: 10,
        // paddingBottom: insets.bottom,
        backgroundColor:
          isEmpty || isThemed ? theme.colorBgContainer : theme.colorBgLayout,
      }}
      keyboardDismissMode="interactive"
    />
  );
}
