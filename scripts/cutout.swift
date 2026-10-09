// Cuts the subject (model or garment) out of its background with Apple's
// Vision framework, on this Mac. Nothing is uploaded.
//   swift scripts/cutout.swift <input image> <output.png> [<input> <output> ...]
// Writes a PNG with a transparent background, same size as the input.
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

func cutout(_ input: URL, _ output: URL) throws {
  let request = VNGenerateForegroundInstanceMaskRequest()
  let handler = VNImageRequestHandler(url: input)
  try handler.perform([request])
  guard let result = request.results?.first else {
    throw NSError(domain: "cutout", code: 1, userInfo: [NSLocalizedDescriptionKey: "no subject found in \(input.lastPathComponent)"])
  }
  let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
  let image = CIImage(cvPixelBuffer: buffer)
  let context = CIContext()
  guard let cg = context.createCGImage(image, from: image.extent),
        let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    throw NSError(domain: "cutout", code: 2, userInfo: [NSLocalizedDescriptionKey: "could not write \(output.lastPathComponent)"])
  }
  CGImageDestinationAddImage(dest, cg, nil)
  guard CGImageDestinationFinalize(dest) else {
    throw NSError(domain: "cutout", code: 3, userInfo: [NSLocalizedDescriptionKey: "could not save \(output.lastPathComponent)"])
  }
}

let args = Array(CommandLine.arguments.dropFirst())
var failed = 0
for i in stride(from: 0, to: args.count - 1, by: 2) {
  do {
    try cutout(URL(fileURLWithPath: args[i]), URL(fileURLWithPath: args[i + 1]))
    print("ok", args[i + 1])
  } catch {
    print("FAIL", error.localizedDescription)
    failed += 1
  }
}
exit(failed == 0 ? 0 : 1)
