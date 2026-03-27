import styled from "styled-components/native";
import { View } from "react-native";

interface SkeletonLoaderProps {
  rows?: number;
}
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ rows = 2 }) => {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonItem key={idx}>
          <SkeletonCircle />
          <SkeletonText />
        </SkeletonItem>
      ))}
    </View>
  );
};
const SkeletonItem = styled(View)`
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
`;
const SkeletonCircle = styled(View)`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: #e0e0e0;
`;
const SkeletonText = styled(View)`
  flex: 1;
  height: 16px;
  background-color: #e0e0e0;
  margin-left: 12px;
  border-radius: 4px;
`;
