using DotNetLiguria.Web.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Web;

namespace DotNetLiguria.Web.DAL
{
    //public class WorkshopRepository : IWorkshopRepository, IDisposable
    //{
    //    private DotNetLiguriaContext context;

    //    public WorkshopRepository(DotNetLiguriaContext context)
    //    {
    //        this.context = context;
    //    }

    //    public IEnumerable<Workshop> GetWorkshops()
    //    {
    //        return context.Workshops.ToList();
    //    }

    //    public Workshop GetWorkshopByID(Guid workshopId)
    //    {
    //        return context.Workshops.Find(workshopId);
    //    }

    //    public void InsertWorkshop(Workshop evento)
    //    {
    //        context.Workshops.Add(evento);
    //    }

    //    public void DeleteWorkshop(Guid workshopId)
    //    {
    //        Workshop workshop = context.Workshops.Find(workshopId);
    //        context.Workshops.Remove(workshop);
    //    }

    //    public void UpdateWorkshop(Workshop workshop)
    //    {
    //        context.Entry(workshop).State = EntityState.Modified;
    //    }

    //    public void Save()
    //    {
    //        context.SaveChanges();
    //    }

    //    private bool disposed = false;

    //    protected virtual void Dispose(bool disposing)
    //    {
    //        if (!this.disposed)
    //        {
    //            if (disposing)
    //            {
    //                context.Dispose();
    //            }
    //        }
    //        this.disposed = true;
    //    }

    //    public void Dispose()
    //    {
    //        Dispose(true);
    //        GC.SuppressFinalize(this);
    //    }
    //}
}