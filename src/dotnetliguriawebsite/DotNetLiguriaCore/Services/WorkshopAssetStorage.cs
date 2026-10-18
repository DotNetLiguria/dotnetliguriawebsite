using System.Buffers.Binary;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public sealed class WorkshopAssetStorage(IWebHostEnvironment environment)
{
    public const long MaximumBytes = 25 * 1024 * 1024;

    public string PathFor(WorkshopFile file)
    {
        if (!WorkshopUploadValidation.TryGetSafeExtension(file.FileName, file.FileType, out var extension) ||
            file.FileName != $"{file.WorkshopFileId:N}{extension}")
            throw new InvalidDataException("Invalid private asset identifier.");
        return Path.Combine(environment.ContentRootPath, "PrivateUploads", file.FileName);
    }

    public async Task<bool> SaveAsync(IFormFile upload, WorkshopFile file, CancellationToken cancellationToken)
    {
        if (upload.Length is <= 0 or > MaximumBytes)
            return false;
        var target = PathFor(file);
        await using var source = upload.OpenReadStream();
        var header = new byte[(int)Math.Min(upload.Length, 1024 * 1024)];
        var read = await source.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        if (!HasSignature(Path.GetExtension(target), header.AsSpan(0, read)))
            return false;
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        var temporary = target + ".tmp";
        try
        {
            await using (var destination = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await destination.WriteAsync(header.AsMemory(0, read), cancellationToken);
                await source.CopyToAsync(destination, cancellationToken);
                if (destination.Length > MaximumBytes)
                    throw new InvalidDataException("Upload exceeds the permitted size.");
            }
            File.Move(temporary, target);
            return true;
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    public static bool HasSignature(string extension, ReadOnlySpan<byte> header)
    {
        if (extension == ".png")
            return header.Length >= 24 && header[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) &&
                header[12..16].SequenceEqual("IHDR"u8) &&
                ValidDimensions(BinaryPrimitives.ReadUInt32BigEndian(header[16..20]),
                    BinaryPrimitives.ReadUInt32BigEndian(header[20..24]));
        if (extension == ".gif")
            return header.Length >= 10 &&
                (header[..6].SequenceEqual("GIF87a"u8) || header[..6].SequenceEqual("GIF89a"u8)) &&
                ValidDimensions(BinaryPrimitives.ReadUInt16LittleEndian(header[6..8]),
                    BinaryPrimitives.ReadUInt16LittleEndian(header[8..10]));
        return extension switch
        {
            ".jpg" or ".jpeg" => ValidJpeg(header),
            ".webp" => ValidWebP(header),
            ".pdf" => header.StartsWith("%PDF-"u8),
            ".mp4" => header.Length >= 12 && header[4..8].SequenceEqual("ftyp"u8),
            ".webm" => header.StartsWith(new byte[] { 26, 69, 223, 163 }),
            // Office archives require a malware-scanning integration before they can be accepted.
            _ => false,
        };
    }

    private static bool ValidJpeg(ReadOnlySpan<byte> header)
    {
        if (header.Length < 4 || header[0] != 255 || header[1] != 216) return false;
        var offset = 2;
        while (offset + 4 <= header.Length)
        {
            if (header[offset] != 255) return false;
            var marker = header[offset + 1];
            if (marker == 255) { offset++; continue; }
            if (marker is 217 or 218) return false;
            var length = BinaryPrimitives.ReadUInt16BigEndian(header.Slice(offset + 2, 2));
            if (length < 2 || offset + length + 2 > header.Length) return false;
            if (marker is 192 or 193 or 194)
                return length >= 8 && ValidDimensions(
                    BinaryPrimitives.ReadUInt16BigEndian(header.Slice(offset + 7, 2)),
                    BinaryPrimitives.ReadUInt16BigEndian(header.Slice(offset + 5, 2)));
            offset += length + 2;
        }
        return false;
    }

    private static bool ValidWebP(ReadOnlySpan<byte> header)
    {
        if (header.Length < 30 || !header[..4].SequenceEqual("RIFF"u8) ||
            !header[8..12].SequenceEqual("WEBP"u8)) return false;
        if (header[12..16].SequenceEqual("VP8X"u8))
            return ValidDimensions(1u + header[24] + ((uint)header[25] << 8) + ((uint)header[26] << 16),
                1u + header[27] + ((uint)header[28] << 8) + ((uint)header[29] << 16));
        if (header[12..16].SequenceEqual("VP8 "u8) &&
            header.Slice(23, 3).SequenceEqual(new byte[] { 157, 1, 42 }))
            return ValidDimensions((uint)(BinaryPrimitives.ReadUInt16LittleEndian(header[26..28]) & 16383),
                (uint)(BinaryPrimitives.ReadUInt16LittleEndian(header[28..30]) & 16383));
        if (header[12..16].SequenceEqual("VP8L"u8) && header[20] == 47)
        {
            var bits = BinaryPrimitives.ReadUInt32LittleEndian(header[21..25]);
            return ValidDimensions((bits & 16383) + 1, ((bits >> 14) & 16383) + 1);
        }
        return false;
    }

    private static bool ValidDimensions(uint width, uint height) =>
        width is > 0 and <= 8192 && height is > 0 and <= 8192 && (ulong)width * height <= 40_000_000;
}
