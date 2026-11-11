using System.Text;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class ScriptedSmtpStream(string responses) : Stream
{
    private readonly MemoryStream _responses = new(Encoding.ASCII.GetBytes(responses));
    private readonly MemoryStream _commands = new();

    public string Commands => Encoding.UTF8.GetString(_commands.ToArray());
    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => true;
    public override long Length => throw new NotSupportedException();
    public override long Position
    {
        get => throw new NotSupportedException();
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count) => _responses.Read(buffer, offset, count);
    public override int Read(Span<byte> buffer) => _responses.Read(buffer);
    public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) =>
        _responses.ReadAsync(buffer, cancellationToken);
    public override void Write(byte[] buffer, int offset, int count) => _commands.Write(buffer, offset, count);
    public override void Write(ReadOnlySpan<byte> buffer) => _commands.Write(buffer);
    public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default) =>
        _commands.WriteAsync(buffer, cancellationToken);
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _responses.Dispose();
            _commands.Dispose();
        }
        base.Dispose(disposing);
    }
}
