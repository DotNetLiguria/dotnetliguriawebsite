namespace DotNetLiguriaCore.Services;

public class UnresolvedSpeakerCollisionException : Exception
{
    public UnresolvedSpeakerCollisionException()
        : base("Sessionize speaker collisions require explicit decisions.")
    {
    }
}
