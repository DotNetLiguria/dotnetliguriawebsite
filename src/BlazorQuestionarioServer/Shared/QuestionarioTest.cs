
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text;

namespace BlazorAppTest.Shared
{
    public class QuestionarioTest
    {
        public QuestionarioTest()
        {
            Data = DateTime.Now.Date;


        }

        [Key]
        public string QuestionarioTestId { get; set; }
        public DateTime Data { get; set; }
        [Required,MaxLength(50)]
        public string Nome { get; set; }
        [Required, MaxLength(50)]
        public string Cognome { get; set; }

        [Required, MaxLength(250), EmailAddress(ErrorMessage = "Bad email")]
        public string EMail { get; set; }
        public string ArgomentiProxEvento { get; set; }

        [Range(0, 10)]
        public int ValutazioneQualitaGeneraleEvento { get; set; }
        [Range(0, 10)]
        public int UtilitaInformazioniRicevute { get; set; }

        public Guid WorkshopId { get; set; }
        public Guid Track01WorkshopTrackId { get; set; }
        [NotMapped]
        public string Track01Titolo { get; set; }
        [NotMapped]
        public string Track01Speaker { get; set; }
        [Range(0, 10)]
        public int Track01Valutazione { get; set; }

        public Guid Track02WorkshopTrackId { get; set; }
        [NotMapped]
        public string Track02Titolo { get; set; }
        [NotMapped]
        public string Track02Speaker { get; set; }
        [Range(0, 10)]
        public int Track02Valutazione { get; set; }

        public Guid Track03WorkshopTrackId { get; set; }
        [NotMapped]
        public string Track03Titolo { get; set; }
        [NotMapped]
        public string Track03Speaker { get; set; }
        [Range(0, 10)]
        public int Track03Valutazione { get; set; }

        public Guid Track04WorkshopTrackId { get; set; }
        [NotMapped]
        public string Track04Titolo { get; set; }
        [NotMapped]
        public string Track04Speaker { get; set; }
        [Range(0, 10)]
        public int Track04Valutazione { get; set; }
        public Guid Track05WorkshopTrackId { get; set; }
        [NotMapped]
        public string Track05Titolo { get; set; }
        [NotMapped]
        public string Track05Speaker { get; set; }
        [Range(0, 10)]
        public int Track05Valutazione { get; set; }


    }
}
