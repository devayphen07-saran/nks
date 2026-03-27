import React from "react";
import { ScrollView, View } from "react-native";
import { useMobileTheme } from "@nks/mobile-theme";

interface FlatListLoadingProps {
  isLoading: boolean;
  loadingCard: React.ReactNode;
  length?: number;
  isFetching?: boolean;
  scrollEnabled?: boolean;
}

export const FlatListLoading: React.FC<FlatListLoadingProps> = ({
  loadingCard,
  length = 5,
  scrollEnabled = true,
}) => {
  const { theme } = useMobileTheme();

  // Create an array of length 'length'
  const items = Array.from({ length }, (_, index) => index);

  return (
    <ScrollView
      scrollEnabled={scrollEnabled}
      contentContainerStyle={{
        padding: theme.padding.xSmall,
      }}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item) => (
        <View key={item} style={{ marginBottom: 12 }}>
          {loadingCard}
        </View>
      ))}
    </ScrollView>
  );
};
