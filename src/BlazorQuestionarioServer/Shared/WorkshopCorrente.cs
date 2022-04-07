using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlazorAppTest.Shared { 
    public partial class WorkshopCorrente
    {
        public WorkshopCorrente()
        {
            
            
            
        }
        [Key]
        public Guid WorkshopId { get; set; }
        


    }
}
