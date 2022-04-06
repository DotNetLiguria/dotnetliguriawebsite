using BlazorAppTest.Shared;
using BlazorQuestionarioServer.Data;
using Microsoft.AspNetCore.Components;
using Microsoft.EntityFrameworkCore;

namespace BlazorQuestionarioServer.Pages;
public partial class Index
{
    [Inject]
    IDbContextFactory<ApplicationDbContext> DbFactory { get; set; }
    bool IsLoading = false;
    QuestionarioTest mQuestionarioDTO { get; set; } = new QuestionarioTest();
    protected override async Task OnInitializedAsync()
    {
        var AppDbContext = DbFactory.CreateDbContext();

        var wcorrente= await AppDbContext.WorkshopCorrente.FirstOrDefaultAsync();
        if (wcorrente == null)
            throw new Exception();

        var workshop = await AppDbContext.Workshop.Where(x=>x.WorkshopId== wcorrente.WorkshopId).FirstOrDefaultAsync();
        if (workshop == null)
            throw new Exception();

        mQuestionarioDTO=new QuestionarioTest();
        mQuestionarioDTO.WorkshopId = wcorrente.WorkshopId;

        var ListaWorkshopTrack = await AppDbContext.WorkshopTrack.Where(x => x.WorkshopId == wcorrente.WorkshopId).ToListAsync();




        mQuestionarioDTO.Track01WorkshopTrackId = ListaWorkshopTrack[0].WorkshopTrackId;
        mQuestionarioDTO.Track01Titolo = ListaWorkshopTrack[0].Title;
        mQuestionarioDTO.Track01Speaker = "xxxxxx";
        if (ListaWorkshopTrack.Count >= 2)
        {

            mQuestionarioDTO.Track02WorkshopTrackId = ListaWorkshopTrack[1].WorkshopTrackId;
            mQuestionarioDTO.Track02Titolo = ListaWorkshopTrack[1].Title;

        }

        if (ListaWorkshopTrack.Count >= 3)
        {

            mQuestionarioDTO.Track03WorkshopTrackId = ListaWorkshopTrack[2].WorkshopTrackId;
            mQuestionarioDTO.Track03Titolo = ListaWorkshopTrack[2].Title;
        }
        if (ListaWorkshopTrack.Count >= 4)
        {

            mQuestionarioDTO.Track04WorkshopTrackId = ListaWorkshopTrack[3].WorkshopTrackId;
            mQuestionarioDTO.Track04Titolo = ListaWorkshopTrack[3].Title;
        }

        if (ListaWorkshopTrack.Count >= 5)
        {

            mQuestionarioDTO.Track05WorkshopTrackId = ListaWorkshopTrack[4].WorkshopTrackId;
            mQuestionarioDTO.Track05Titolo = ListaWorkshopTrack[4].Title;
        }

        

        await base.OnInitializedAsync();

    }
    void SalvaQuestionario()
    {

    }
}