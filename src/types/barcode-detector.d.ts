// Minimal typings for the Web BarcodeDetector API.
// Some TS DOM libs don't ship this yet.

declare interface DetectedBarcode {
    rawValue: string
    format?: string
}

declare class BarcodeDetector {
    constructor(options?: { formats?: string[] })
    static getSupportedFormats(): Promise<string[]>
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
}
