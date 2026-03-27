import { Animated } from "react-native";
import { Typography } from "./index";

/**
 * Animated version of Typography components to be used with Animated values (e.g. scroll animations)
 */
export const TypographyAnimated = {
  H1: Animated.createAnimatedComponent(Typography.H1),
  H2: Animated.createAnimatedComponent(Typography.H2),
  H3: Animated.createAnimatedComponent(Typography.H3),
  H4: Animated.createAnimatedComponent(Typography.H4),
  H5: Animated.createAnimatedComponent(Typography.H5),
  Subtitle: Animated.createAnimatedComponent(Typography.Subtitle),
  Body: Animated.createAnimatedComponent(Typography.Body),
  Caption: Animated.createAnimatedComponent(Typography.Caption),
  Overline: Animated.createAnimatedComponent(Typography.Overline),
};
