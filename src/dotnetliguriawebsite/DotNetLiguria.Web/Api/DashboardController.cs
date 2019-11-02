using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.Models;
using DotNetLiguria.Repository;
using DotNetLiguria.Web.ApiCommon;
using DotNetLiguria.Web.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace DotNetLiguria.Web.Api
{
    [Authorize(Roles = "Admin, DotNetDuke")]
    [RoutePrefix("api/dashboard")]
    public class DashboardController : BaseApiController
    {
        public DashboardController(DashboardBusiness _business) : base(_business)
        {

        }

        [Route("test")]
        [HttpGet]
        public IHttpActionResult Test()
        {
            return Ok("This is Test!");
        }

        [Route("workshops")]
        [HttpGet]
        public IHttpActionResult Workshops(int sEcho, int iDisplayStart, int iDisplayLength, string sSearch, int iSortCol_0, string sSortDir_0)
        {
            List<Workshop> workshops = Business.Workshop_GetList();

            if (sSearch != null)
            {
                workshops = workshops.Where(x => x.Title.ToLower().Contains(sSearch.ToLower()) ||
                                            (x.Description.ToLower().Contains(sSearch.ToLower()))).ToList();

            }

            if (iSortCol_0 != 0)
            {
                switch (iSortCol_0)
                {
                    case 1:
                        if (sSortDir_0.Equals("asc"))
                            workshops = workshops.OrderByDescending(x => x.Title).ToList();
                        else workshops = workshops.OrderBy(x => x.Title).ToList();
                        break;
                    case 2:
                        if (sSortDir_0.Equals("asc"))
                            workshops = workshops.OrderByDescending(x => x.Title).ToList();
                        else workshops = workshops.OrderBy(x => x.Title).ToList();
                        break;
                    case 3:
                        if (sSortDir_0.Equals("asc"))
                            workshops = workshops.OrderByDescending(x => x.Title).ToList();
                        else workshops = workshops.OrderBy(x => x.Title).ToList();
                        break;
                }


            }

            var result = workshops.Skip(iDisplayStart)
                                .Take(iDisplayLength)
                                .Select(x => new
                                {
                                    Id = x.WorkshopId,
                                    Title = x.Title,
                                    Image = x.Image,
                                    EventDate = x.EventDate.ToShortDateString(),
                                    ExternalRegistration = x.ExternalRegistration,
                                    IsExternalEvent = x.IsExternalEvent,
                                    Tracks = x.Tracks.Count
                                })
                                .ToList();

            return Ok(new
            {
                sEcho = sEcho,
                iTotalRecords = workshops.Count(),
                iTotalDisplayRecords = workshops.Count(),
                aaData = result
            });
        }

        [Route("speakers")]
        [HttpGet]
        public IHttpActionResult Speakers(int sEcho, int iDisplayStart, int iDisplayLength, string sSearch, int iSortCol_0, string sSortDir_0)
        {
            List<WorkshopSpeaker> speakers = Business.WorkshopSpeaker_GetList();

            if (sSearch != null)
            {
                speakers = speakers.Where(x => x.Name.ToLower().Contains(sSearch.ToLower()) ||
                                            (x.UserName.ToLower().Contains(sSearch.ToLower()))).ToList();
            }

            //if (iSortCol_0 != 0)
            //{
            //    switch (iSortCol_0)
            //    {
            //        case 1:
            //            if (sSortDir_0.Equals("asc"))
            //                workshops = workshops.OrderByDescending(x => x.Title).ToList();
            //            else workshops = workshops.OrderBy(x => x.Title).ToList();
            //            break;
            //        case 2:
            //            if (sSortDir_0.Equals("asc"))
            //                workshops = workshops.OrderByDescending(x => x.Title).ToList();
            //            else workshops = workshops.OrderBy(x => x.Title).ToList();
            //            break;
            //        case 3:
            //            if (sSortDir_0.Equals("asc"))
            //                workshops = workshops.OrderByDescending(x => x.Title).ToList();
            //            else workshops = workshops.OrderBy(x => x.Title).ToList();
            //            break;
            //    }
            //}

            var result = speakers.Skip(iDisplayStart)
                                .Take(iDisplayLength)
                                .Select(x => new
                                {
                                    Id = x.WorkshopSpeakerId,
                                    Name = x.Name,
                                    Image = x.ProfileImage,
                                    Tracks = x.Tracks.Count
                                })
                                .ToList();

            return Ok(new
            {
                sEcho = sEcho,
                iTotalRecords = speakers.Count(),
                iTotalDisplayRecords = speakers.Count(),
                aaData = result
            });
        }
    }
}
