using System;
using System.Collections.Generic;
using SkiaSharp;
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


    public class QRController : ControllerBase
    {

        private readonly ApplicationDbContexts _context;
        public QRController(ApplicationDbContexts context)
        {
            _context = context;
        }

        [HttpPost]
        public IActionResult Capture(string name)
        {
            try
            {
                var files = HttpContext.Request.Form.Files;
                if (files == null)
                    return NotFound();

                if (files.Count() != 1)
                    return NotFound();

                var fileq = files[0];
                if (fileq == null)
                    return NotFound();

                var fileName = fileq.FileName;
                // Unique filename "Guid"
                var myUniqueFileName = Convert.ToString(Guid.NewGuid());
                // Getting Extension
                var fileExtension = Path.GetExtension(fileName);

                using var stream = fileq.OpenReadStream();
                var payload = QrPayload.Decode(stream);
                if (payload == null)
                {
                    return NotFound();
                }


                QuestionarioTest mQuestionarioDTO = new QuestionarioTest();
                Workshop workshop = _context.Workshop.OrderByDescending(x => x.EventDate).Take(1).FirstOrDefault();

                if (workshop != null && QrPayload.MatchesWorkshop(workshop.WorkshopId, payload))
                {
                    return Ok();
                }

                


                
            }
            catch (Exception e)
            {
                return NotFound();
                throw;
                
            }


            return NotFound();

        }

        


    }
}