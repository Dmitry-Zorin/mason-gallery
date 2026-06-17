use image::metadata::Orientation;
use image::{DynamicImage, ImageDecoder, ImageReader};
use std::io::Cursor;
use std::path::Path;

fn oriented_dimensions((width, height): (u32, u32), orientation: Orientation) -> (u32, u32) {
    match orientation {
        Orientation::Rotate90
        | Orientation::Rotate270
        | Orientation::Rotate90FlipH
        | Orientation::Rotate270FlipH => (height, width),
        Orientation::NoTransforms
        | Orientation::Rotate180
        | Orientation::FlipHorizontal
        | Orientation::FlipVertical => (width, height),
    }
}

pub fn image_dimensions(path: &Path) -> image::ImageResult<(u32, u32)> {
    let mut decoder = ImageReader::open(path)?.into_decoder()?;
    let dimensions = decoder.dimensions();
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    Ok(oriented_dimensions(dimensions, orientation))
}

pub fn load_from_memory(image_data: &[u8]) -> image::ImageResult<DynamicImage> {
    let reader = ImageReader::new(Cursor::new(image_data)).with_guessed_format()?;
    let mut decoder = reader.into_decoder()?;
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let mut img = DynamicImage::from_decoder(decoder)?;
    img.apply_orientation(orientation);
    Ok(img)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swaps_dimensions_for_quarter_turn_orientations() {
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::Rotate90),
            (3000, 4000),
        );
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::Rotate270),
            (3000, 4000),
        );
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::Rotate90FlipH),
            (3000, 4000),
        );
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::Rotate270FlipH),
            (3000, 4000),
        );
    }

    #[test]
    fn keeps_dimensions_for_non_rotating_orientations() {
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::NoTransforms),
            (4000, 3000),
        );
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::Rotate180),
            (4000, 3000),
        );
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::FlipHorizontal),
            (4000, 3000),
        );
        assert_eq!(
            oriented_dimensions((4000, 3000), Orientation::FlipVertical),
            (4000, 3000),
        );
    }
}
