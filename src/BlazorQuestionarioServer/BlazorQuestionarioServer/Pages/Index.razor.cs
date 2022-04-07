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
            throw new Exception("Manca Workshop Corrente");

        var workshop = await AppDbContext.Workshop.Where(x=>x.WorkshopId== wcorrente.WorkshopId).AsNoTracking().FirstOrDefaultAsync();
        if (workshop == null)
            throw new Exception();

        mQuestionarioDTO=new QuestionarioTest();
        mQuestionarioDTO.WorkshopId = wcorrente.WorkshopId;

        var ListaWorkshopTrack = await AppDbContext.WorkshopTrack.Where(x => x.WorkshopId == wcorrente.WorkshopId).Include(x=>x.ListaWorkshopTrackWorkshopSpeaker).ToListAsync();

        List<WorkshopSpeaker> ListaSpeaker= await AppDbContext.WorkshopSpeaker.ToListAsync();
        
        

        
        mQuestionarioDTO.Track01WorkshopTrackId = ListaWorkshopTrack[0].WorkshopTrackId;
        mQuestionarioDTO.Track01Titolo = ListaWorkshopTrack[0].Title;

        AppDbContext.Entry(ListaWorkshopTrack[0]).Collection(testc=>testc.ListaWorkshopTrackWorkshopSpeaker).Load();

        if (ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker!=null && ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker.Count > 0)
        {
            AppDbContext.Entry(ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker[0]).Reference(x=>x.WorkshopSpeakerWorkshopSpeaker);
            if (ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker != null)
            {
                mQuestionarioDTO.Track01Speaker = ListaWorkshopTrack[0].ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeaker.Name;
            }

        }




        ////var Speaker = await AppDbContext.WorkshopTrackWorkshopSpeaker.Where(x => x.WorkshopTrackWorkshopTrackId == mQuestionarioDTO.Track01WorkshopTrackId)
        ////    .Join(ListaWorkshopTrack.Where(c => c.WorkshopId == wcorrente.WorkshopId), x => x.WorkshopTrackWorkshopTrackId, y => y.WorkshopTrackId, (post, meta) => new { WorkshopTrackWorkshopSpeaker = post })
        ////    .Join(ListaSpeaker, x => x.WorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeakerId, o => o.WorkshopSpeakerId, (a, b) => b.Name).FirstOrDefaultAsync();
        //var WorkshopTrack = ListaWorkshopTrack.Where(x => x.WorkshopTrackId == mQuestionarioDTO.Track01WorkshopTrackId).FirstOrDefault();
        //if (WorkshopTrack != null && WorkshopTrack.WorkshopTrackWorkshopSpeaker!=null && WorkshopTrack.WorkshopTrackWorkshopSpeaker.Count>0)
        //{
        //    var speaker = ListaSpeaker.Where(x => x.WorkshopSpeakerId == WorkshopTrack.WorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeakerId).FirstOrDefault();
        //    if (speaker!=null)
        //        mQuestionarioDTO.Track01Speaker = speaker.Name;

        //}




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
                }

            }
        }



        await base.OnInitializedAsync();

    }
    //string WorkshopSpeakerWorkshopSpeakerId2Name(List<WorkshopSpeaker> ListaSpeaker,Guid SpeakerId)
    //{

    //    var speaker = ListaSpeaker.Where(x => x.WorkshopSpeakerId == WorkshopTrack.ListaWorkshopTrackWorkshopSpeaker[0].WorkshopSpeakerWorkshopSpeakerId).FirstOrDefault();
    //    if (speaker != null)
    //        return speaker.Name;

    //    return string.Empty;


    //}
    void SalvaQuestionario()
    {

    }
}