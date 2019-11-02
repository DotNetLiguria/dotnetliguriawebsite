using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.Models;
using DotNetLiguria.Web.Common;
using DotNetLiguria.Web.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace DotNetLiguria.Web.Controllers
{
    public class OfferteLavoroController : BaseController
    {
        private readonly string CKEditorUploads = "~/Uploads/CKEditor/";

        public OfferteLavoroController(DashboardBusiness _business) : base(_business)
        {

        }

        // GET: OfferteLavoro
        public ActionResult Index()
        {
            var offerteLavoro = Business.OfferteLavoro_GetList().Where(x => x.Enable == true);

            return View(offerteLavoro.Take(10).ToList());
        }

        //public ActionResult Create()
        //{
        //    return View();
        //}

        public ActionResult OffertaLavoro(Guid offertaLavoroId)
        {
            var offerta = Business.OfferteLavoro_Get(offertaLavoroId);

            return View("OffertaLavoro", offerta);
        }

        //[HttpPost]
        //[ValidateInput(false)]
        //public ActionResult Create(OffertaLavoro model)
        //{
        //    Business.OfferteLavoro_Create(model, CustomUser);
        //    return RedirectToAction("Index");
        //}

        #region CkEditor

        public void Uploadnow(HttpPostedFileWrapper upload)
        {
            if (upload != null)
            {
                //string ImageName = upload.FileName;
                FileInfo imageFile = new FileInfo(upload.FileName);
                string path = System.IO.Path.Combine(Server.MapPath(CKEditorUploads), imageFile.Name);
                upload.SaveAs(path);
            }
        }

        public ActionResult UploadPartial()
        {
            var appData = Server.MapPath(CKEditorUploads);
            var images = Directory.GetFiles(appData).Select(x => new ImageViewModels
            {
                Url = Url.Content(CKEditorUploads + Path.GetFileName(x))
            });
            return View(images);
        }

        #endregion
    }
}