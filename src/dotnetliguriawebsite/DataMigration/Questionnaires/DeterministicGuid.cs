using System.Security.Cryptography;
using System.Text;

namespace DataMigration.Questionnaires;

/// <summary>Creates stable name-based Guids (RFC 9562 version 8 layout) so reruns are idempotent.</summary>
public static class DeterministicGuid
{
    public static Guid Create(string key)
    {
        ArgumentException.ThrowIfNullOrEmpty(key);
        Span<byte> hash = stackalloc byte[32];
        SHA256.HashData(Encoding.UTF8.GetBytes(key), hash);
        var bytes = hash[..16];
        bytes[6] = (byte)((bytes[6] & 0x0F) | 0x80);
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80);
        return new Guid(bytes, bigEndian: true);
    }
}
