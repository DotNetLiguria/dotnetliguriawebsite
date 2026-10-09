using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguriaCore
{
    public class DotNetLiguriaDatabaseSettings
    {
        public string ConnectionString { get; set; } = null!;

        public string DatabaseName { get; set; } = null!;

        public string WorkshopCollectionName { get; set; } = null!;

        public string SpeakerCollectionName { get; set; } = null!;

        public string BoardCollectionName { get; set; } = null!;

        public string CounterCollectionName { get; set; } = null!;

        public string WorkshopFileCollectionName { get; set; } = null!;

        public string TopMenuCollectionName { get; set; } = null!;

        public string QuestionnaireCollectionName { get; set; } = "Questionnaire";

        public string QuestionnaireResponseCollectionName { get; set; } = "QuestionnaireResponse";
    }
}
