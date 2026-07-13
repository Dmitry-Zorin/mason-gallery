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
    // Sniff the format from the file *content*, not the extension: files are
    // frequently misnamed (a PNG/WebP saved as `.jpg`), and `ImageReader::open`
    // alone picks the decoder from the extension, so the wrong decoder errors
    // out and the caller falls back to a default aspect ratio — which then
    // crops the real image in the justified grid. `with_guessed_format` matches
    // what `load_from_memory` (the thumbnail path) already does.
    let mut decoder = ImageReader::open(path)?
        .with_guessed_format()?
        .into_decoder()?;
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let dimensions = decoder.dimensions();
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
    fn reads_dimensions_of_a_png_misnamed_as_jpg() {
        // Files are often misnamed (a PNG/WebP saved as `.jpg`). Dimension
        // reading must sniff the content, not trust the extension — otherwise
        // it errors, the caller gets no dimensions, and the grid crops the
        // image against a wrong default aspect. A 200x400 portrait must read
        // back as 200x400, not fail.
        let dir = std::env::temp_dir().join("mg_orient_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("actually_a_png.jpg");
        let buf = image::RgbImage::from_pixel(200, 400, image::Rgb([0, 128, 0]));
        buf.save_with_format(&path, image::ImageFormat::Png).unwrap();
        assert_eq!(image_dimensions(&path).unwrap(), (200, 400));
        let _ = std::fs::remove_file(&path);
    }

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
