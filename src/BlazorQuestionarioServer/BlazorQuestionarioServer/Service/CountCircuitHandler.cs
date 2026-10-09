using Microsoft.ApplicationInsights;
using Microsoft.AspNetCore.Components.Server.Circuits;

namespace BlazorQuestionarioServer.Service;

public class CountCircuitHandler : CircuitHandler, ICircuitCounter, IDisposable
{
    private readonly ITimer _timertelemetria;
    private static readonly object _lock = new object();
    public List<string> listacircuitiaperti = new();
    private readonly Action<string, int> _reportMetric;

    private string _connessioniAperte = "NumCircuitiAperti";

    public CountCircuitHandler(IServiceProvider serviceProvider, TelemetryClient telemetryClient)
        : this(TimeProvider.System, (name, count) => telemetryClient.TrackMetric(name, count))
    {
    }

    public CountCircuitHandler(TimeProvider timeProvider, Action<string, int> reportMetric)
    {
        _reportMetric = reportMetric;
        _timertelemetria = timeProvider.CreateTimer(InserisciDati, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
    }

    private void InserisciDati(object? state)
    {
        int count;
        lock (_lock)
            count = listacircuitiaperti.Count;
        _reportMetric(_connessioniAperte, count);
    }

    internal void OpenCircuit(string circuitId)
    {
        lock (_lock)
        {
            if (!listacircuitiaperti.Contains(circuitId))
                listacircuitiaperti.Add(circuitId);
        }
    }

    internal void CloseCircuit(string circuitId)
    {
        lock (_lock)
        {
            listacircuitiaperti.Remove(circuitId);
        }
    }

    public override Task OnCircuitOpenedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        OpenCircuit(circuit.Id);
        return base.OnCircuitOpenedAsync(circuit, cancellationToken);
    }

    public override Task OnCircuitClosedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        CloseCircuit(circuit.Id);
        return base.OnCircuitClosedAsync(circuit, cancellationToken);
    }

    public void Dispose() => _timertelemetria.Dispose();
}