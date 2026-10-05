// phosphor-react-native's source (imported via deep paths to avoid the 3000-icon barrel) passes
// `className` to <Svg>. react-native-svg's types don't declare it; widen them here.
import "react-native-svg";

declare module "react-native-svg" {
  interface SvgProps {
    className?: string;
  }
}
