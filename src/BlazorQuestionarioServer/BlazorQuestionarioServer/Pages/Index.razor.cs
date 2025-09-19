using BlazorAppTest.Shared;
using BlazorQuestionarioServer.Data;
using Microsoft.ApplicationInsights;
using Microsoft.AspNetCore.Components;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop;

namespace BlazorQuestionarioServer.Pages;
public partial class Index : IDisposable
{
    [Inject]
    IDbContextFactory<ApplicationDbContext> DbFactory { get; set; }

    [Inject]
    TelemetryClient telemetryClient { get; set; }

    [Inject]
    IJSRuntime JS { get; set; }


    bool IsBusy { get; set; }
    QuestionarioTest mQuestionarioDTO { get; set; } = new QuestionarioTest();
    bool QuestionarioCompilato = false;


    [CascadingParameter(Name = "ErrorComponent")]
    protected IErrorComponent ErrorComponent { get; set; }

    public void Dispose()
    {


    }
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {

            DateTime startTime = DateTime.UtcNow;
            var _ = await JS.InvokeAsync<string>("toString");
            TimeSpan latency; latency = DateTime.UtcNow - startTime;
            telemetryClient.TrackEvent($"Misura latenza rete: {latency.Milliseconds}");
            StateHasChanged();
        }
    }


    protected override async Task OnInitializedAsync()
    {


        IsBusy = true;
        var AppDbContext = DbFactory.CreateDbContext();

        var wcorrente = await AppDbContext.WorkshopCorrente.FirstOrDefaultAsync();
        if (wcorrente == null)
            throw new Exception("Manca Workshop Corrente");

        var workshop = await AppDbContext.Workshop.Where(x => x.WorkshopId == wcorrente.WorkshopId).AsNoTracking().FirstOrDefaultAsync();
        if (workshop == null)
            throw new Exception();

        mQuestionarioDTO = new QuestionarioTest();
        mQuestionarioDTO.WorkshopId = wcorrente.WorkshopId;

        var ListaWorkshopTrack = await AppDbContext.WorkshopTrack.Where(x => x.WorkshopId == wcorrente.WorkshopId).Include(x => x.ListaWorkshopTrackWorkshopSpeaker).OrderBy(x => x.StartTime).ToListAsync();

        List<WorkshopSpeaker> ListaSpeaker = await AppDbContext.WorkshopSpeaker.ToListAsync();




        mQuestionarioDTO.Track01WorkshopTrackId = ListaWorkshopTrack[0].WorkshopTrackId;
        mQuestionarioDTO.Track01Titolo = ListaWorkshopTrack[0].Title;

        AppDbContext.Entry(ListaWorkshopTrack[0]).Collection(testc => testc.ListaWorkshopTrackWorkshopSpeaker).Load();

        if (ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker.Count > 0)
        {
            AppDbContext.Entry(ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker[0]).Reference(x => x.WorkshopSpeakerWorkshopSpeaker);
            if (ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker != null)
            {
                mQuestionarioDTO.Track01Speaker = ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker.Name;
            }

        }


        if (ListaWorkshopTrack.Count >= 2)
        {

            mQuestionarioDTO.Track02WorkshopTrackId = ListaWorkshopTrack[1].WorkshopTrackId;
            mQuestionarioDTO.Track02Titolo = ListaWorkshopTrack[1].Title;

            AppDbContext.Entry(ListaWorkshopTrack[0]).Collection(testc => testc.ListaWorkshopTrackWorkshopSpeaker).Load();

            if (ListaWorkshopTrack[1].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[1].ListaWorkshopTrackWorkshopSpeaker.Count > 0)
            {
                AppDbContext.Entry(ListaWorkshopTrack[1].ListaWorkshopTrackWorkshopSpeaker[0]).Reference(x => x.WorkshopSpeakerWorkshopSpeaker);
                if (ListaWorkshopTrack[1].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker != null)
                {
                    mQuestionarioDTO.Track02Speaker = ListaWorkshopTrack[1].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker.Name;
                }

            }


        }

        if (ListaWorkshopTrack.Count >= 3)
        {

            mQuestionarioDTO.Track03WorkshopTrackId = ListaWorkshopTrack[2].WorkshopTrackId;
            mQuestionarioDTO.Track03Titolo = ListaWorkshopTrack[2].Title;
            if (ListaWorkshopTrack[2].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[2].ListaWorkshopTrackWorkshopSpeaker.Count > 0)
            {
                AppDbContext.Entry(ListaWorkshopTrack[2].ListaWorkshopTrackWorkshopSpeaker[0]).Reference(x => x.WorkshopSpeakerWorkshopSpeaker);
                if (ListaWorkshopTrack[2].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker != null)
                {
                    mQuestionarioDTO.Track03Speaker = ListaWorkshopTrack[2].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker.Name;
                }

            }
        }
        if (ListaWorkshopTrack.Count >= 4)
        {

            mQuestionarioDTO.Track04WorkshopTrackId = ListaWorkshopTrack[3].WorkshopTrackId;
            mQuestionarioDTO.Track04Titolo = ListaWorkshopTrack[3].Title;
            if (ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker.Count > 0)
            {
                AppDbContext.Entry(ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker[0]).Reference(x => x.WorkshopSpeakerWorkshopSpeaker);
                if (ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker != null)
                {
                    mQuestionarioDTO.Track04Speaker = ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker.Name;


                    if (ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker.Count > 1)
                    {
                        mQuestionarioDTO.Track04Speaker += "/" + ListaWorkshopTrack[3].ListaWorkshopTrackWorkshopSpeaker[1].WorkshopSpeakerWorkshopSpeaker.Name;
                    }
                }

            }
        }

        if (ListaWorkshopTrack.Count >= 5)
        {

            mQuestionarioDTO.Track05WorkshopTrackId = ListaWorkshopTrack[4].WorkshopTrackId;
            mQuestionarioDTO.Track05Titolo = ListaWorkshopTrack[4].Title;
            if (ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker.Count > 0)
            {
                AppDbContext.Entry(ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker[0]).Reference(x => x.WorkshopSpeakerWorkshopSpeaker);
                if (ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker != null)
                {
                    mQuestionarioDTO.Track05Speaker = ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker.Name;

                    if (ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker != null && ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker.Count > 1)
                    {
                        mQuestionarioDTO.Track05Speaker += "/" + ListaWorkshopTrack[4].ListaWorkshopTrackWorkshopSpeaker[1].WorkshopSpeakerWorkshopSpeaker.Name;
                    }

                }

            }
        }


        IsBusy = false;
        await base.OnInitializedAsync();

    }

    async Task SalvaQuestionario()
    {
        if (IsBusy)
            return;


        IsBusy = true;
        var AppDbContext = DbFactory.CreateDbContext();

        var wcorrente = await AppDbContext.WorkshopCorrente.FirstOrDefaultAsync();

        //Esiste già la mail ??
        if (await (AppDbContext.QuestionarioTest.Where(x => x.EMail == mQuestionarioDTO.EMail && x.WorkshopId == wcorrente.WorkshopId).AnyAsync()))
        {
            ErrorComponent.ShowError("Salvataggio Questionario", "La presenta mail ha già compilato il questionario");
            IsBusy = false;
            return;
        }
        mQuestionarioDTO.QuestionarioTestId = Guid.NewGuid();
        AppDbContext.QuestionarioTest.Add(mQuestionarioDTO);

        try
        {
            await AppDbContext.SaveChangesAsync();

        }
        catch (Exception e)
        {
            ErrorComponent.ShowError(e.Message, e.StackTrace);
            IsBusy = false;
        }

        IsBusy = false;
        QuestionarioCompilato = true;

    }
}