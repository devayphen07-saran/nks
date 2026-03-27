import * as ImageManipulator from "expo-image-manipulator";

export interface CompressOptions {
  width?: number;
  quality?: number;
  format?: ImageManipulator.SaveFormat;
}

/**
 * Takes a raw image URI from the camera/gallery and heavily shrinks it.
 * Uses native iOS/Android hardware to perform the downscale.
 *
 * Target Use Case: Before sending 5MB user-uploaded photos to AWS S3.
 */
export const compressImage = async (
  uri: string,
  options?: CompressOptions,
): Promise<ImageManipulator.ImageResult> => {
  // Default bounds to a perfectly performant 800px width at 70% JPEG quality.
  const {
    width = 800,
    quality = 0.7,
    format = ImageManipulator.SaveFormat.JPEG,
  } = options || {};

  try {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress: quality, format },
    );
    return manipulatedImage;
  } catch (error) {
    console.error("[ImageManipulator] Failed to compress image:", error);
    throw error;
  }
};
