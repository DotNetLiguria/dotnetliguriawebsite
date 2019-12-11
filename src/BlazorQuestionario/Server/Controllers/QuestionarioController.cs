using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using BlazorAppTest.Shared;
using ZXing;
using Microsoft.EntityFrameworkCore;


namespace BlazorAppTest.Server.Controllers
{

    [ApiController]
    [Route("[controller]")]
    public class QuestionarioController : Controller
    {

        private readonly ApplicationDbContexts context;
        public QuestionarioController(ApplicationDbContexts context)
        {
            this.context = context;
        }

       

        [HttpGet("{id}", Name = "GetQuestionario")]
        public async Task<ActionResult<QuestionarioTest>> Get(string id)
        {
            return await context.QuestionarioTest.Where(x => x.QuestionarioTestId == id).FirstOrDefaultAsync();

        }

        


        [HttpPost]
        public async Task<ActionResult> Post(QuestionarioTest mQuestionarioDTO)
        {
            context.QuestionarioTest.Add(mQuestionarioDTO);
            await context.SaveChangesAsync();
            return new CreatedAtRouteResult("GetQuestionario", new { id = mQuestionarioDTO.QuestionarioTestId }, mQuestionarioDTO);

        }

        [HttpGet]
        public QuestionarioTest Get()
        {

            QuestionarioTest mQuestionarioDTO = new QuestionarioTest();
            Workshop workshop = context.Workshop.OrderByDescending(x => x.EventDate).Take(1).FirstOrDefault();
            if (workshop==null)
                return mQuestionarioDTO;

            mQuestionarioDTO.QuestionarioTestId = Guid.NewGuid().ToString();
            mQuestionarioDTO.WorkshopId = workshop.WorkshopId;

            //Prendo la lista delle track
            //Level=0 -> Domande e risposte
            var ListaTrack=    context.WorkshopTrack.Where(x=>x.WorkshopId== workshop.WorkshopId && x.Level>0).OrderBy(x => x.StartTime).ToList();
            //var ListaTrack = workshop.WorkshopTracks.Where(x => x.Level > 0).OrderBy(x => x.StartTime).ToList();

            if (ListaTrack.Count() >= 1)
            {
               
                WorkshopTrack workshopTrack01 = ListaTrack[0];
                mQuestionarioDTO.Track01WorkshopTrackId = workshopTrack01.WorkshopTrackId;
                mQuestionarioDTO.Track01Titolo = workshopTrack01.Title;

                //Prendo gli speaker
                var ListaSpeaker = workshopTrack01.WorkshopTrackWorkshopSpeaker;



                //var ListaSpeaker = context.WorkshopTrackWorkshopSpeaker.Where(x => x.WorkshopTrackWorkshopTrackId == workshopTrack01.WorkshopTrackId);

                foreach (WorkshopTrackWorkshopSpeaker itemWorkshopTrackWorkshopSpeaker in ListaSpeaker)
                {
                    if (itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker == null)
                        continue;

                    mQuestionarioDTO.Track01Speaker = (string.IsNullOrEmpty(mQuestionarioDTO.Track01Speaker) ? string.Empty :
                        mQuestionarioDTO.Track01Speaker + "-") + itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker.Name;
                }
 
            }

            if (ListaTrack.Count() >= 2)
            {

                WorkshopTrack workshopTrack02 = ListaTrack[1];
                mQuestionarioDTO.Track02WorkshopTrackId = workshopTrack02.WorkshopTrackId;
                mQuestionarioDTO.Track02Titolo = workshopTrack02.Title;

                //Prendo gli speaker
                var ListaSpeaker = workshopTrack02.WorkshopTrackWorkshopSpeaker;



                foreach (WorkshopTrackWorkshopSpeaker itemWorkshopTrackWorkshopSpeaker in ListaSpeaker)
                {
                    if (itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker == null)
                        continue;

                    mQuestionarioDTO.Track02Speaker = (string.IsNullOrEmpty(mQuestionarioDTO.Track02Speaker) ? string.Empty :
                        mQuestionarioDTO.Track02Speaker + "-") + itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker.Name;
                }

            }

            if (ListaTrack.Count() >= 3)
            {

                WorkshopTrack workshopTrack03 = ListaTrack[2];
                mQuestionarioDTO.Track03WorkshopTrackId = workshopTrack03.WorkshopTrackId;
                mQuestionarioDTO.Track03Titolo = workshopTrack03.Title;

                //Prendo gli speaker
                var ListaSpeaker = workshopTrack03.WorkshopTrackWorkshopSpeaker;



                foreach (WorkshopTrackWorkshopSpeaker itemWorkshopTrackWorkshopSpeaker in ListaSpeaker)
                {
                    if (itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker == null)
                        continue;

                    mQuestionarioDTO.Track03Speaker = (string.IsNullOrEmpty(mQuestionarioDTO.Track03Speaker) ? string.Empty :
                        mQuestionarioDTO.Track03Speaker + "-") + itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker.Name;
                }

            }
            if (ListaTrack.Count() >= 4)
            {

                WorkshopTrack workshopTrack04 = ListaTrack[3];
                mQuestionarioDTO.Track04WorkshopTrackId = workshopTrack04.WorkshopTrackId;
                mQuestionarioDTO.Track04Titolo = workshopTrack04.Title;

                //Prendo gli speaker
                var ListaSpeaker = workshopTrack04.WorkshopTrackWorkshopSpeaker;



                foreach (WorkshopTrackWorkshopSpeaker itemWorkshopTrackWorkshopSpeaker in ListaSpeaker)
                {
                    if (itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker == null)
                        continue;

                    mQuestionarioDTO.Track04Speaker = (string.IsNullOrEmpty(mQuestionarioDTO.Track04Speaker) ? string.Empty :
                        mQuestionarioDTO.Track04Speaker + "-") + itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker.Name;
                }

            }
            if (ListaTrack.Count() >= 5)
            {

                WorkshopTrack workshopTrack05 = ListaTrack[4];
                mQuestionarioDTO.Track05WorkshopTrackId = workshopTrack05.WorkshopTrackId;
                mQuestionarioDTO.Track05Titolo = workshopTrack05.Title;

                //Prendo gli speaker
                var ListaSpeaker = workshopTrack05.WorkshopTrackWorkshopSpeaker;



                foreach (WorkshopTrackWorkshopSpeaker itemWorkshopTrackWorkshopSpeaker in ListaSpeaker)
                {
                    if (itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker == null)
                        continue;

                    mQuestionarioDTO.Track05Speaker = (string.IsNullOrEmpty(mQuestionarioDTO.Track05Speaker) ? string.Empty :
                        mQuestionarioDTO.Track05Speaker + "-") + itemWorkshopTrackWorkshopSpeaker.WorkshopSpeakerWorkshopSpeaker.Name;
                }

            }

            return mQuestionarioDTO;

        }


    }
}