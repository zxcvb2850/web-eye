use wasm_bindgen::prelude::*;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::prelude::*;

#[wasm_bindgen]
pub fn gzip_compress(data: &[u8]) -> Vec<u8> {
   let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
   encoder.write_all(data).unwrap();
   encoder.finish().unwrap()
}