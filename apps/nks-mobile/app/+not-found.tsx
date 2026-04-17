import { Link, Stack } from "expo-router";
import { View } from "react-native";
import styled from "styled-components/native";
import { Typography } from "@nks/mobile-ui-components";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found" }} />
      <Container>
        <Typography.H4 weight="semiBold">Page not found</Typography.H4>
        <Typography.Body type="secondary">This screen doesn't exist.</Typography.Body>
        <Link href="/(protected)">
          <Typography.Body color="#007AFF">Go to home screen</Typography.Body>
        </Link>
      </Container>
    </>
  );
}

const Container = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
  gap: 12px;
`;
