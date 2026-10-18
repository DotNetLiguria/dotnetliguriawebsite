using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace DotNetLiguriaCore.Tests;

internal sealed class StartingResponseFeature : IHttpResponseFeature
{
    private readonly List<(Func<object, Task> Callback, object State)> _callbacks = [];
    public int StatusCode { get; set; } = 200;
    public string? ReasonPhrase { get; set; }
    public IHeaderDictionary Headers { get; set; } = new HeaderDictionary();
    public Stream Body { get; set; } = new MemoryStream();
    public bool HasStarted => false;
    public void OnStarting(Func<object, Task> callback, object state) => _callbacks.Add((callback, state));
    public void OnCompleted(Func<object, Task> callback, object state) { }
    public async Task StartAsync()
    {
        for (var i = _callbacks.Count - 1; i >= 0; i--)
            await _callbacks[i].Callback(_callbacks[i].State);
    }
}
