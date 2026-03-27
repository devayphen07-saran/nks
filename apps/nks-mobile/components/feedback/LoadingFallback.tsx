import { View, ActivityIndicator, StyleSheet } from "react-native";

export function LoadingFallback() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: "#df005c",
  },
});
