using Microsoft.ApplicationInsights;
using Microsoft.AspNetCore.Components.Server.Circuits;

namespace BlazorQuestionarioServer.Service;

public interface ICircuitCounter
{
}

public class CountCircuitHandler : CircuitHandler, ICircuitCounter
{
    private readonly IServiceProvider _serviceProvider;
    private readonly Timer timertelemetria;
    private static readonly object _lock = new object();
    public List<string> listacircuitiaperti = new();
    private readonly TelemetryClient _telemetryClient;

    private string ConnessioniAperte = "NumCircuitiAperti";

    public CountCircuitHandler(IServiceProvider serviceProvider, TelemetryClient telemetryClient)
    {
        _serviceProvider = serviceProvider;
        _telemetryClient = telemetryClient;
        timertelemetria = new Timer(InserisciDati, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
    }

    private void InserisciDati(object state)
    {
        _telemetryClient.TrackMetric(ConnessioniAperte, listacircuitiaperti.Count);
    }

    public override Task OnCircuitOpenedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            if (!listacircuitiaperti.Where(x => x == circuit.Id).Any())
                listacircuitiaperti.Add(circuit.Id);
        }

        return base.OnCircuitOpenedAsync(circuit, cancellationToken);
    }

    public override Task OnCircuitClosedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        lock (listacircuitiaperti)
        {
            if (listacircuitiaperti.Where(x => x == circuit.Id).Any())
                listacircuitiaperti.Remove(circuit.Id);
        }

        return base.OnCircuitClosedAsync(circuit, cancellationToken);
    }
}