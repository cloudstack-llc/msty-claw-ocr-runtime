# Msty Claw OCR Runtime Cache

This repository publishes prebuilt OCR cache archives for Msty Claw.

The archives are not sidecar runtimes. They mirror the cache layout used by
`tesseract-rs` so Msty Claw developers and CI can link OCR support without
building Tesseract and Leptonica locally.

## Release Assets

Each release is built by `.github/workflows/release.yml` and uploads:

- `msty-claw-ocr-runtime-darwin-arm64.tar.gz`
- `msty-claw-ocr-runtime-darwin-x64.tar.gz`
- `msty-claw-ocr-runtime-linux-x64.tar.gz`
- `msty-claw-ocr-runtime-win32-x64.zip`
- matching `.sha256` files

Each archive contains:

- `cache/`
- `leptonica/`
- `tesseract/`
- `third_party/`
- `tessdata/eng.traineddata`
- `tessdata/tur.traineddata`
- `manifest.json`

## Compatibility

These assets are versioned with the Rust crates and native library versions
used by Msty Claw:

- `liteparse`: `2.0.4`
- `tesseract-rs`: `0.2.0`
- Tesseract: `5.3.4`
- Leptonica: `1.84.1`

If any of these versions change in Msty Claw, publish a new release here before
updating the app build.
