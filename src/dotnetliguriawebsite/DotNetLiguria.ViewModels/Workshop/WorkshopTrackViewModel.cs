using DotNetLiguria.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.ViewModels
{
    public class WorkshopTrackViewModel
    {
        public Guid[] SelectedSpeakers { get; set; }
        public WorkshopTrack Track { get; set; }
    }
}
