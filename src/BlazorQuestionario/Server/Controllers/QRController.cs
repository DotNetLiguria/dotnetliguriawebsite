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


    public class QRController : ControllerBase
    {

        private readonly ApplicationDbContexts context;
        public QRController(ApplicationDbContexts context)
        {
            this.context = context;
        }


        //[HttpGet("{iden}", Name = "CheckGuid")]
        //public async Task<ActionResult<bool>> GetCheckGuid(string _id)
        //{
        //    if (string.IsNullOrEmpty(_id))
        //        return false;


        //    return true;

        //}

        //[HttpGet("{iden}", Name = "CheckGuid")]
        [HttpGet]
        [Route("QR/GetCheckGuid/{Guid}")]
        public ActionResult<bool> GetCheckGuid(string Guid)
        {

            if (string.IsNullOrEmpty(Guid))
                return false;


            if (Guid.Length <= 5)
                return false;


            Workshop workshop = context.Workshop.OrderByDescending(x => x.EventDate).Take(1).FirstOrDefault();

            if (workshop.WorkshopId.ToString().Contains(Guid))
            {
                return true;
            }

            
            return false;

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

                var reader = new BarcodeReader { AutoRotate = true };


                System.DrawingCore.Bitmap bitmap = new System.DrawingCore.Bitmap(fileq.OpenReadStream());

                LuminanceSource so = new ZXing.ZKWeb.BitmapLuminanceSource(bitmap);
                var result = reader.Decode(so);
                if (result == null)
                {
                    return NotFound();
                }


                QuestionarioTest mQuestionarioDTO = new QuestionarioTest();
                Workshop workshop = context.Workshop.OrderByDescending(x => x.EventDate).Take(1).FirstOrDefault();

                if (workshop.WorkshopId.ToString().StartsWith(result.ToString()))
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