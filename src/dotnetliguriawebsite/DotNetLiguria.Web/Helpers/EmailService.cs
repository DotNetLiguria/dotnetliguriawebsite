using DotNetLiguria.Repository;
using Hangfire;
using Postal;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace DotNetLiguria.Web.Helpers
{
    public class MailerService
    {
        IUnitOfWork unitOfWork;

        public MailerService()
        {
            this.unitOfWork = Repository.Utils.RepositoryFactory.Get<UnitOfWork>();
        }

        public void WorkshopSubscribe(Guid workshopId, string user)
        {
            var workshop = unitOfWork.WorkshopRepository.SelectByID(workshopId);

            dynamic email = new Email("WorkshopSubscribe");
            email.Title = workshop.Title;
            email.To = user;
            email.From = "noreply@DotNetLiguria.net";
            email.Subject = "Workshop Subscribe";
            email.Model = workshop;
            email.Send();
        }

        public void WorkshopCheckIn(Guid workshopId, string user)
        {
            var workshop = unitOfWork.WorkshopRepository.SelectByID(workshopId);

            dynamic email = new Email("WorkshopCheckIn");
            email.Title = workshop.Title;
            email.To = user;
            email.From = "noreply@DotNetLiguria.net";
            email.Subject = "Workshop Checkin";
            email.Model = workshop;
            email.Send();
        }

        public void WorkshopUnsubscribe(Guid workshopId, string user)
        {
            var workshop = unitOfWork.WorkshopRepository.SelectByID(workshopId);

            dynamic email = new Email("WorkshopUnsubscribe");
            email.Title = workshop.Title;
            email.To = user;
            email.From = "noreply@DotNetLiguria.net";
            email.Subject = "Workshop Unsubscribe";
            email.Model = workshop;
            email.Send();
        }

        public void CustomHtml(string receiver, string subject, string html)
        {
            //string Text = "<html> <head> </head>" +
            //" <body style= \" font-size:12px; font-family: Arial\">" +
            //"<img src='https://www.microsoft.com/global/learning/en-us/PublishingImages/ms-logo-site-share.png' height='100' width='100' />" +
            //"</body></html>";

            using (System.Net.Mail.MailMessage msg = new System.Net.Mail.MailMessage())
            {
                msg.From = new System.Net.Mail.MailAddress("noreply@percigal.net");
                msg.To.Add(receiver);
                msg.Subject = subject;
                msg.Body = html;
                msg.Priority = System.Net.Mail.MailPriority.High;
                msg.IsBodyHtml = true;

                using (var smtp = new System.Net.Mail.SmtpClient())
                {
                    smtp.Send(msg);
                }
            }

        }
    }
}