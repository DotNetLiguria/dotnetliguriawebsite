using System;
using System.IO;
using SkiaSharp;

namespace BlazorAppTest.Server
{
    public static class QrPayload
    {
        public static string Decode(Stream stream)
        {
            using var nativeStream = new SKManagedStream(stream, disposeManagedStream: false);
            using var bitmap = SKBitmap.Decode(nativeStream);
            if (bitmap == null)
                return null;

            var reader = new ZXing.SkiaSharp.BarcodeReader { AutoRotate = true };
            return reader.Decode(bitmap)?.Text;
        }

        public static bool MatchesWorkshop(string workshopId, string payload) =>
            workshopId != null && payload != null && workshopId.StartsWith(payload, StringComparison.CurrentCulture);
    }
}