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

## QA Test Data

Release `v0.1.0` also includes a PDF parse fixture archive for QA:

- [`msty-claw-pdf-parse-test-pdfs.zip`](https://github.com/cloudstack-llc/msty-claw-ocr-runtime/releases/download/v0.1.0/msty-claw-pdf-parse-test-pdfs.zip)
- [`msty-claw-pdf-parse-test-pdfs.zip.sha256`](https://github.com/cloudstack-llc/msty-claw-ocr-runtime/releases/download/v0.1.0/msty-claw-pdf-parse-test-pdfs.zip.sha256)

The archive contains generated smoke-test PDFs plus open-source PDFs from
OCRmyPDF, Apache PDFBox, libHaru, and Wikimedia Commons. It includes a README,
source notes, and per-file checksums for QA handoff.

After downloading both files, verify the archive with:

```sh
shasum -a 256 -c msty-claw-pdf-parse-test-pdfs.zip.sha256
```

## Compatibility

These assets are versioned with the Rust crates and native library versions
used by Msty Claw:

- `liteparse`: `2.0.4`
- `tesseract-rs`: `0.2.0`
- Tesseract: `5.3.4`
- Leptonica: `1.84.1`

If any of these versions change in Msty Claw, publish a new release here before
updating the app build.
