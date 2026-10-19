using Microsoft.AspNetCore.Http.Features;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class ProfileRequestBodyFeature : IHttpRequestBodyDetectionFeature
{
    public bool CanHaveBody => true;
}
